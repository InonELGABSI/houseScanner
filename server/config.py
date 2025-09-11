"""Configuration module for the house scanner application."""
import os
from typing import Optional

class Config:
    """Application configuration."""
    
    # API Configuration
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
    VISION_MODEL: str = os.environ.get("VISION_MODEL", "gpt-4o-mini")
    TEXT_MODEL: str = os.environ.get("TEXT_MODEL", "gpt-4o-mini")
    
    # Server Configuration
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "8000"))
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    
    # Image Processing
    MAX_IMAGE_EDGE: int = int(os.environ.get("MAX_IMAGE_EDGE", "2048"))
    IMAGE_QUALITY: int = int(os.environ.get("IMAGE_QUALITY", "85"))
    
    # API Limits
    MAX_IMAGES_PER_REQUEST: int = int(os.environ.get("MAX_IMAGES_PER_REQUEST", "50"))
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        if cls.MAX_IMAGES_PER_REQUEST <= 0:
            raise ValueError("MAX_IMAGES_PER_REQUEST must be positive")

# Global configuration instance
config = Config()
