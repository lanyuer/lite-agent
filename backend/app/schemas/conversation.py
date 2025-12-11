"""
Conversation-related Pydantic schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ConversationResponse(BaseModel):
    """Response schema for conversation message."""
    id: int
    task_id: str
    role: str
    content: str
    created_at: datetime
    cost_usd: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    
    class Config:
        from_attributes = True
