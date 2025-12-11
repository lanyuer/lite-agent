"""
Refactored Event adapter with better structure and maintainability.

This refactored version uses:
- Strategy pattern for message converters
- Constants for configuration
- Better type safety
- Separation of concerns
"""
import uuid
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Callable, Any, Optional
from loguru import logger
from core.events import (
    AgentEvent,
    RunStarted,
    RunFinished,
    RunError,
    TextMessageStart,
    TextMessageContent,
    TextMessageEnd,
    ToolCallStart,
    ToolCallArgs,
    ToolCallEnd,
    ToolCallResult,
    ThinkingStart,
    ThinkingContent,
    ThinkingEnd,
    CustomEvent,
)


# Constants
STREAMING_CHUNK_SIZE = 10
STREAMING_DELAY = 0.01


class MessageConverter(ABC):
    """Base class for message converters."""
    
    @abstractmethod
    def can_handle(self, message: Any) -> bool:
        """Check if this converter can handle the message."""
        pass
    
    @abstractmethod
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert message to events."""
        pass


class SystemMessageConverter(MessageConverter):
    """Converts SystemMessage to CustomEvent."""
    
    def can_handle(self, message: Any) -> bool:
        msg_type = getattr(message, 'type', type(message).__name__)
        return msg_type == 'SystemMessage'
    
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        # Extract session_id from message.data if available (for init messages)
        # According to SDK docs and test_multiconv.py, session_id is in message.data.get('session_id')
        message_data = getattr(message, 'data', {})
        session_id = None
        if isinstance(message_data, dict):
            session_id = message_data.get('session_id')
        
        data = {
            'subtype': getattr(message, 'subtype', None),
            'data': message_data,
        }
        # Include session_id at top level for easier access
        if session_id:
            data['session_id'] = session_id
        
        yield CustomEvent(
            type='SystemMessage',
            data=data
        )


class UserMessageConverter(MessageConverter):
    """Converts UserMessage to text events."""
    
    def __init__(self, content_block_converter: 'ContentBlockConverter'):
        self.content_block_converter = content_block_converter
    
    def can_handle(self, message: Any) -> bool:
        msg_type = getattr(message, 'type', type(message).__name__)
        return msg_type == 'UserMessage'
    
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        content = getattr(message, 'content', [])
        
        if isinstance(content, list):
            for block in content:
                async for event in self.content_block_converter.convert(block):
                    yield event
        elif isinstance(content, str):
            message_id = str(uuid.uuid4())
            yield TextMessageStart(message_id=message_id, role='user')
            yield TextMessageContent(message_id=message_id, delta=content)
            yield TextMessageEnd(message_id=message_id)


class AssistantMessageConverter(MessageConverter):
    """Converts AssistantMessage to events."""
    
    def __init__(self, content_block_converter: 'ContentBlockConverter', tool_call_converter: 'ToolCallConverter'):
        self.content_block_converter = content_block_converter
        self.tool_call_converter = tool_call_converter
    
    def can_handle(self, message: Any) -> bool:
        msg_type = getattr(message, 'type', type(message).__name__)
        return msg_type == 'AssistantMessage'
    
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        # Handle tool_calls if present
        if hasattr(message, 'tool_calls') and message.tool_calls:
            for tool_call in message.tool_calls:
                async for event in self.tool_call_converter.convert(tool_call):
                    yield event
        
        # Handle content
        content = getattr(message, 'content', [])
        if isinstance(content, list):
            for block in content:
                async for event in self.content_block_converter.convert(block):
                    yield event
        elif isinstance(content, str):
            message_id = str(uuid.uuid4())
            yield TextMessageStart(message_id=message_id, role='assistant')
            yield TextMessageContent(message_id=message_id, delta=content)
            yield TextMessageEnd(message_id=message_id)


class ResultMessageConverter(MessageConverter):
    """Converts ResultMessage to CustomEvent."""
    
    def __init__(self, adapter: 'EventAdapter'):
        self.adapter = adapter
    
    def can_handle(self, message: Any) -> bool:
        msg_type = getattr(message, 'type', type(message).__name__)
        return msg_type == 'ResultMessage'
    
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        # Extract usage information for cost tracking
        usage_data = None
        
        # Log all attributes for debugging
        logger.debug(f"📊 ResultMessageConverter - message attributes: {[attr for attr in dir(message) if not attr.startswith('_')]}")
        
        # Try multiple ways to get usage
        if hasattr(message, 'usage'):
            usage_data = getattr(message, 'usage', None)
            logger.info(f"📊 ResultMessage.usage (direct): {usage_data}")
        
        # Also check if usage is nested in data attribute
        if not usage_data and hasattr(message, 'data'):
            data = getattr(message, 'data', {})
            if isinstance(data, dict) and 'usage' in data:
                usage_data = data.get('usage')
                logger.info(f"📊 ResultMessage.data.usage: {usage_data}")
        
        # Convert to dict if needed
        if usage_data:
            if isinstance(usage_data, dict):
                usage_data = dict(usage_data)  # Make a copy
            else:
                usage_data = {'raw': str(usage_data)}
        
        # Also extract total_cost_usd for the adapter
        total_cost = None
        if hasattr(message, 'total_cost_usd'):
            total_cost = getattr(message, 'total_cost_usd', None)
            logger.info(f"💰 ResultMessage.total_cost_usd: {total_cost}")
        
        # Store in adapter for later use
        if usage_data:
            self.adapter._result_message_usage = usage_data
        if total_cost:
            self.adapter._result_message_cost = total_cost
        
        # Extract session_id from ResultMessage if available
        # According to test_multiconv.py, ResultMessage has session_id attribute
        session_id = getattr(message, 'session_id', None)
        
        data = {
            'subtype': getattr(message, 'subtype', None),
            'duration_ms': getattr(message, 'duration_ms', None),
            'is_error': getattr(message, 'is_error', False),
        }
        if usage_data:
            data['usage'] = usage_data
        if total_cost is not None:
            data['total_cost_usd'] = total_cost
        # Include session_id if present
        if session_id:
            data['session_id'] = session_id
        # Include result if available
        result = getattr(message, 'result', None)
        if result is not None:
            data['result'] = result
        
        yield CustomEvent(
            type='ResultMessage',
            data=data
        )


class ToolMessageConverter(MessageConverter):
    """Converts ToolMessage to ToolCallResult."""
    
    def can_handle(self, message: Any) -> bool:
        msg_type = getattr(message, 'type', type(message).__name__)
        return msg_type in ('ToolMessage', 'FunctionMessage', 'ToolResultMessage')
    
    async def convert(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        tool_call_id = getattr(message, 'tool_call_id', getattr(message, 'id', str(uuid.uuid4())))
        content = getattr(message, 'content', getattr(message, 'result', ''))
        is_error = bool(getattr(message, 'is_error', False) or False)
        
        yield ToolCallResult(
            message_id=str(uuid.uuid4()),
            tool_call_id=tool_call_id,
            content=str(content),
            is_error=is_error
        )


class ContentBlockConverter:
    """Converts content blocks to events."""
    
    def __init__(self):
        self.converters: Dict[str, Callable] = {
            'thinking': self._convert_thinking,
            'text': self._convert_text,
            'tool_use': self._convert_tool_use,
            'tool_result': self._convert_tool_result,
        }
    
    async def convert(self, block: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a content block to events."""
        block_type = getattr(block, 'type', None)
        block_class_name = type(block).__name__
        
        # Try type-based conversion
        if block_type and block_type in self.converters:
            async for event in self.converters[block_type](block):
                yield event
            return
        
        # Try class-name-based conversion
        if block_class_name == 'ThinkingBlock' or hasattr(block, 'thinking'):
            async for event in self._convert_thinking(block):
                yield event
        elif block_class_name == 'TextBlock' or hasattr(block, 'text'):
            async for event in self._convert_text(block):
                yield event
        elif block_class_name == 'ToolUseBlock' or (hasattr(block, 'name') and hasattr(block, 'input') and hasattr(block, 'id')):
            async for event in self._convert_tool_use(block):
                yield event
        elif block_class_name == 'ToolResultBlock' or (hasattr(block, 'tool_use_id') and hasattr(block, 'content')):
            async for event in self._convert_tool_result(block):
                yield event
        else:
            logger.warning(f"Unrecognized content block type: {block_type}, block: {block}")
            yield CustomEvent(
                type='UnknownBlock',
                data={
                    'block_type': block_type,
                    'block_repr': str(block)
                }
            )
    
    async def _convert_thinking(self, block: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert ThinkingBlock to events."""
        thinking_id = str(uuid.uuid4())
        thinking_text = getattr(block, 'thinking', '')
        
        yield ThinkingStart(thinking_id=thinking_id)
        async for event in self._stream_text(thinking_text, lambda chunk: ThinkingContent(thinking_id=thinking_id, delta=chunk)):
            yield event
        yield ThinkingEnd(thinking_id=thinking_id)
    
    async def _convert_text(self, block: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert TextBlock to events."""
        message_id = str(uuid.uuid4())
        text = getattr(block, 'text', '')
        
        yield TextMessageStart(message_id=message_id, role='assistant')
        async for event in self._stream_text(text, lambda chunk: TextMessageContent(message_id=message_id, delta=chunk)):
            yield event
        yield TextMessageEnd(message_id=message_id)
    
    async def _convert_tool_use(self, block: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert ToolUseBlock to events."""
        tool_call_id = getattr(block, 'id', str(uuid.uuid4()))
        tool_name = getattr(block, 'name', 'unknown')
        tool_input = getattr(block, 'input', {})
        input_str = str(tool_input)
        
        yield ToolCallStart(tool_call_id=tool_call_id, tool_call_name=tool_name)
        async for event in self._stream_text(input_str, lambda chunk: ToolCallArgs(tool_call_id=tool_call_id, delta=chunk)):
            yield event
        yield ToolCallEnd(tool_call_id=tool_call_id)
    
    async def _convert_tool_result(self, block: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert ToolResultBlock to events."""
        tool_call_id = getattr(block, 'tool_use_id', str(uuid.uuid4()))
        content = getattr(block, 'content', '')
        is_error = bool(getattr(block, 'is_error', False) or False)
        
        yield ToolCallResult(
            message_id=str(uuid.uuid4()),
            tool_call_id=tool_call_id,
            content=str(content),
            is_error=is_error
        )
    
    async def _stream_text(self, text: str, event_factory: Callable[[str], AgentEvent]) -> AsyncGenerator[AgentEvent, None]:
        """Helper to stream text content in chunks."""
        for i in range(0, len(text), STREAMING_CHUNK_SIZE):
            chunk = text[i:i+STREAMING_CHUNK_SIZE]
            yield event_factory(chunk)
            await asyncio.sleep(STREAMING_DELAY)


class ToolCallConverter:
    """Converts tool call objects to events."""
    
    async def convert(self, tool_call: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a tool call to events."""
        tool_call_id = getattr(tool_call, 'id', str(uuid.uuid4()))
        tool_name = getattr(tool_call, 'name', getattr(tool_call, 'function', {}).get('name', 'unknown'))
        tool_input = getattr(tool_call, 'input', getattr(tool_call, 'function', {}).get('arguments', {}))
        input_str = str(tool_input)
        
        yield ToolCallStart(tool_call_id=tool_call_id, tool_call_name=tool_name)
        
        # Stream args
        for i in range(0, len(input_str), STREAMING_CHUNK_SIZE):
            chunk = input_str[i:i+STREAMING_CHUNK_SIZE]
            yield ToolCallArgs(tool_call_id=tool_call_id, delta=chunk)
            await asyncio.sleep(STREAMING_DELAY)
        
        yield ToolCallEnd(tool_call_id=tool_call_id)


class EventAdapter:
    """Converts claude_agent_sdk messages to AG-UI events."""
    
    def __init__(self):
        self.run_id = str(uuid.uuid4())
        self.processed_message_ids: set[str] = set()  # Track processed message IDs for cost tracking
        self.step_usages: list[Dict[str, Any]] = []  # Track usage per step
        self._result_message_usage: Optional[Dict[str, Any]] = None  # Store usage from ResultMessage
        self._result_message_cost: Optional[float] = None  # Store cost from ResultMessage
        
        # Initialize converters
        content_block_converter = ContentBlockConverter()
        tool_call_converter = ToolCallConverter()
        
        # Register message converters
        self.message_converters: list[MessageConverter] = [
            SystemMessageConverter(),
            UserMessageConverter(content_block_converter),
            AssistantMessageConverter(content_block_converter, tool_call_converter),
            ResultMessageConverter(self),  # Pass adapter reference for usage tracking
            ToolMessageConverter(),
        ]
    
    async def adapt_message_stream(
        self, 
        message_stream: AsyncGenerator
    ) -> AsyncGenerator[AgentEvent, None]:
        """Convert a stream of SDK messages to AG-UI events."""
        yield RunStarted(run_id=self.run_id)
        
        total_cost_usd = 0.0
        total_usage = None
        
        try:
            async for message in message_stream:
                msg_type = type(message).__name__
                logger.debug(f"📨 Processing message type: {msg_type}")
                
                # Track usage from AssistantMessage (avoid duplicate counting)
                self._track_usage(message)
                
                # Extract total cost from ResultMessage
                if msg_type == 'ResultMessage':
                    logger.info(f"📊 Processing ResultMessage")
                    logger.debug(f"📊 ResultMessage attributes: {dir(message)}")
                    
                    # Check for total_cost_usd
                    if hasattr(message, 'total_cost_usd'):
                        cost_val = getattr(message, 'total_cost_usd', None)
                        logger.info(f"💰 ResultMessage.total_cost_usd = {cost_val}")
                        if cost_val:
                            total_cost_usd = cost_val
                    
                    # Check for usage
                    if hasattr(message, 'usage'):
                        usage_val = getattr(message, 'usage', None)
                        logger.info(f"📊 ResultMessage.usage = {usage_val}")
                        if usage_val:
                            total_usage = usage_val if isinstance(usage_val, dict) else dict(usage_val)
                    
                    # Also check if usage is in a different attribute
                    logger.debug(f"📊 ResultMessage full object: {message}")
                
                async for event in self._convert_message(message):
                    yield event
            
            # Use ResultMessage usage if available (most authoritative)
            if self._result_message_usage:
                total_usage = self._result_message_usage
                logger.info(f"📊 Using usage from ResultMessage: {total_usage}")
            elif self.step_usages:
                total_usage = self._aggregate_usage()
                logger.info(f"📊 Aggregated usage from steps: {total_usage}")
            
            # Use ResultMessage cost if available
            if self._result_message_cost:
                total_cost_usd = self._result_message_cost
                logger.info(f"💰 Using cost from ResultMessage: {total_cost_usd}")
            
            logger.info(f"💰 Final cost tracking: total_cost_usd={total_cost_usd}, usage={total_usage}")
            yield RunFinished(
                run_id=self.run_id,
                total_cost_usd=total_cost_usd if total_cost_usd > 0 else None,
                usage=total_usage
            )
        except Exception as e:
            yield RunError(
                run_id=self.run_id,
                error=str(e),
                error_type=type(e).__name__
            )
    
    def _track_usage(self, message: Any) -> None:
        """Track usage from AssistantMessage, avoiding duplicate counting."""
        # Check if it's an AssistantMessage by type name (more flexible)
        msg_type = getattr(message, 'type', type(message).__name__)
        class_name = type(message).__name__
        
        # Check both type attribute and class name
        is_assistant = msg_type == 'AssistantMessage' or class_name == 'AssistantMessage'
        
        if not is_assistant:
            return
        
        logger.debug(f"📊 Found AssistantMessage, checking for usage...")
        logger.debug(f"📊 AssistantMessage attributes: {[attr for attr in dir(message) if not attr.startswith('_')]}")
        
        # Check for usage attribute
        if not hasattr(message, 'usage'):
            logger.debug(f"📊 AssistantMessage has no 'usage' attribute")
            return
        
        usage = getattr(message, 'usage', None)
        if not usage:
            logger.debug(f"📊 AssistantMessage.usage is None or empty")
            return
        
        # Get message ID
        message_id = getattr(message, 'id', None)
        if not message_id:
            # Try alternative ID attributes
            message_id = getattr(message, 'message_id', None) or str(uuid.uuid4())
            logger.debug(f"📊 Using generated message_id: {message_id}")
        
        # Skip if already processed (same ID = same usage per docs)
        if message_id in self.processed_message_ids:
            logger.debug(f"📊 Message {message_id} already processed, skipping")
            return
        
        # Mark as processed and record usage
        self.processed_message_ids.add(message_id)
        
        # Convert usage to dict if needed
        if isinstance(usage, dict):
            usage_dict = dict(usage)
        else:
            usage_dict = {'raw': str(usage)}
        
        logger.info(f"📊 Tracking usage for message {message_id}: {usage_dict}")
        self.step_usages.append({
            'message_id': message_id,
            'usage': usage_dict,
        })
    
    def _aggregate_usage(self) -> Optional[Dict[str, Any]]:
        """Aggregate usage from all steps."""
        if not self.step_usages:
            return None
        
        aggregated = {
            'input_tokens': 0,
            'output_tokens': 0,
            'cache_creation_input_tokens': 0,
            'cache_read_input_tokens': 0,
        }
        
        for step in self.step_usages:
            usage = step.get('usage', {})
            if isinstance(usage, dict):
                aggregated['input_tokens'] += usage.get('input_tokens', 0)
                aggregated['output_tokens'] += usage.get('output_tokens', 0)
                aggregated['cache_creation_input_tokens'] += usage.get('cache_creation_input_tokens', 0)
                aggregated['cache_read_input_tokens'] += usage.get('cache_read_input_tokens', 0)
        
        return aggregated
    
    async def _convert_message(self, message: Any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a single message to events using registered converters."""
        # Try each converter until one can handle it
        for converter in self.message_converters:
            if converter.can_handle(message):
                async for event in converter.convert(message):
                    yield event
                return
        
        # Fallback: emit as custom event
        msg_type = getattr(message, 'type', type(message).__name__)
        logger.warning(f"Unrecognized message type: {msg_type}")
        yield CustomEvent(
            type=msg_type,
            data={'raw': str(message)}
        )

