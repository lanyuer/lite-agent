"""
Chat response API endpoints with session management and persistence.
"""
import uuid
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from loguru import logger
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from app.dependencies import get_db
from app.schemas.chat import ResponseRequest
from app.services.task_service import TaskService
from app.services.conversation_service import ConversationService
from app.services.event_service import EventService
from core.adapters import EventAdapter
from core.events import CustomEvent, RunError

router = APIRouter()


@router.post("")
async def response(
    request: ResponseRequest,
    db: Session = Depends(get_db)
):
    """
    Stream response as AG-UI events.
    
    - First request: no session_id, creates new session
    - Subsequent requests: use resume=session_id to continue conversation
    - Saves conversations to database
    """
    async def event_generator():
        client = None
        task = None
        assistant_message_id = None
        assistant_content_parts = []
        usage_info: Optional[Dict[str, Any]] = None
        cost_usd: Optional[float] = None
        input_tokens: Optional[int] = None
        output_tokens: Optional[int] = None
        event_sequence = 0  # Track event sequence for ordering
        
        try:
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(f"📥 Request: message='{request.message[:50]}...', session_id={request.session_id}, task_id={request.task_id}")
            
            # Get existing task if provided, otherwise wait for response before creating
            task = None
            if request.task_id:
                task = TaskService.get_task(db, request.task_id)
                logger.info(f"📋 Found task by task_id: {task.id}, session_id={task.session_id}")
            elif request.session_id:
                # Try to find existing task by session_id
                from app.models.task import Task
                task = db.query(Task).filter(Task.session_id == request.session_id).first()
                if task:
                    logger.info(f"📋 Found task by session_id: {task.id}")
                else:
                    logger.info(f"📋 No task found for session_id: {request.session_id}")
            
            # We'll create task only if we receive a valid assistant response
            # This prevents creating empty tasks
            
            # Create options with resume if we have a session_id
            # Priority: task.session_id > request.session_id > new session
            options_kwargs = {
                "system_prompt": "You are an expert Python developer",
                "permission_mode": 'acceptEdits',
                "cwd": "/Users/chenjinsheng/github/lite-agent/backend/project"
            }
            
            # Determine which session_id to use for resumption
            # IMPORTANT: Only use resume if we have a valid session_id from an existing task
            # For new sessions, don't use resume - let Claude SDK create a new session
            session_id_to_use = None
            if task and task.session_id:
                # If we have a task with session_id, use it to resume (continuing existing conversation)
                session_id_to_use = task.session_id
                logger.info(f"📤 Resuming session from task: {session_id_to_use} (task_id={task.id})")
            elif request.session_id:
                # Fallback: use request session_id only if no task found
                # This handles edge cases where task exists but session_id wasn't saved
                session_id_to_use = request.session_id
                logger.info(f"📤 Resuming session from request: {session_id_to_use} (no task found)")
            else:
                # No session_id available - this is a NEW session
                logger.info(f"📤 Starting NEW session (no task_id, no session_id provided)")
            
            if session_id_to_use:
                options_kwargs["resume"] = session_id_to_use
            # else: new session, don't add resume option
            
            options = ClaudeAgentOptions(**options_kwargs)
            
            # Create fresh client for each request
            client = ClaudeSDKClient(options=options)
            await client.connect()
            
            # Process response using adapter
            adapter = EventAdapter()
            new_session_id = None
            session_id_sent = False
            has_valid_response = False  # Track if we got a valid assistant response
            
            # Prepare user message ID (will be saved when we have a task)
            user_message_id = f"user-{int(datetime.now().timestamp() * 1000)}"
            user_message_saved = False
            
            # If we have an existing task, initialize event_sequence from max sequence + 1
            # This ensures events are saved in correct order (interleaved: user1 -> assistant1 -> user2 -> assistant2)
            if task:
                max_sequence = EventService.get_max_sequence(db, task.id)
                event_sequence = max_sequence + 1
                logger.info(f"📊 Task {task.id} max sequence: {max_sequence}, starting from {event_sequence}")
            
            # If we have an existing task, save user message immediately (before sending)
            # This ensures user messages are saved for existing tasks
            if task:
                logger.info(f"💾 Saving user message to existing task {task.id}")
                ConversationService.create_user_message(db, task.id, request.message)
                # Save user message events with current sequence
                EventService.save_event(
                    db, task.id, 'TextMessageStart',
                    {'message_id': user_message_id, 'role': 'user'},
                    event_sequence
                )
                event_sequence += 1
                EventService.save_event(
                    db, task.id, 'TextMessageContent',
                    {'message_id': user_message_id, 'delta': request.message},
                    event_sequence
                )
                event_sequence += 1
                EventService.save_event(
                    db, task.id, 'TextMessageEnd',
                    {'message_id': user_message_id},
                    event_sequence
                )
                event_sequence += 1
                user_message_saved = True
                logger.info(f"✅ User message saved to task {task.id} (sequence {event_sequence - 3} to {event_sequence - 1})")
            
            # Send message
            await client.query(request.message)
            logger.info(f"✅ Query sent, waiting for response...")
            
            # Get run_id from adapter (needed for RunStarted event)
            run_id = adapter.run_id
            
            # Track if we've saved RunStarted manually (to avoid duplicate from adapter)
            run_started_saved = False
            
            # Use adapter's adapt_message_stream to get proper cost tracking
            # Note: adapter automatically yields RunStarted as the first event
            async for event in adapter.adapt_message_stream(client.receive_response()):
                # Fallback: Create task if we don't have one (shouldn't happen if frontend creates task first)
                # This is a safety fallback for backward compatibility
                if not task and event.type in ['RunStarted', 'TextMessageStart', 'ThinkingStart', 'ToolCallStart']:
                    logger.warning(f"⚠️ No task found but received response event - creating task as fallback (this shouldn't happen if frontend creates task first)")
                    # Create task when we start receiving a response (deferred task creation - fallback only)
                    title = request.message[:50].strip()
                    if len(request.message) > 50:
                        title += "..."
                    task = TaskService.get_or_create_task_by_session(db, None, title)
                    logger.info(f"📝 Created new task (fallback): {task.id} - {task.title}")
                    
                    # IMPORTANT: Reset event_sequence to 0 for this new task
                    # User message must be saved FIRST (sequence 0, 1, 2), before any response events
                    event_sequence = 0
                    
                    # Save user message to database (now that we have a task)
                    # This MUST be saved before RunStarted and other response events
                    if not user_message_saved:
                        ConversationService.create_user_message(db, task.id, request.message)
                        # Save user message events - these should be the FIRST events (sequence 0, 1, 2)
                        EventService.save_event(
                            db, task.id, 'TextMessageStart',
                            {'message_id': user_message_id, 'role': 'user'},
                            event_sequence
                        )
                        event_sequence += 1
                        EventService.save_event(
                            db, task.id, 'TextMessageContent',
                            {'message_id': user_message_id, 'delta': request.message},
                            event_sequence
                        )
                        event_sequence += 1
                        EventService.save_event(
                            db, task.id, 'TextMessageEnd',
                            {'message_id': user_message_id},
                            event_sequence
                        )
                        event_sequence += 1
                        user_message_saved = True
                        logger.info(f"✅ User message saved to new task {task.id} (sequence 0-2)")
                    
                    # Mark that we have a valid response (task will be kept)
                    has_valid_response = True
                
                # Save all events to database (except SessionInfo which we handle separately)
                if task and event.type != 'SessionInfo':
                    # Handle RunStarted event: save it once, then yield to frontend
                    if event.type == 'RunStarted':
                        if not run_started_saved:
                            # Save RunStarted event (either for new task or existing task)
                            EventService.save_event(
                                db, task.id, 'RunStarted',
                                {'run_id': run_id},
                                event_sequence
                            )
                            event_sequence += 1
                            run_started_saved = True
                        # Yield RunStarted event to frontend and continue (don't save again)
                        yield f"data: {event.model_dump_json()}\n\n"
                        continue
                    # For CustomEvent (like SystemMessage, ResultMessage), only save the data field
                    # For other events, save the full model_dump()
                    if event.type == 'SystemMessage' or event.type == 'ResultMessage':
                        # CustomEvent has a 'data' field that contains the actual event data
                        # We should save only the data field, not the entire CustomEvent structure
                        if hasattr(event, 'data'):
                            event_dict = event.data if isinstance(event.data, dict) else {}
                        else:
                            event_dict = event.model_dump()
                    else:
                        event_dict = event.model_dump()
                    
                    # Log important events for debugging
                    if event.type in ['ThinkingStart', 'ThinkingContent', 'ThinkingEnd', 'TextMessageStart', 'TextMessageContent', 'TextMessageEnd', 'SystemMessage']:
                        logger.info(f"💾 Saving {event.type} event (seq={event_sequence}): {event_dict}")
                    EventService.save_event(
                        db, task.id, event.type, event_dict, event_sequence
                    )
                    event_sequence += 1
                    
                    # Mark that we have a valid response
                    if event.type in ['TextMessageStart', 'ThinkingStart', 'ToolCallStart']:
                        has_valid_response = True
                # Extract session_id from SystemMessage (init) or ResultMessage
                # According to SDK docs: session_id is in SystemMessage (subtype='init') -> message.data.get('session_id')
                if not new_session_id:
                    # Check SystemMessage (converted to CustomEvent with type='SystemMessage')
                    if event.type == 'SystemMessage' and hasattr(event, 'data'):
                        event_data = event.data
                        if isinstance(event_data, dict):
                            # Check if this is an init message
                            if event_data.get('subtype') == 'init':
                                logger.info(f"🔍 Processing SystemMessage init event: {event_data}")
                                # First check if session_id is at the top level of event_data (from SystemMessageConverter)
                                new_session_id = event_data.get('session_id')
                                logger.info(f"🔍 Checked top-level session_id: {new_session_id}")
                                # If not found, check in nested data (message.data)
                                if not new_session_id:
                                    system_data = event_data.get('data', {})
                                    if isinstance(system_data, dict):
                                        new_session_id = system_data.get('session_id')
                                        logger.info(f"🔍 Checked nested data session_id: {new_session_id}")
                    
                    # Check ResultMessage (converted to CustomEvent with type='ResultMessage')
                    elif event.type == 'ResultMessage' and hasattr(event, 'data'):
                        event_data = event.data
                        if isinstance(event_data, dict) and 'session_id' in event_data:
                            new_session_id = event_data.get('session_id')
                            logger.info(f"🔍 Got session_id from ResultMessage: {new_session_id}")
                    
                    if new_session_id:
                        logger.info(f"✅ Extracted session_id: {new_session_id}")
                        # Update task with session_id (if task exists)
                        # Important: session_id is Claude's session ID, should be unique per task
                        if task:
                            if not task.session_id:
                                # This is a new session_id for this task
                                # Check if this session_id is already used by another task (shouldn't happen for new sessions)
                                from app.models.task import Task
                                existing_task = db.query(Task).filter(
                                    Task.session_id == new_session_id,
                                    Task.id != task.id
                                ).first()
                                
                                if existing_task:
                                    # This should not happen for new sessions
                                    # If it does, it means we're resuming a session that belongs to another task
                                    logger.error(f"❌ ERROR: Session {new_session_id} already used by task {existing_task.id}!")
                                    logger.error(f"❌ Current task: {task.id}, Existing task: {existing_task.id}")
                                    logger.error(f"❌ This indicates a logic error: new session_id conflicts with existing task")
                                    # Don't update - this is a serious error that needs investigation
                                    # Instead, log and continue without updating session_id
                                else:
                                    logger.info(f"💾 Saving session_id to task {task.id}")
                                    task.session_id = new_session_id
                                    db.commit()
                                    db.refresh(task)
                                    logger.info(f"✅ Task {task.id} now has session_id: {task.session_id}")
                            elif task.session_id != new_session_id:
                                # Session ID changed - this shouldn't happen normally
                                # If we resumed with task.session_id, Claude should return the same session_id
                                logger.warning(f"⚠️ Task {task.id} session_id changed from {task.session_id} to {new_session_id}")
                                logger.warning(f"⚠️ This might indicate session_id extraction error or SDK behavior change")
                                # Don't update - keep the original session_id to avoid conflicts
                            else:
                                logger.info(f"ℹ️ Task {task.id} already has session_id: {task.session_id} (matches extracted)")
                        # If no task yet but we have session_id, try to find existing task
                        elif not task and new_session_id:
                            from app.models.task import Task
                            task = db.query(Task).filter(Task.session_id == new_session_id).first()
                            if task:
                                logger.info(f"🔍 Found existing task by session_id: {task.id}")
                
                # Collect assistant message content from TextMessageContent events
                if event.type == 'TextMessageStart' and hasattr(event, 'role') and event.role == 'assistant':
                    assistant_message_id = getattr(event, 'message_id', None)
                    assistant_content_parts = []  # Reset for new message
                
                if event.type == 'TextMessageContent' and hasattr(event, 'message_id'):
                    # Only collect if this is the assistant message we're tracking
                    if assistant_message_id and getattr(event, 'message_id') == assistant_message_id:
                        delta = getattr(event, 'delta', '')
                        if delta:
                            assistant_content_parts.append(delta)
                
                # Collect usage information from RunFinished event
                if event.type == 'RunFinished':
                    if hasattr(event, 'total_cost_usd'):
                        cost_usd = getattr(event, 'total_cost_usd', None)
                    if hasattr(event, 'usage'):
                        usage_data = getattr(event, 'usage', {})
                        if isinstance(usage_data, dict):
                            usage_info = usage_data
                            input_tokens = usage_data.get('input_tokens') or usage_data.get('inputTokens')
                            output_tokens = usage_data.get('output_tokens') or usage_data.get('outputTokens')
                            if cost_usd is None:
                                cost_usd = usage_data.get('total_cost_usd')
                    logger.info(f"💰 Collected usage: cost={cost_usd}, input_tokens={input_tokens}, output_tokens={output_tokens}")
                
                # Send session_id to frontend (only once, on first occurrence)
                if new_session_id and not session_id_sent and event.type != 'RunStarted':
                    session_event = CustomEvent(
                        type='SessionInfo',
                        data={'session_id': new_session_id, 'task_id': task.id if task else None}
                    )
                    yield f"data: {session_event.model_dump_json()}\n\n"
                    session_id_sent = True
                
                # Yield the event (using snake_case)
                yield f"data: {event.model_dump_json()}\n\n"
            
            # Save assistant response to database with usage information
            if task and assistant_content_parts:
                assistant_content = ''.join(assistant_content_parts)
                if assistant_content.strip():
                    ConversationService.create_assistant_message(
                        db,
                        task.id,
                        assistant_content,
                        cost_usd=cost_usd,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        usage_data=usage_info
                    )
                    logger.info(f"💾 Saved assistant message to task {task.id} ({len(assistant_content)} chars)")
                    logger.info(f"💰 Task cumulative: cost=${task.total_cost_usd:.4f}, tokens={task.total_input_tokens + task.total_output_tokens}")
            elif task and not request.task_id:
                # If we created a new task (not provided by user) but got no assistant content
                # Check if task has any assistant messages
                from app.models.conversation import Conversation
                assistant_messages = db.query(Conversation).filter(
                    Conversation.task_id == task.id,
                    Conversation.role == 'assistant'
                ).count()
                
                if assistant_messages == 0:
                    # No assistant messages, delete the empty task
                    logger.warning(f"⚠️ No assistant response received, deleting empty task {task.id}")
                    TaskService.delete_task(db, task.id)
                    task = None
                else:
                    logger.info(f"⚠️ Task {task.id} has {assistant_messages} assistant messages, keeping task")
            
            logger.info(f"✅ Done (session: {new_session_id}, task: {task.id if task else None})")
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                        
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
