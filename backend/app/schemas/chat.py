"""
Chat-related Pydantic schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional


class ResponseRequest(BaseModel):
    """Request schema for chat response."""
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Claude session ID for resuming conversation")
    task_id: Optional[str] = Field(None, description="Task ID (UUID) for persistence")
