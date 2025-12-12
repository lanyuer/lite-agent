"""
Session management service for handling Claude session IDs and task associations.
"""
from typing import Optional
from sqlalchemy.orm import Session
from loguru import logger

from app.models.task import Task


class SessionService:
    """Service for session-related operations."""
    
    @staticmethod
    def find_task_by_id_or_session(
        db: Session,
        task_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[Task]:
        """
        Find task by task_id or session_id.
        
        Args:
            db: Database session
            task_id: Task ID to search for
            session_id: Session ID to search for
            
        Returns:
            Task if found, None otherwise
        """
        if task_id:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                logger.info(f"📋 Found task by task_id: {task.id}, session_id={task.session_id}")
                return task
        
        if session_id:
            task = db.query(Task).filter(Task.session_id == session_id).first()
            if task:
                logger.info(f"📋 Found task by session_id: {task.id}")
                return task
            else:
                logger.info(f"📋 No task found for session_id: {session_id}")
        
        return None
    
    @staticmethod
    def determine_session_id(
        task: Optional[Task],
        request_session_id: Optional[str]
    ) -> Optional[str]:
        """
        Determine which session_id to use for resumption.
        
        Priority: task.session_id > request.session_id > None (new session)
        
        Args:
            task: Task object (may have session_id)
            request_session_id: Session ID from request
            
        Returns:
            Session ID to use, or None for new session
        """
        if task and task.session_id:
            logger.info(f"📤 Resuming session from task: {task.session_id} (task_id={task.id})")
            return task.session_id
        elif request_session_id:
            logger.info(f"📤 Resuming session from request: {request_session_id} (no task found)")
            return request_session_id
        else:
            logger.info(f"📤 Starting NEW session (no task_id, no session_id provided)")
            return None
    
    @staticmethod
    def update_task_session_id(
        db: Session,
        task: Task,
        new_session_id: str
    ) -> bool:
        """
        Update task with session_id, checking for conflicts.
        
        Args:
            db: Database session
            task: Task to update
            new_session_id: New session ID to set
            
        Returns:
            True if updated, False if conflict detected
        """
        if not task.session_id:
            # Check if session_id is already used by another task
            existing_task = db.query(Task).filter(
                Task.session_id == new_session_id,
                Task.id != task.id
            ).first()
            
            if existing_task:
                logger.error(
                    f"❌ ERROR: Session {new_session_id} already used by task {existing_task.id}!"
                )
                logger.error(f"❌ Current task: {task.id}, Existing task: {existing_task.id}")
                logger.error("❌ This indicates a logic error: new session_id conflicts with existing task")
                return False
            
            logger.info(f"💾 Saving session_id to task {task.id}")
            task.session_id = new_session_id
            db.commit()
            db.refresh(task)
            logger.info(f"✅ Task {task.id} now has session_id: {task.session_id}")
            return True
        elif task.session_id != new_session_id:
            logger.warning(
                f"⚠️ Task {task.id} session_id changed from {task.session_id} to {new_session_id}"
            )
            logger.warning("⚠️ This might indicate session_id extraction error or SDK behavior change")
            return False
        else:
            logger.info(f"ℹ️ Task {task.id} already has session_id: {task.session_id} (matches extracted)")
            return True
