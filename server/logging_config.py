"""Logging configuration for the application."""
import logging
import sys
from pathlib import Path
from datetime import datetime

def setup_logging(log_level: str = "INFO") -> None:
    """Set up logging configuration."""
    
    # Create logs directory
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    # Configure logging format with more detail
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s'
    )
    
    # Console handler with color coding
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # File handler with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_handler = logging.FileHandler(log_dir / f"app_{timestamp}.log")
    file_handler.setFormatter(formatter)
    
    # Agents-specific file handler
    agents_handler = logging.FileHandler(log_dir / f"agents_{timestamp}.log")
    agents_handler.setFormatter(formatter)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        handlers=[console_handler, file_handler],
        force=True
    )
    
    # Set up agents logger specifically
    agents_logger = logging.getLogger("agents")
    agents_logger.addHandler(agents_handler)
    agents_logger.setLevel(logging.DEBUG)
    
    # Set specific loggers
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
