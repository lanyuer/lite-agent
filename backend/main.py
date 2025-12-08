import asyncio
import json
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions
from event_adapter import EventAdapter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

async def generate_response(prompt: str):
    """Generate streaming response using event-based architecture."""
    options = ClaudeAgentOptions(
        system_prompt="You are an expert Python developer",
        permission_mode='acceptEdits',
        cwd="/Users/chenjinsheng/github/lite-agent/backend/project"
    )
    
    adapter = EventAdapter()
    
    try:
        # Get message stream from SDK
        message_stream = query(prompt=prompt, options=options)
        
        # Convert to events and stream
        async for event in adapter.adapt_message_stream(message_stream):
            # Serialize event to JSON with camelCase field names
            event_json = event.model_dump_json(by_alias=True)
            yield f"data: {event_json}\n\n"
            
    except Exception as e:
        # Send error event
        from events import RunError
        error_event = RunError(
            run_id=adapter.run_id,
            error=str(e),
            error_type=type(e).__name__
        )
        yield f"data: {error_event.model_dump_json()}\n\n"

@app.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        generate_response(request.message), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)