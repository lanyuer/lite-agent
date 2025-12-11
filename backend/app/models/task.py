"""
Task database model.
"""
import uuid
from sqlalchemy import Column, String, DateTime, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Task(Base):
    """Task model - represents a conversation session."""
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String(255), nullable=False)
    session_id = Column(String(255), unique=True, nullable=True, index=True)  # Claude session ID
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Cumulative usage tracking
    total_cost_usd = Column(Float, default=0.0, nullable=False)  # Cumulative cost
    total_input_tokens = Column(Integer, default=0, nullable=False)  # Cumulative input tokens
    total_output_tokens = Column(Integer, default=0, nullable=False)  # Cumulative output tokens
    
    # Relationship to conversations
    conversations = relationship("Conversation", back_populates="task", cascade="all, delete-orphan")
    # Relationship to events
    events = relationship("Event", back_populates="task", cascade="all, delete-orphan", order_by="Event.sequence")
    
    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', session_id='{self.session_id}')>"
