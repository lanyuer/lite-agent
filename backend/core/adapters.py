"""
Event adapter to convert claude_agent_sdk messages to AG-UI events.
"""

import uuid
import asyncio
from loguru import logger
from typing import AsyncGenerator
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


class EventAdapter:
    """Converts claude_agent_sdk messages to AG-UI events."""
    
    def __init__(self):
        self.run_id = str(uuid.uuid4())
        self.active_message_id: str | None = None
        self.active_tool_call_id: str | None = None
        self.active_thinking_id: str | None = None
        
    async def adapt_message_stream(
        self, 
        message_stream: AsyncGenerator
    ) -> AsyncGenerator[AgentEvent, None]:
        """
        Convert a stream of SDK messages to AG-UI events.
        
        Args:
            message_stream: Async generator of messages from claude_agent_sdk
            
        Yields:
            AgentEvent: Standardized events
        """
        # Emit run started
        yield RunStarted(run_id=self.run_id)
        
        try:
            async for message in message_stream:
                # Convert message to events
                async for event in self._convert_message(message):
                    yield event
                    
            # Emit run finished
            yield RunFinished(run_id=self.run_id)
            
        except Exception as e:
            # Emit run error
            yield RunError(
                run_id=self.run_id,
                error=str(e),
                error_type=type(e).__name__
            )
    
    async def _convert_message(self, message: any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a single message to one or more events."""
        
        msg_type = getattr(message, 'type', type(message).__name__)
        
        logger.debug(f"Converting message: type={msg_type}, message={message}")
        
        # Handle SystemMessage
        if msg_type == 'SystemMessage':
            yield CustomEvent(
                type='SystemMessage',
                data={
                    'subtype': getattr(message, 'subtype', None),
                    'data': getattr(message, 'data', {}),
                }
            )
            return
        
        # Handle UserMessage (SDK may return tool results as UserMessage)
        if msg_type == 'UserMessage':
            content = getattr(message, 'content', [])
            
            logger.debug(f"UserMessage content type: {type(content)}, length: {len(content) if isinstance(content, list) else 'N/A'}")
            
            if isinstance(content, list):
                for i, block in enumerate(content):
                    logger.debug(f"Processing UserMessage content block {i}/{len(content)}")
                    async for event in self._convert_content_block(block):
                        yield event
            elif isinstance(content, str):
                # User text message
                message_id = str(uuid.uuid4())
                yield TextMessageStart(message_id=message_id, role='user')
                yield TextMessageContent(message_id=message_id, delta=content)
                yield TextMessageEnd(message_id=message_id)
            return
        
        # Handle AssistantMessage
        if msg_type == 'AssistantMessage':
            content = getattr(message, 'content', [])
            
            logger.debug(f"AssistantMessage content type: {type(content)}, length: {len(content) if isinstance(content, list) else 'N/A'}")
            
            # Check for tool_calls attribute (some SDKs use this)
            if hasattr(message, 'tool_calls') and message.tool_calls:
                logger.info(f"Found tool_calls attribute: {message.tool_calls}")
                for tool_call in message.tool_calls:
                    async for event in self._convert_tool_call(tool_call):
                        yield event
            
            if isinstance(content, list):
                for i, block in enumerate(content):
                    logger.debug(f"Processing content block {i}/{len(content)}")
                    async for event in self._convert_content_block(block):
                        yield event
            elif isinstance(content, str):
                # Simple text message
                message_id = str(uuid.uuid4())
                yield TextMessageStart(message_id=message_id, role='assistant')
                yield TextMessageContent(message_id=message_id, delta=content)
                yield TextMessageEnd(message_id=message_id)
            return
        
        # Handle ResultMessage
        if msg_type == 'ResultMessage':
            yield CustomEvent(
                type='ResultMessage',
                data={
                    'subtype': getattr(message, 'subtype', None),
                    'duration_ms': getattr(message, 'duration_ms', None),
                    'is_error': getattr(message, 'is_error', False),
                    'result': getattr(message, 'result', None),
                }
            )
            return
        
        # Handle ToolMessage (some SDKs use this for tool results)
        if msg_type in ('ToolMessage', 'FunctionMessage', 'ToolResultMessage'):
            tool_call_id = getattr(message, 'tool_call_id', getattr(message, 'id', str(uuid.uuid4())))
            content = getattr(message, 'content', getattr(message, 'result', ''))
            # Ensure is_error is always a boolean (handle None case)
            is_error_raw = getattr(message, 'is_error', False)
            is_error = bool(is_error_raw) if is_error_raw is not None else False
            
            logger.info(f"Converting ToolMessage: tool_call_id={tool_call_id}")
            
            yield ToolCallResult(
                message_id=str(uuid.uuid4()),
                tool_call_id=tool_call_id,
                content=str(content),
                is_error=is_error
            )
            return
        
        # Fallback: emit as custom event
        logger.warning(f"Unrecognized message type: {msg_type}")
        yield CustomEvent(
            type=msg_type,
            data={'raw': str(message)}
        )
    
    async def _convert_tool_call(self, tool_call: any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a tool call object to events."""
        tool_call_id = getattr(tool_call, 'id', str(uuid.uuid4()))
        tool_name = getattr(tool_call, 'name', getattr(tool_call, 'function', {}).get('name', 'unknown'))
        tool_input = getattr(tool_call, 'input', getattr(tool_call, 'function', {}).get('arguments', {}))
        input_str = str(tool_input)
        
        logger.info(f"Converting tool_call: id={tool_call_id}, name={tool_name}")
        
        yield ToolCallStart(
            tool_call_id=tool_call_id,
            tool_call_name=tool_name
        )
        
        # Stream args
        chunk_size = 10
        for i in range(0, len(input_str), chunk_size):
            chunk = input_str[i:i+chunk_size]
            yield ToolCallArgs(tool_call_id=tool_call_id, delta=chunk)
            await asyncio.sleep(0.01)
            
        yield ToolCallEnd(tool_call_id=tool_call_id)
    
    async def _convert_content_block(self, block: any) -> AsyncGenerator[AgentEvent, None]:
        """Convert a content block to events."""
        
        block_type = getattr(block, 'type', None)
        block_class_name = type(block).__name__
        
        logger.info(f"Converting content block: type={block_type}, class={block_class_name}, block={block}")
        logger.debug(f"Block attributes: {dir(block)}")
        
        # Handle ThinkingBlock
        if block_type == 'thinking' or block_class_name == 'ThinkingBlock' or hasattr(block, 'thinking'):
            thinking_id = str(uuid.uuid4())
            thinking_text = getattr(block, 'thinking', '')
            
            yield ThinkingStart(thinking_id=thinking_id)
            
            # Stream thinking content in smaller chunks for better UX
            chunk_size = 10
            for i in range(0, len(thinking_text), chunk_size):
                chunk = thinking_text[i:i+chunk_size]
                yield ThinkingContent(thinking_id=thinking_id, delta=chunk)
                await asyncio.sleep(0.01)  # Small delay for smoother streaming
            
            yield ThinkingEnd(thinking_id=thinking_id)
            return
        
        # Handle TextBlock
        if block_type == 'text' or block_class_name == 'TextBlock' or hasattr(block, 'text'):
            message_id = str(uuid.uuid4())
            text = getattr(block, 'text', '')
            
            yield TextMessageStart(message_id=message_id, role='assistant')
            
            # Stream text content in smaller chunks for better UX
            chunk_size = 10
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i+chunk_size]
                yield TextMessageContent(message_id=message_id, delta=chunk)
                await asyncio.sleep(0.01)  # Small delay for smoother streaming
            
            yield TextMessageEnd(message_id=message_id)
            return
        
        # Handle ToolUseBlock
        if block_type == 'tool_use' or block_class_name == 'ToolUseBlock' or (hasattr(block, 'name') and hasattr(block, 'input') and hasattr(block, 'id')):
            tool_call_id = getattr(block, 'id', str(uuid.uuid4()))
            tool_name = getattr(block, 'name', 'unknown')
            tool_input = getattr(block, 'input', {})
            input_str = str(tool_input)
            
            logger.info(f"Processing ToolUseBlock: id={tool_call_id}, name={tool_name}")
            
            yield ToolCallStart(
                tool_call_id=tool_call_id,
                tool_call_name=tool_name
            )
            
            # Stream args
            chunk_size = 10
            for i in range(0, len(input_str), chunk_size):
                chunk = input_str[i:i+chunk_size]
                yield ToolCallArgs(tool_call_id=tool_call_id, delta=chunk)
                await asyncio.sleep(0.01)
                
            yield ToolCallEnd(tool_call_id=tool_call_id)
            return
        
        # Handle ToolResultBlock
        if block_type == 'tool_result' or block_class_name == 'ToolResultBlock' or (hasattr(block, 'tool_use_id') and hasattr(block, 'content')):
            tool_call_id = getattr(block, 'tool_use_id', str(uuid.uuid4()))
            content = getattr(block, 'content', '')
            # Ensure is_error is always a boolean (handle None case)
            is_error_raw = getattr(block, 'is_error', False)
            is_error = bool(is_error_raw) if is_error_raw is not None else False
            
            logger.info(f"Processing ToolResultBlock: tool_use_id={tool_call_id}, is_error={is_error}")
            
            yield ToolCallResult(
                message_id=str(uuid.uuid4()),
                tool_call_id=tool_call_id,
                content=str(content),
                is_error=is_error
            )
            return
        
        # Fallback: unrecognized block type
        logger.warning(f"Unrecognized content block type: {block_type}, block: {block}")
        yield CustomEvent(
            type='UnknownBlock',
            data={
                'block_type': block_type,
                'block_repr': str(block)
            }
        )
