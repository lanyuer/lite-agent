"""
Application configuration.
"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    
    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Agent SDK
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Agent Configuration
    agent_system_prompt: str = "You are an expert Python developer"
    agent_permission_mode: str = "acceptEdits"
    agent_cwd: str = os.getenv("AGENT_CWD", "/Users/chenjinsheng/github/lite-agent/backend/project")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
