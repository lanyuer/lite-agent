"""
Task business logic service.
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.task import Task
from app.models.conversation import Conversation
from app.schemas.task import TaskCreate, TaskUpdate


class TaskService:
    """Service for task-related operations."""
    
    @staticmethod
    def create_task(db: Session, task_data: TaskCreate) -> Task:
        """Create a new task."""
        if task_data.title:
            title = task_data.title
        else:
            # Generate default title based on current time
            now = datetime.now()
            title = f"对话 {now.strftime('%Y-%m-%d %H:%M')}"
        task = Task(title=title, session_id=None)
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def get_task(db: Session, task_id: str) -> Task:
        """Get a task by ID."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    
    @staticmethod
    def list_tasks(
        db: Session,
        skip: int = 0,
        limit: int = 100
    ) -> List[Task]:
        """List all tasks, ordered by updated_at descending."""
        return db.query(Task).order_by(Task.updated_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def update_task(db: Session, task_id: str, task_data: TaskUpdate) -> Task:
        """Update a task."""
        task = TaskService.get_task(db, task_id)
        
        if task_data.title is not None:
            task.title = task_data.title
        
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def delete_task(db: Session, task_id: str) -> None:
        """Delete a task and all its conversations."""
        task = TaskService.get_task(db, task_id)
        db.delete(task)
        db.commit()
    
    @staticmethod
    def get_task_conversations(db: Session, task_id: str) -> List[Conversation]:
        """Get all conversations for a task."""
        TaskService.get_task(db, task_id)  # Verify task exists
        return db.query(Conversation).filter(
            Conversation.task_id == task_id
        ).order_by(Conversation.created_at.asc()).all()
    
    @staticmethod
    def get_or_create_task_by_session(
        db: Session,
        session_id: Optional[str],
        title: Optional[str] = None
    ) -> Task:
        """Get task by session_id or create a new one."""
        if session_id:
            task = db.query(Task).filter(Task.session_id == session_id).first()
            if task:
                return task
        
        # Create new task
        if title:
            task_title = title
        else:
            # Generate default title based on current time
            now = datetime.now()
            task_title = f"对话 {now.strftime('%Y-%m-%d %H:%M')}"
        
        if len(task_title) > 50:
            task_title = task_title[:50] + "..."
        
        task = Task(title=task_title, session_id=session_id)
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def update_task_usage(
        db: Session,
        task_id: str,
        cost_usd: Optional[float] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None
    ) -> Task:
        """Update task cumulative usage."""
        task = TaskService.get_task(db, task_id)
        
        if cost_usd:
            task.total_cost_usd = (task.total_cost_usd or 0.0) + cost_usd
        if input_tokens:
            task.total_input_tokens = (task.total_input_tokens or 0) + input_tokens
        if output_tokens:
            task.total_output_tokens = (task.total_output_tokens or 0) + output_tokens
        
        db.commit()
        db.refresh(task)
        return task
