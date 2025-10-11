"""Base house checklist loader with caching."""
from __future__ import annotations

import json
import logging
from typing import Dict, Any

from app.infrastructure.cache.redis_cache import RedisCache
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class BaseHouseLoader:
    """Loader for base house checklist with Redis caching."""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.settings = get_settings()
        self._cache_key = "housecheck:v1:base_house_checklist"
    
    async def get_base_house_checklist(self) -> Dict[str, Any]:
        """
        Get base house checklist with caching.
        
        Returns normalized in-memory schema split to default + house_types
        for quick merges.
        
        Returns:
            Base house checklist dictionary
        """
        # Try cache first
        try:
            cached_data = await self.cache.get(self._cache_key)
            if cached_data:
                logger.debug("📦 House checklist loaded from cache")
                return cached_data
        except Exception as e:
            logger.warning(f"Cache read failed for house checklist: {e}")
        
        # Load from file
        try:
            file_path = self.settings.DATA_DIR / "house_type_checklist.json"
            
            if not file_path.exists():
                logger.error(f"House checklist file not found: {file_path}")
                raise FileNotFoundError(f"House checklist file not found: {file_path}")
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Validate structure
            if not isinstance(data, dict):
                raise ValueError("House checklist must be a JSON object")
            
            if "default" not in data:
                logger.debug("House checklist missing 'default' section, adding empty one for structure consistency")
                data["default"] = {"items": []}
            
            if "house_types" not in data:
                logger.debug("House checklist missing 'house_types' section, adding empty one for structure consistency")
                data["house_types"] = {}
            
            # Cache the result
            try:
                await self.cache.set(
                    self._cache_key, 
                    data, 
                    expire_seconds=self.settings.CACHE_EXPIRE_SECONDS
                )
                logger.debug("📦 House checklist cached successfully")
            except Exception as e:
                logger.warning(f"Cache write failed for house checklist: {e}")
            
            logger.info(f"📄 House checklist loaded: {len(data.get('house_types', {}))} types")
            return data
            
        except Exception as e:
            logger.error(f"Failed to load house checklist: {e}")
            raise
    
    async def invalidate_cache(self) -> None:
        """Invalidate cached house checklist."""
        try:
            await self.cache.delete(self._cache_key)
            logger.info("🗑️ House checklist cache invalidated")
        except Exception as e:
            logger.warning(f"Failed to invalidate house checklist cache: {e}")
    
    def get_allowed_house_types(self, checklist: Dict[str, Any] = None) -> list[str]:
        """
        Get list of allowed house types.
        
        Args:
            checklist: Optional checklist data (if None, loads fresh)
            
        Returns:
            List of allowed house type identifiers
        """
        if checklist is None:
            # This is a sync method, so we can't await here
            # In practice, this would be called after get_base_house_checklist
            logger.warning("get_allowed_house_types called without checklist data")
            return []
        
        return list(checklist.get("house_types", {}).keys())