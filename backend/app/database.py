"""
Database configuration and session management.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import os

# Database URL - SQLite for now, easy to switch to PostgreSQL later
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lite_agent.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# get_db moved to app.dependencies for better organization


def init_db():
    """Initialize database - create all tables."""
    Base.metadata.create_all(bind=engine)
