"""
Task management API endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskWithConversations,
)
from app.schemas.conversation import ConversationResponse
from app.services.task_service import TaskService

router = APIRouter()


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db)
):
    """Create a new task."""
    return TaskService.create_task(db, task_data)


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """List all tasks, ordered by updated_at descending."""
    return TaskService.list_tasks(db, skip=skip, limit=limit)


@router.get("/{task_id}", response_model=TaskWithConversations)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Get a task with its conversations."""
    return TaskService.get_task(db, task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db)
):
    """Update a task title."""
    return TaskService.update_task(db, task_id, task_data)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Delete a task and all its conversations."""
    TaskService.delete_task(db, task_id)
    return None


@router.get("/{task_id}/conversations", response_model=List[ConversationResponse])
async def get_task_conversations(
    task_id: int,
    db: Session = Depends(get_db)
):
    """Get all conversations for a task."""
    return TaskService.get_task_conversations(db, task_id)
