"""
Agent interaction service for handling Claude SDK client and event streaming.
"""
from typing import Optional, Dict, Any, AsyncGenerator
from datetime import datetime
from loguru import logger
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from app.config import settings
from core.adapters import EventAdapter
from core.events import AgentEvent


class AgentService:
    """Service for agent-related operations."""
    
    @staticmethod
    def create_client_options(
        session_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        permission_mode: Optional[str] = None,
        cwd: Optional[str] = None
    ) -> ClaudeAgentOptions:
        """
        Create Claude agent options.
        
        Args:
            session_id: Session ID for resumption (optional)
            system_prompt: System prompt (optional, uses config default)
            permission_mode: Permission mode (optional, uses config default)
            cwd: Working directory (optional, uses config default)
            
        Returns:
            ClaudeAgentOptions instance
        """
        options_kwargs: Dict[str, Any] = {
            "system_prompt": system_prompt or settings.agent_system_prompt,
            "permission_mode": permission_mode or settings.agent_permission_mode,
            "cwd": cwd or settings.agent_cwd
        }
        
        if session_id:
            options_kwargs["resume"] = session_id
        
        return ClaudeAgentOptions(**options_kwargs)
    
    @staticmethod
    async def create_client(options: ClaudeAgentOptions) -> ClaudeSDKClient:
        """
        Create and connect Claude SDK client.
        
        Args:
            options: Claude agent options
            
        Returns:
            Connected ClaudeSDKClient instance
        """
        client = ClaudeSDKClient(options=options)
        await client.connect()
        return client
    
    @staticmethod
    def create_event_adapter() -> EventAdapter:
        """
        Create event adapter for converting SDK messages to AG-UI events.
        
        Returns:
            EventAdapter instance
        """
        return EventAdapter()
    
    @staticmethod
    def generate_user_message_id() -> str:
        """
        Generate a unique user message ID.
        
        Returns:
            User message ID string
        """
        return f"user-{int(datetime.now().timestamp() * 1000)}"
    
    @staticmethod
    async def stream_events(
        adapter: EventAdapter,
        client: ClaudeSDKClient
    ) -> AsyncGenerator[AgentEvent, None]:
        """
        Stream events from Claude SDK client through adapter.
        
        Args:
            adapter: Event adapter
            client: Claude SDK client
            
        Yields:
            AgentEvent instances
        """
        async for event in adapter.adapt_message_stream(client.receive_response()):
            yield event
