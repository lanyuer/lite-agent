# Event System Architecture

## Overview

This project implements a standardized event system based on the [Agent User Interaction Protocol (AG-UI)](https://docs.ag-ui.com/concepts/events). The system provides a clean separation between backend message generation and frontend state management, enabling extensibility and maintainability.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│  claude_agent_sdk                                            │
│         │                                                     │
│         ▼                                                     │
│  EventAdapter ────► AG-UI Events ────► FastAPI SSE          │
│         │                                   │                │
│         │                                   │                │
└─────────┼───────────────────────────────────┼────────────────┘
          │                                   │
          │         Network (SSE)             │
          │                                   │
┌─────────┼───────────────────────────────────┼────────────────┐
│         │                                   │                │
│         │                                   ▼                │
│  Event Types ◄──────────────────── EventSource              │
│         │                                   │                │
│         ▼                                   │                │
│  EventProcessor ──────► State Management    │                │
│         │                     │              │                │
│         ▼                     ▼              │                │
│  Event Handlers ────► React Components       │                │
│                                                               │
│                        Frontend                               │
└───────────────────────────────────────────────────────────────┘
```

## Event Types

### Lifecycle Events
- `RunStarted`: Agent run begins
- `RunFinished`: Agent run completes
- `RunError`: Agent run encounters error
- `StepStarted`: Individual step begins
- `StepFinished`: Individual step completes

### Text Message Events
- `TextMessageStart`: New message begins
- `TextMessageContent`: Streaming text delta
- `TextMessageEnd`: Message completes

### Tool Call Events
- `ToolCallStart`: Tool invocation begins
- `ToolCallArgs`: Streaming tool arguments
- `ToolCallEnd`: Tool call completes
- `ToolCallResult`: Tool returns result

### Thinking Events
- `ThinkingStart`: Reasoning process begins
- `ThinkingContent`: Streaming thinking delta
- `ThinkingEnd`: Thinking completes

### State Events
- `StateSnapshot`: Complete state
- `StateDelta`: Incremental state change

### Custom Events
- `CustomEvent`: Extensible event type for custom data

## Backend Implementation

### Event Definitions (`backend/events.py`)
```python
from events import TextMessageStart, TextMessageContent

# Events are Pydantic models
event = TextMessageStart(
    message_id="msg-123",
    role="assistant"
)
```

### Event Adapter (`backend/event_adapter.py`)
```python
from event_adapter import EventAdapter

adapter = EventAdapter()

async for event in adapter.adapt_message_stream(sdk_messages):
    # Events are now standardized AG-UI format
    yield event
```

### FastAPI Integration (`backend/main.py`)
```python
@app.post("/chat")
async def chat(request: ChatRequest):
    adapter = EventAdapter()
    
    async def generate():
        async for event in adapter.adapt_message_stream(query(...)):
            yield f"data: {event.model_dump_json()}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

## Frontend Implementation

### Event Types (`frontend/src/types/events.ts`)
```typescript
import { AgentEvent, TextMessageContent } from './types/events';

// TypeScript types for all events
const event: TextMessageContent = {
    type: 'TextMessageContent',
    messageId: 'msg-123',
    delta: 'Hello',
    timestamp: new Date().toISOString()
};
```

### Event Processor (`frontend/src/lib/EventProcessor.ts`)
```typescript
import { EventProcessor } from './lib/EventProcessor';

const processor = new EventProcessor({
    onTextMessageContent: (event) => {
        console.log('New text:', event.delta);
    },
    onToolCallStart: (event) => {
        console.log('Tool called:', event.toolCallName);
    }
});

// Process events
processor.processEvent(event);

// Access accumulated state
const state = processor.getState();
console.log(state.messages);
```

### React Integration
```typescript
const [processor] = useState(() => new EventProcessor({
    onTextMessageContent: (event) => {
        // Update UI with new text
        setMessages(prev => updateMessage(prev, event));
    }
}));

// In SSE handler
const data = JSON.parse(dataStr);
processor.processEvent(data);
```

## Extensibility

### Adding New Event Types

**Backend:**
```python
# backend/events.py
class MyCustomEvent(BaseEvent):
    type: Literal["MyCustomEvent"] = "MyCustomEvent"
    custom_field: str
```

**Frontend:**
```typescript
// frontend/src/types/events.ts
export interface MyCustomEvent extends BaseEvent {
    type: 'MyCustomEvent';
    customField: string;
}

// Add to union type
export type AgentEvent = ... | MyCustomEvent;
```

### Custom Event Handlers

```typescript
const processor = new EventProcessor({
    onCustomEvent: (event) => {
        if (event.type === 'MyCustomEvent') {
            // Handle custom event
        }
    }
});
```

## Benefits

1. **Standardization**: Follows AG-UI protocol for interoperability
2. **Type Safety**: Full TypeScript/Python type checking
3. **Extensibility**: Easy to add new event types
4. **Separation of Concerns**: Clean backend/frontend boundary
5. **Streaming Support**: Built-in support for incremental updates
6. **State Management**: Automatic state accumulation
7. **Testability**: Events can be easily mocked and tested

## Future Enhancements

- [ ] Event replay/debugging
- [ ] Event persistence
- [ ] Event filtering/routing
- [ ] Performance metrics
- [ ] Event validation middleware
- [ ] WebSocket support (in addition to SSE)
- [ ] Event batching for performance
