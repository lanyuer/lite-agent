# Migration Guide: Event-Driven Architecture

## Overview

This guide explains how to migrate from the current message-based architecture to the new event-driven architecture based on AG-UI protocol.

## What Changed?

### Backend
- **Before**: Direct serialization of `claude_agent_sdk` messages
- **After**: Conversion to standardized AG-UI events via `EventAdapter`

### Frontend
- **Before**: Manual state management with message accumulation
- **After**: Automatic state management via `EventProcessor` and `useAgentEvents` hook

## Migration Steps

### Step 1: Backend (Already Done ✅)

The backend has been updated to use the event system:

```python
# backend/main.py
from event_adapter import EventAdapter

adapter = EventAdapter()
async for event in adapter.adapt_message_stream(message_stream):
    yield f"data: {event.model_dump_json()}\n\n"
```

### Step 2: Frontend - Choose Your Approach

#### Option A: Use the New Event-Driven App (Recommended)

1. Edit `frontend/src/main.tsx`:
```typescript
import AppWithEvents from './AppWithEvents.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithEvents />
  </React.StrictMode>,
)
```

2. Restart the dev server:
```bash
# The dev server should auto-reload
```

#### Option B: Gradually Migrate Existing App

1. Import the hook in your component:
```typescript
import { useAgentEvents } from './hooks/useAgentEvents';

const { state, sendMessage, stopGeneration } = useAgentEvents();
```

2. Replace manual state management:
```typescript
// Before
const [messages, setMessages] = useState([]);

// After
const { state } = useAgentEvents();
// state.messages, state.thinking, state.toolCalls
```

3. Replace message sending:
```typescript
// Before
const handleSendMessage = async () => {
  // Manual fetch and state update
};

// After
const handleSendMessage = async () => {
  await sendMessage(input);
};
```

## Key Benefits

### 1. **Automatic State Management**
No need to manually track message IDs, deduplicate, or manage streaming state.

### 2. **Type Safety**
Full TypeScript types for all events and state.

### 3. **Separation of Concerns**
- `EventProcessor`: Handles event processing and state
- `useAgentEvents`: React integration
- Components: Pure presentation

### 4. **Extensibility**
Easy to add new event types or handlers without changing core logic.

### 5. **Better Streaming**
Events are processed incrementally with proper start/end lifecycle.

## Component Comparison

### Old MessageItem vs New EventMessage

**Old (`MessageItem.tsx`)**:
```typescript
// Handles complex nested message structures
// Manual parsing of different block types
// Mixes state management with presentation
<MessageItem message={msg} />
```

**New (`EventMessage.tsx`)**:
```typescript
// Simple, focused components
// State already processed by EventProcessor
// Pure presentation logic
<EventMessage message={msg} />
<EventMessage thinking={think} />
<EventMessage toolCall={tool} />
```

## Testing Both Versions

You can keep both versions and switch between them:

```typescript
// main.tsx
import App from './App.tsx'
import AppWithEvents from './AppWithEvents.tsx'

// Use old version
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)

// Or use new version
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppWithEvents />
)
```

## Troubleshooting

### Events not appearing
- Check browser console for parsing errors
- Verify backend is using `EventAdapter`
- Check network tab for SSE stream

### State not updating
- Ensure `EventProcessor` is initialized
- Check that event handlers are registered
- Verify events have correct `type` field

### TypeScript errors
- Run `npm install` to ensure types are up to date
- Check that event types match between frontend and backend

## Next Steps

1. **Test the new system**: Send a few messages and verify behavior
2. **Monitor performance**: Check if streaming feels smoother
3. **Add custom events**: Extend the system for your needs
4. **Remove old code**: Once confident, remove the old App.tsx

## Rollback Plan

If you need to rollback:

1. Edit `main.tsx` to use `App` instead of `AppWithEvents`
2. The old system is still intact and functional
3. No data loss - both systems work with the same backend

## Questions?

- Check `docs/EVENT_SYSTEM.md` for architecture details
- Review event types in `frontend/src/types/events.ts`
- Look at `EventProcessor` implementation for state management logic
