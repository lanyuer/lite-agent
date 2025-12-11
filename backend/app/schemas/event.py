"""
Event-related Pydantic schemas.
"""
from pydantic import BaseModel, Field
from typing import Dict, Any
from datetime import datetime


class EventResponse(BaseModel):
    """Response schema for event."""
    id: int
    task_id: str
    event_type: str
    event_data: Dict[str, Any]
    sequence: int
    created_at: datetime
    
    class Config:
        from_attributes = True
