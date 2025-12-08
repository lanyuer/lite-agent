"""
Chat API routes.
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from claude_agent_sdk import ClaudeAgentOptions, query
from core.adapters import EventAdapter


router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat request model."""
    message: str


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Stream chat responses as AG-UI events.
    
    Args:
        request: Chat request containing user message
        
    Returns:
        StreamingResponse with Server-Sent Events
    """
    async def event_generator():
        try:
            # Initialize agent client
            options = ClaudeAgentOptions(
                system_prompt="You are an expert Python developer",
                permission_mode='acceptEdits',
                cwd="/Users/chenjinsheng/github/lite-agent/backend/project"
            )
            
            # Get message stream from SDK
            message_stream = query(prompt=request.message, options=options)
            #message_stream = query(request.message)
            
            # Create event adapter
            adapter = EventAdapter()
            
            # Convert to events and stream
            async for event in adapter.adapt_message_stream(message_stream):
                # Serialize event to JSON with camelCase field names
                event_json = event.model_dump_json(by_alias=True)
                yield f"data: {event_json}\n\n"
                
        except Exception as e:
            # Send error event
            from core.events import RunError
            import uuid
            error_event = RunError(
                run_id=str(uuid.uuid4()),
                error=str(e)
            )
            yield f"data: {error_event.model_dump_json(by_alias=True)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
