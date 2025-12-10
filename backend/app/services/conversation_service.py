"""
Conversation business logic service.
"""
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.services.task_service import TaskService


class ConversationService:
    """Service for conversation-related operations."""
    
    @staticmethod
    def create_user_message(
        db: Session,
        task_id: int,
        content: str
    ) -> Conversation:
        """Create a user message."""
        message = Conversation(
            task_id=task_id,
            role='user',
            content=content
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
    
    @staticmethod
    def create_assistant_message(
        db: Session,
        task_id: int,
        content: str,
        cost_usd: Optional[float] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        usage_data: Optional[Dict[str, Any]] = None
    ) -> Conversation:
        """Create an assistant message with usage information."""
        message = Conversation(
            task_id=task_id,
            role='assistant',
            content=content,
            cost_usd=cost_usd,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            usage_data=usage_data
        )
        db.add(message)
        
        # Update task cumulative usage
        if cost_usd or input_tokens or output_tokens:
            TaskService.update_task_usage(
                db,
                task_id,
                cost_usd=cost_usd,
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
        
        # Update task updated_at
        task = TaskService.get_task(db, task_id)
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
        return message
