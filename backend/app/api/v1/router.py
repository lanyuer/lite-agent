"""
API v1 router - aggregates all v1 endpoints.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import tasks, chat, response

# New v1 API router
api_router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(response.router, prefix="/response", tags=["response"])

# Legacy routes for backward compatibility (same endpoints but without /v1)
legacy_router = APIRouter(prefix="/api")
legacy_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
legacy_router.include_router(chat.router, prefix="/chat", tags=["chat"])
legacy_router.include_router(response.router, prefix="/response", tags=["response"])
