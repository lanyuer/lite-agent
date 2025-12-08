# Event System Test

## Quick Test

1. Open http://localhost:5173
2. Type a message like "Hello"
3. Send the message

## Expected Behavior

### Backend Events (check browser DevTools Network tab)
You should see SSE events like:
```json
{"type":"RunStarted","run_id":"...","timestamp":"..."}
{"type":"TextMessageStart","message_id":"...","role":"assistant","timestamp":"..."}
{"type":"TextMessageContent","message_id":"...","delta":"Hello","timestamp":"..."}
{"type":"TextMessageEnd","message_id":"...","timestamp":"..."}
{"type":"RunFinished","run_id":"...","timestamp":"..."}
```

### Frontend Display
- User message appears immediately
- Assistant response streams in character-by-character
- Thinking blocks (if any) appear with streaming text
- Tool calls (if any) show with collapsible details

## Debugging

### If nothing appears:
1. Check browser console for errors
2. Check Network tab for SSE connection
3. Verify backend is running on port 8000

### If events aren't parsing:
1. Check console for "Error parsing event"
2. Verify event JSON structure matches TypeScript types

### If state isn't updating:
1. Check EventProcessor is initialized
2. Verify handlers are being called (add console.log)
3. Check that updateState() is being called

## Common Issues

### Issue: "AgentEvent not found"
**Solution**: Import types have been fixed with type-only imports

### Issue: Events received but not displayed
**Solution**: Check that EventProcessor.processEvent() is being called

### Issue: Duplicate messages
**Solution**: EventProcessor uses Map to track unique messages by ID

## Comparison with Old System

### Old System (App.tsx)
- Manual message accumulation
- Complex nested message parsing
- Duplicate detection via JSON comparison

### New System (AppWithEvents.tsx)
- Automatic state management via EventProcessor
- Clean event-driven architecture
- Built-in deduplication by message ID
