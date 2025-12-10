"""
Chat response API endpoints with session management and persistence.
"""
import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from loguru import logger
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from app.dependencies import get_db
from app.schemas.chat import ResponseRequest
from app.services.task_service import TaskService
from app.services.conversation_service import ConversationService
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
        
        try:
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(f"📥 Request: message='{request.message[:50]}...', session_id={request.session_id}, task_id={request.task_id}")
            
            # Get or create task
            if request.task_id:
                task = TaskService.get_task(db, request.task_id)
            elif request.session_id:
                # Try to find task by session_id
                task = TaskService.get_or_create_task_by_session(db, request.session_id)
            else:
                # Create new task with title from message
                title = request.message[:50].strip()
                if len(request.message) > 50:
                    title += "..."
                task = TaskService.get_or_create_task_by_session(db, None, title)
                logger.info(f"📝 Created new task: {task.id} - {task.title}")
            
            # Save user message to database
            ConversationService.create_user_message(db, task.id, request.message)
            
            # Create options with resume if we have a session_id
            options_kwargs = {
                "system_prompt": "You are an expert Python developer",
                "permission_mode": 'acceptEdits',
                "cwd": "/Users/chenjinsheng/github/lite-agent/backend/project"
            }
            if request.session_id or task.session_id:
                session_id_to_use = request.session_id or task.session_id
                options_kwargs["resume"] = session_id_to_use
                logger.info(f"📤 Resuming session: {session_id_to_use}")
            else:
                logger.info(f"📤 Starting new session")
            
            options = ClaudeAgentOptions(**options_kwargs)
            
            # Create fresh client for each request
            client = ClaudeSDKClient(options=options)
            await client.connect()
            
            # Send message
            await client.query(request.message)
            logger.info(f"✅ Query sent, waiting for response...")
            
            # Process response using adapter
            adapter = EventAdapter()
            new_session_id = None
            session_id_sent = False
            
            # Use adapter's adapt_message_stream to get proper cost tracking
            async for event in adapter.adapt_message_stream(client.receive_response()):
                # Extract session_id from SystemMessage (init) or ResultMessage
                if not new_session_id:
                    if event.type == 'CustomEvent' and hasattr(event, 'data'):
                        event_data = event.data
                        if isinstance(event_data, dict):
                            # Check for session_id in SystemMessage
                            if event_data.get('subtype') == 'init':
                                system_data = event_data.get('data', {})
                                if isinstance(system_data, dict):
                                    new_session_id = system_data.get('session_id')
                            # Check for session_id in ResultMessage
                            elif 'session_id' in event_data:
                                new_session_id = event_data.get('session_id')
                    
                    if new_session_id:
                        logger.info(f"🔍 Got session_id: {new_session_id}")
                        # Update task with session_id
                        if task and not task.session_id:
                            task.session_id = new_session_id
                            db.commit()
                
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
            
            logger.info(f"✅ Done (session: {new_session_id}, task: {task.id if task else None})")
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                        
        except Exception as e:
            logger.error(f"❌ Error: {e}", exc_info=True)
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
