"""Main FastAPI application entry point."""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import routes_scan, routes_simulate
from app.core.settings import get_settings
from app.core.lifespan import init_application, cleanup_application

# Configure detailed logging for terminal output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
    force=True  # Override any existing configuration
)

# Set specific loggers to INFO to see all agent flow details
logging.getLogger('app.application.use_cases').setLevel(logging.INFO)
logging.getLogger('app.infrastructure.llm.agents').setLevel(logging.INFO)
logging.getLogger('app.application.services.cost_manager').setLevel(logging.INFO)
logging.getLogger('app.domain.policies').setLevel(logging.INFO)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager."""
    logger.info("🚀 Starting HouseCheck application")
    
    # Initialize application dependencies
    await init_application()
    
    yield
    
    # Cleanup on shutdown
    logger.info("🔄 Shutting down HouseCheck application")
    await cleanup_application()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="HouseCheck API",
        description="Advanced house inspection and scanning service",
        version="2.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(
        routes_scan.router,
        prefix="/v1/scan",
        tags=["scan"]
    )
    app.include_router(
        routes_simulate.router,
        prefix="/v1/simulate", 
        tags=["simulate"]
    )
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return JSONResponse({
            "status": "healthy",
            "service": "housecheck",
            "version": "2.0.0"
        })
    
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )