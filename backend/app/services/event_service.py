"""
Event business logic service.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.event import Event


class EventService:
    """Service for event-related operations."""
    
    @staticmethod
    def _serialize_for_json(obj: Any) -> Any:
        """Recursively serialize objects for JSON storage, converting datetime to ISO strings."""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: EventService._serialize_for_json(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [EventService._serialize_for_json(item) for item in obj]
        else:
            return obj
    
    @staticmethod
    def save_event(
        db: Session,
        task_id: str,
        event_type: str,
        event_data: Dict[str, Any],
        sequence: int
    ) -> Event:
        """Save an event to database."""
        # Serialize datetime objects to ISO format strings for JSON storage
        serialized_data = EventService._serialize_for_json(event_data)
        
        event = Event(
            task_id=task_id,
            event_type=event_type,
            event_data=serialized_data,
            sequence=sequence
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
    
    @staticmethod
    def get_task_events(db: Session, task_id: str) -> List[Event]:
        """Get all events for a task, ordered by sequence."""
        return db.query(Event).filter(
            Event.task_id == task_id
        ).order_by(Event.sequence.asc()).all()
    
    @staticmethod
    def get_max_sequence(db: Session, task_id: str) -> int:
        """Get the maximum sequence number for a task. Returns -1 if no events exist."""
        result = db.query(func.max(Event.sequence)).filter(
            Event.task_id == task_id
        ).scalar()
        return result if result is not None else -1
