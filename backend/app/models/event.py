"""
Event database model for storing all agent events.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Event(Base):
    """Event model - stores all agent events (messages, thinking, tool calls, etc.)"""
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), ForeignKey("tasks.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # e.g., 'TextMessageStart', 'ThinkingStart', 'ToolCallStart'
    event_data = Column(JSON, nullable=False)  # Full event data as JSON
    sequence = Column(Integer, nullable=False, index=True)  # Event sequence number for ordering
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationship to task
    task = relationship("Task", back_populates="events")
    
    def __repr__(self):
        return f"<Event(id={self.id}, task_id={self.task_id}, event_type='{self.event_type}', sequence={self.sequence})>"
