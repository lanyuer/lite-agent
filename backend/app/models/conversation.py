"""
Conversation database model.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Conversation(Base):
    """Conversation model - represents a single message in a task."""
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), ForeignKey("tasks.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Usage information for this message (only for assistant messages)
    cost_usd = Column(Float, nullable=True)  # Cost for this message
    input_tokens = Column(Integer, nullable=True)  # Input tokens for this message
    output_tokens = Column(Integer, nullable=True)  # Output tokens for this message
    usage_data = Column(JSON, nullable=True)  # Full usage data as JSON
    
    # Relationship to task
    task = relationship("Task", back_populates="conversations")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, task_id={self.task_id}, role='{self.role}')>"
