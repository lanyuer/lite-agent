"""
Task-related Pydantic schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.schemas.conversation import ConversationResponse


class TaskCreate(BaseModel):
    """Request schema for creating a task."""
    title: Optional[str] = Field(None, description="Task title")


class TaskUpdate(BaseModel):
    """Request schema for updating a task."""
    title: Optional[str] = Field(None, description="Task title")


class TaskResponse(BaseModel):
    """Response schema for task."""
    id: int
    title: str
    session_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_cost_usd: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    
    class Config:
        from_attributes = True


class TaskWithConversations(TaskResponse):
    """Task response schema with conversations."""
    conversations: List[ConversationResponse] = Field(default_factory=list)
