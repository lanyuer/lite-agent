"""
FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.v1.router import api_router, legacy_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - initialize database on startup."""
    # Initialize database
    init_db()
    yield
    # Cleanup on shutdown (if needed)


# Create FastAPI app
app = FastAPI(
    title="Lite Agent API",
    description="Event-driven agent API with AG-UI protocol",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router)  # New v1 API
app.include_router(legacy_router)  # Legacy routes for backward compatibility


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Lite Agent API is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )
