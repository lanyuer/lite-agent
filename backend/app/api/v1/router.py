"""
API v1 router - aggregates all v1 endpoints.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import tasks, response, files

# New v1 API router
api_router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(response.router, prefix="/response", tags=["response"])
api_router.include_router(files.router, tags=["files"])
