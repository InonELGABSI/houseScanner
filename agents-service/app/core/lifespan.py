"""Application lifecycle management."""
from __future__ import annotations

import asyncio
import logging

from app.core.settings import get_settings
from app.infrastructure.cache.redis_cache import RedisCache

logger = logging.getLogger(__name__)


async def init_application():
    """Initialize application on startup."""
    settings = get_settings()
    
    # Validate required settings
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # Initialize Redis cache
    try:
        cache = RedisCache()
        await cache.connect()
        logger.info("✅ Redis cache connection established")
    except Exception as e:
        logger.warning(f"⚠️ Redis cache connection failed: {e}")
        logger.info("📝 Application will run without caching")
    
    # Warm up base checklists cache
    try:
        from app.infrastructure.loaders.base_house_loader import BaseHouseLoader
        from app.infrastructure.loaders.base_rooms_loader import BaseRoomsLoader
        from app.infrastructure.loaders.base_products_loader import BaseProductsLoader
        
        house_loader = BaseHouseLoader(cache)
        rooms_loader = BaseRoomsLoader(cache)
        products_loader = BaseProductsLoader(cache)
        
        # Preload base checklists
        await asyncio.gather(
            house_loader.get_base_house_checklist(),
            rooms_loader.get_base_room_checklist([]),
            products_loader.get_base_product_checklist([]),
        )
        logger.info("✅ Base checklists warmed up in cache")
    except Exception as e:
        logger.warning(f"⚠️ Failed to warm up base checklists: {e}")
    
    logger.info("🚀 Application initialized successfully")


async def cleanup_application():
    """Cleanup application on shutdown."""
    try:
        cache = RedisCache()
        await cache.disconnect()
        logger.info("✅ Redis cache connection closed")
    except Exception as e:
        logger.warning(f"⚠️ Error closing Redis connection: {e}")
    
    logger.info("🔄 Application cleanup completed")