"""
Event handling utilities for processing and saving agent events.
"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from loguru import logger

from app.services.event_service import EventService
from app.services.conversation_service import ConversationService
from core.events import AgentEvent


class EventHelpers:
    """Helper functions for event processing."""
    
    @staticmethod
    def save_user_message_events(
        db: Session,
        task_id: str,
        user_message_id: str,
        message: str,
        start_sequence: int
    ) -> int:
        """
        Save user message events (Start, Content, End) to database.
        
        Args:
            db: Database session
            task_id: Task ID
            user_message_id: User message ID
            message: Message content
            start_sequence: Starting sequence number
            
        Returns:
            Next sequence number after saving all events
        """
        # Save user message to conversations table
        ConversationService.create_user_message(db, task_id, message)
        
        # Save user message events
        sequence = start_sequence
        EventService.save_event(
            db, task_id, 'TextMessageStart',
            {'message_id': user_message_id, 'role': 'user'},
            sequence
        )
        sequence += 1
        
        EventService.save_event(
            db, task_id, 'TextMessageContent',
            {'message_id': user_message_id, 'delta': message},
            sequence
        )
        sequence += 1
        
        EventService.save_event(
            db, task_id, 'TextMessageEnd',
            {'message_id': user_message_id},
            sequence
        )
        sequence += 1
        
        logger.info(
            f"✅ User message saved to task {task_id} "
            f"(sequence {start_sequence} to {sequence - 1})"
        )
        return sequence
    
    @staticmethod
    def prepare_event_data(event: AgentEvent) -> Dict[str, Any]:
        """
        Prepare event data for database storage.
        
        For CustomEvent types (SystemMessage, ResultMessage), only save the data field.
        For other events, save the full model_dump().
        
        Args:
            event: Agent event
            
        Returns:
            Dictionary ready for database storage
        """
        if event.type in ('SystemMessage', 'ResultMessage'):
            # CustomEvent has a 'data' field that contains the actual event data
            if hasattr(event, 'data'):
                return event.data if isinstance(event.data, dict) else {}
            else:
                return event.model_dump()
        else:
            return event.model_dump()
    
    @staticmethod
    def extract_session_id(event: AgentEvent) -> Optional[str]:
        """
        Extract session_id from SystemMessage or ResultMessage event.
        
        Args:
            event: Agent event
            
        Returns:
            Session ID if found, None otherwise
        """
        if not hasattr(event, 'data'):
            return None
        
        event_data = event.data
        if not isinstance(event_data, dict):
            return None
        
        # Check SystemMessage (subtype='init')
        if event.type == 'SystemMessage':
            if event_data.get('subtype') == 'init':
                # First check top-level session_id
                session_id = event_data.get('session_id')
                if session_id:
                    return session_id
                
                # Check nested data
                system_data = event_data.get('data', {})
                if isinstance(system_data, dict):
                    return system_data.get('session_id')
        
        # Check ResultMessage
        elif event.type == 'ResultMessage':
            return event_data.get('session_id')
        
        return None
    
    @staticmethod
    def collect_assistant_content(
        event: AgentEvent,
        assistant_message_id: Optional[str],
        content_parts: list[str]
    ) -> tuple[Optional[str], list[str]]:
        """
        Collect assistant message content from TextMessageContent events.
        
        Args:
            event: Current event
            assistant_message_id: Currently tracked assistant message ID
            content_parts: List of content parts collected so far
            
        Returns:
            Tuple of (assistant_message_id, content_parts)
        """
        # Track new assistant message
        if event.type == 'TextMessageStart' and hasattr(event, 'role'):
            if getattr(event, 'role') == 'assistant':
                assistant_message_id = getattr(event, 'message_id', None)
                content_parts = []  # Reset for new message
        
        # Collect content
        if event.type == 'TextMessageContent' and hasattr(event, 'message_id'):
            if assistant_message_id and getattr(event, 'message_id') == assistant_message_id:
                delta = getattr(event, 'delta', '')
                if delta:
                    content_parts.append(delta)
        
        return assistant_message_id, content_parts
    
    @staticmethod
    def extract_usage_info(event: AgentEvent) -> Dict[str, Any]:
        """
        Extract usage information from RunFinished event.
        
        Args:
            event: RunFinished event
            
        Returns:
            Dictionary with usage information
        """
        usage_info: Dict[str, Any] = {}
        
        if event.type == 'RunFinished':
            if hasattr(event, 'total_cost_usd'):
                usage_info['cost_usd'] = getattr(event, 'total_cost_usd')
            
            if hasattr(event, 'usage'):
                usage_data = getattr(event, 'usage', {})
                if isinstance(usage_data, dict):
                    usage_info['usage'] = usage_data
                    usage_info['input_tokens'] = (
                        usage_data.get('input_tokens') or 
                        usage_data.get('inputTokens')
                    )
                    usage_info['output_tokens'] = (
                        usage_data.get('output_tokens') or 
                        usage_data.get('outputTokens')
                    )
                    if 'cost_usd' not in usage_info:
                        usage_info['cost_usd'] = usage_data.get('total_cost_usd')
        
        return usage_info
