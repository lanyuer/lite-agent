"""
Chat response API endpoints with session management and persistence.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from loguru import logger

from app.dependencies import get_db
from app.schemas.chat import ResponseRequest
from app.services.task_service import TaskService
from app.services.session_service import SessionService
from app.services.agent_service import AgentService
from app.services.event_service import EventService
from app.utils.event_helpers import EventHelpers
from core.events import CustomEvent, RunError, ToolCallResult

router = APIRouter()


@router.post("")
async def response(
    request: ResponseRequest,
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """
    Stream response as AG-UI events.
    
    - First request: no session_id, creates new session
    - Subsequent requests: use resume=session_id to continue conversation
    - Saves conversations to database
    """
    async def event_generator():
        client = None
        task = None
        assistant_message_id: Optional[str] = None
        assistant_content_parts: list[str] = []
        usage_info: Optional[dict] = None
        cost_usd: Optional[float] = None
        input_tokens: Optional[int] = None
        output_tokens: Optional[int] = None
        event_sequence = 0
        new_session_id: Optional[str] = None
        session_id_sent = False
        user_message_saved = False
        run_started_saved = False
        
        try:
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(
                f"📥 Request: message='{request.message[:50]}...', "
                f"session_id={request.session_id}, task_id={request.task_id}"
            )
            
            # Find task by task_id or session_id
            task = SessionService.find_task_by_id_or_session(
                db, request.task_id, request.session_id
            )
            
            # Determine session_id for resumption
            session_id_to_use = SessionService.determine_session_id(
                task, request.session_id
            )
            
            # Create agent client
            options = AgentService.create_client_options(session_id=session_id_to_use)
            client = await AgentService.create_client(options)
            adapter = AgentService.create_event_adapter()
            user_message_id = AgentService.generate_user_message_id()
            
            # Initialize event sequence
            if task:
                max_sequence = EventService.get_max_sequence(db, task.id)
                event_sequence = max_sequence + 1
                logger.info(
                    f"📊 Task {task.id} max sequence: {max_sequence}, "
                    f"starting from {event_sequence}"
                )
                
                # Save user message for existing task
                event_sequence = EventHelpers.save_user_message_events(
                    db, task.id, user_message_id, request.message, event_sequence
                )
                user_message_saved = True
            
            # Send message to agent
            await client.query(request.message)
            logger.info("✅ Query sent, waiting for response...")
            
            run_id = adapter.run_id
            
            # Process event stream
            async for event in AgentService.stream_events(adapter, client):
                # Fallback: Create task if we don't have one (shouldn't happen)
                if not task and event.type in (
                    'RunStarted', 'TextMessageStart', 'ThinkingStart', 'ToolCallStart'
                ):
                    logger.warning(
                        "⚠️ No task found but received response event - "
                        "creating task as fallback"
                    )
                    title = request.message[:50].strip()
                    if len(request.message) > 50:
                        title += "..."
                    task = TaskService.get_or_create_task_by_session(db, None, title)
                    logger.info(f"📝 Created new task (fallback): {task.id} - {task.title}")
                    
                    event_sequence = 0
                    if not user_message_saved:
                        event_sequence = EventHelpers.save_user_message_events(
                            db, task.id, user_message_id, request.message, event_sequence
                        )
                        user_message_saved = True
                
                # Save events to database
                if task and event.type != 'SessionInfo':
                    if event.type == 'RunStarted':
                        if not run_started_saved:
                            EventService.save_event(
                                db, task.id, 'RunStarted',
                                {'run_id': run_id}, event_sequence
                            )
                            event_sequence += 1
                            run_started_saved = True
                        yield f"data: {event.model_dump_json()}\n\n"
                        continue
                    
                    # Prepare event data for storage
                    event_dict = EventHelpers.prepare_event_data(event)
                    
                    # Log important events
                    if event.type in (
                        'ThinkingStart', 'ThinkingContent', 'ThinkingEnd',
                        'TextMessageStart', 'TextMessageContent', 'TextMessageEnd',
                        'SystemMessage'
                    ):
                        logger.info(
                            f"💾 Saving {event.type} event (seq={event_sequence}): {event_dict}"
                        )
                    
                    EventService.save_event(
                        db, task.id, event.type, event_dict, event_sequence
                    )
                    event_sequence += 1
                
                # Extract session_id
                if not new_session_id:
                    extracted_id = EventHelpers.extract_session_id(event)
                    if extracted_id:
                        new_session_id = extracted_id
                        logger.info(f"✅ Extracted session_id: {new_session_id}")
                        
                        # Update task with session_id
                        if task:
                            success, existing_task = SessionService.update_task_session_id(
                                db, task, new_session_id
                            )
                            
                            # If conflict detected, switch to existing task
                            if not success and existing_task:
                                logger.info(
                                    f"🔄 Switching from task {task.id} to existing task {existing_task.id} "
                                    f"(same session_id: {new_session_id})"
                                )
                                
                                # Note: User message may have been saved to old task
                                # This is acceptable since both tasks correspond to the same session
                                if user_message_saved:
                                    logger.info(
                                        f"ℹ️ User message was saved to old task {task.id}, "
                                        f"but continuing conversation in task {existing_task.id}"
                                    )
                                
                                # Update event sequence to continue from existing task
                                max_sequence = EventService.get_max_sequence(db, existing_task.id)
                                event_sequence = max_sequence + 1
                                logger.info(
                                    f"📊 Switched to task {existing_task.id}, "
                                    f"max sequence: {max_sequence}, starting from {event_sequence}"
                                )
                                task = existing_task
                        elif new_session_id:
                            # Try to find existing task by session_id
                            from app.models.task import Task
                            task = db.query(Task).filter(
                                Task.session_id == new_session_id
                            ).first()
                            if task:
                                logger.info(f"🔍 Found existing task by session_id: {task.id}")
                                # Update event sequence
                                max_sequence = EventService.get_max_sequence(db, task.id)
                                event_sequence = max_sequence + 1
                                logger.info(
                                    f"📊 Task {task.id} max sequence: {max_sequence}, "
                                    f"starting from {event_sequence}"
                                )
                
                # Collect assistant content
                assistant_message_id, assistant_content_parts = (
                    EventHelpers.collect_assistant_content(
                        event, assistant_message_id, assistant_content_parts
                    )
                )
                
                # Generate UI components for tool results (e.g., images)
                if event.type == 'ToolCallResult':
                    tool_result = event  # type: ToolCallResult
                    ui_component = EventHelpers.generate_ui_component_for_tool_result(
                        tool_result, assistant_message_id
                    )
                    
                    if ui_component:
                        logger.info(
                            f"🎨 Generated UI component {ui_component.component_id} "
                            f"for tool result {tool_result.tool_call_id}"
                        )
                        
                        # Save UI component event
                        if task:
                            event_dict = EventHelpers.prepare_event_data(ui_component)
                            EventService.save_event(
                                db, task.id, 'UIComponent', event_dict, event_sequence
                            )
                            event_sequence += 1
                        
                        # Yield UI component event to frontend
                        yield f"data: {ui_component.model_dump_json()}\n\n"
                
                # Extract usage info
                if event.type == 'RunFinished':
                    usage_data = EventHelpers.extract_usage_info(event)
                    cost_usd = usage_data.get('cost_usd')
                    usage_info = usage_data.get('usage')
                    input_tokens = usage_data.get('input_tokens')
                    output_tokens = usage_data.get('output_tokens')
                    logger.info(
                        f"💰 Collected usage: cost={cost_usd}, "
                        f"input_tokens={input_tokens}, output_tokens={output_tokens}"
                    )
                
                # Send session_id to frontend (once)
                if new_session_id and not session_id_sent and event.type != 'RunStarted':
                    session_event = CustomEvent(
                        type='SessionInfo',
                        data={
                            'session_id': new_session_id,
                            'task_id': task.id if task else None
                        }
                    )
                    yield f"data: {session_event.model_dump_json()}\n\n"
                    session_id_sent = True
                
                # Yield event to frontend
                yield f"data: {event.model_dump_json()}\n\n"
            
            # Save assistant response
            if task and assistant_content_parts:
                assistant_content = ''.join(assistant_content_parts)
                if assistant_content.strip():
                    from app.services.conversation_service import ConversationService
                    ConversationService.create_assistant_message(
                        db, task.id, assistant_content,
                        cost_usd=cost_usd,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        usage_data=usage_info
                    )
                    logger.info(
                        f"💾 Saved assistant message to task {task.id} "
                        f"({len(assistant_content)} chars)"
                    )
                    logger.info(
                        f"💰 Task cumulative: cost=${task.total_cost_usd:.4f}, "
                        f"tokens={task.total_input_tokens + task.total_output_tokens}"
                    )
            elif task and not request.task_id:
                # Check if task has assistant messages (fallback scenario)
                from app.models.conversation import Conversation
                assistant_count = db.query(Conversation).filter(
                    Conversation.task_id == task.id,
                    Conversation.role == 'assistant'
                ).count()
                
                if assistant_count == 0:
                    logger.warning(
                        f"⚠️ No assistant response received, deleting empty task {task.id}"
                    )
                    TaskService.delete_task(db, task.id)
                    task = None
                else:
                    logger.info(
                        f"⚠️ Task {task.id} has {assistant_count} assistant messages, "
                        f"keeping task"
                    )
            
            logger.info(
                f"✅ Done (session: {new_session_id}, "
                f"task: {task.id if task else None})"
            )
            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
        except Exception as e:
            logger.exception("❌ Error occurred")
            error_event = RunError(
                run_id=str(uuid.uuid4()),
                error=str(e)
            )
            yield f"data: {error_event.model_dump_json()}\n\n"
            
        finally:
            if client:
                try:
                    await client.disconnect()
                except Exception:
                    pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
