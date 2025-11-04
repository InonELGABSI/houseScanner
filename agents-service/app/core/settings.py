"""Application settings and configuration."""
from __future__ import annotations

import os
from pathlib import Path
from typing import List
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration settings."""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # Server Configuration
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = Field(..., env="OPENAI_API_KEY")
    VISION_MODEL: str = Field(default="gpt-4o-mini", env="VISION_MODEL")
    TEXT_MODEL: str = Field(default="gpt-4o-mini", env="TEXT_MODEL")
    
    # LangSmith Configuration (for tracing and visualization)
    LANGCHAIN_TRACING_V2: str = Field(default="true", env="LANGCHAIN_TRACING_V2")
    LANGCHAIN_ENDPOINT: str = Field(default="https://api.smith.langchain.com", env="LANGCHAIN_ENDPOINT")
    LANGCHAIN_API_KEY: str = Field(default="", env="LANGCHAIN_API_KEY")
    LANGCHAIN_PROJECT: str = Field(default="house-scanner-agents", env="LANGCHAIN_PROJECT")
    
    # Redis Configuration (for caching)
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    CACHE_EXPIRE_SECONDS: int = Field(default=3600, env="CACHE_EXPIRE_SECONDS")  # 1 hour
    
    # CORS Settings
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        env="CORS_ORIGINS"
    )
    
    # Image Processing Limits
    MAX_IMAGE_EDGE: int = Field(default=2048, env="MAX_IMAGE_EDGE")
    IMAGE_QUALITY: int = Field(default=85, env="IMAGE_QUALITY")
    MAX_IMAGES_PER_REQUEST: int = Field(default=50, env="MAX_IMAGES_PER_REQUEST")
    
    # Agent Configuration
    MAX_CLASSIFY_IMAGES: int = Field(default=4, env="MAX_CLASSIFY_IMAGES")
    MAX_CHECKLIST_IMAGES: int = Field(default=6, env="MAX_CHECKLIST_IMAGES")
    CLASSIFY_MAX_EDGE: int = Field(default=512, env="CLASSIFY_MAX_EDGE")
    CHECKLIST_MAX_EDGE: int = Field(default=768, env="CHECKLIST_MAX_EDGE")
    CLASSIFY_QUALITY: int = Field(default=70, env="CLASSIFY_QUALITY")
    CHECKLIST_QUALITY: int = Field(default=80, env="CHECKLIST_QUALITY")
    
    # Rate Limiting (Legacy - for sequential pipeline)
    THROTTLE_MS: int = Field(default=0, env="THROTTLE_MS")
    TOKEN_PACE_LIMIT: int = Field(default=160000, env="TOKEN_PACE_LIMIT")
    TOKEN_PACE_SLEEP: float = Field(default=8.0, env="TOKEN_PACE_SLEEP")
    
    # LangGraph Rate Limiting (for parallel pipeline)
    RATE_LIMIT_TPM: int = Field(default=90000, env="RATE_LIMIT_TPM")  # Tokens per minute
    RATE_LIMIT_RPM: int = Field(default=500, env="RATE_LIMIT_RPM")    # Requests per minute
    MAX_CONCURRENT_CALLS: int = Field(default=3, env="MAX_CONCURRENT_CALLS")  # Concurrent LLM calls
    
    # Retry Configuration
    EMPTY_RETRY: int = Field(default=1, env="EMPTY_RETRY")
    CHECKLIST_BATCH_SIZE: int = Field(default=6, env="CHECKLIST_BATCH_SIZE")
    
    # Security Configuration
    ALLOW_LOCALHOST_URLS: bool = Field(default=True, env="ALLOW_LOCALHOST_URLS")  # Enable for local dev
    
    # LangSmith Configuration (optional)
    LANGCHAIN_TRACING_V2: bool = Field(default=False, env="LANGCHAIN_TRACING_V2")
    LANGCHAIN_API_KEY: str = Field(default="", env="LANGCHAIN_API_KEY")
    LANGCHAIN_PROJECT: str = Field(default="house-check", env="LANGCHAIN_PROJECT")
    
    # Paths
    @property
    def PROJECT_ROOT(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent
    
    @property
    def DATA_DIR(self) -> Path:
        """Get data directory path."""
        return self.PROJECT_ROOT / "data"
    
    @property
    def DEMO_DIR(self) -> Path:
        """Get demo directory path."""
        return self.PROJECT_ROOT / "demo"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()