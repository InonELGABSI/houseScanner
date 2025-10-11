"""Base rooms checklist loader with caching."""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List

from app.infrastructure.cache.redis_cache import RedisCache
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class BaseRoomsLoader:
    """Loader for base rooms checklist with Redis caching."""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.settings = get_settings()
        self._cache_key = "housecheck:v1:base_rooms_checklist"
    
    async def get_base_room_checklist(self, room_types: List[str] = None) -> Dict[str, Any]:
        """
        Get base room checklist with caching.
        
        Returns normalized schema with default + room_types sections
        for merging with detected room types.
        
        Args:
            room_types: Optional list of room types for filtering
            
        Returns:
            Base rooms checklist dictionary
        """
        # Try cache first
        try:
            cached_data = await self.cache.get(self._cache_key)
            if cached_data:
                logger.debug("📦 Rooms checklist loaded from cache")
                return cached_data
        except Exception as e:
            logger.warning(f"Cache read failed for rooms checklist: {e}")
        
        # Load from file
        try:
            file_path = self.settings.DATA_DIR / "rooms_type_checklist.json"
            
            if not file_path.exists():
                logger.error(f"Rooms checklist file not found: {file_path}")
                raise FileNotFoundError(f"Rooms checklist file not found: {file_path}")
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Validate structure
            if not isinstance(data, dict):
                raise ValueError("Rooms checklist must be a JSON object")
            
            if "default" not in data:
                logger.debug("Rooms checklist missing 'default' section, adding empty one for structure consistency")
                data["default"] = {"items": []}
            
            if "room_types" not in data:
                logger.debug("Rooms checklist missing 'room_types' section, adding empty one for structure consistency")
                data["room_types"] = {}
            
            # Cache the result
            try:
                await self.cache.set(
                    self._cache_key, 
                    data, 
                    expire_seconds=self.settings.CACHE_EXPIRE_SECONDS
                )
                logger.debug("📦 Rooms checklist cached successfully")
            except Exception as e:
                logger.warning(f"Cache write failed for rooms checklist: {e}")
            
            logger.info(f"📄 Rooms checklist loaded: {len(data.get('room_types', {}))} types")
            return data
            
        except Exception as e:
            logger.error(f"Failed to load rooms checklist: {e}")
            raise
    
    async def get_room_checklist_for_types(self, room_types: List[str]) -> List[Dict[str, Any]]:
        """
        Get merged room checklist items for specific room types.
        
        Args:
            room_types: List of room types to merge
            
        Returns:
            Merged list of checklist items
        """
        base_data = await self.get_base_room_checklist()
        
        # Start with default items
        items = []
        if "default" in base_data and "items" in base_data["default"]:
            items.extend(base_data["default"]["items"])
        
        # Add type-specific items
        room_types_data = base_data.get("room_types", {})
        for room_type in room_types:
            if room_type in room_types_data:
                type_items = room_types_data[room_type].get("items", [])
                items.extend(type_items)
        
        return self._deduplicate_items(items)
    
    async def invalidate_cache(self) -> None:
        """Invalidate cached rooms checklist."""
        try:
            await self.cache.delete(self._cache_key)
            logger.info("🗑️ Rooms checklist cache invalidated")
        except Exception as e:
            logger.warning(f"Failed to invalidate rooms checklist cache: {e}")
    
    def get_allowed_room_types(self, checklist: Dict[str, Any] = None) -> List[str]:
        """
        Get list of allowed room types.
        
        Args:
            checklist: Optional checklist data (if None, loads fresh)
            
        Returns:
            List of allowed room type identifiers
        """
        if checklist is None:
            logger.warning("get_allowed_room_types called without checklist data")
            return []
        
        return list(checklist.get("room_types", {}).keys())
    
    def _deduplicate_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate items by ID, keeping the last occurrence.
        
        Args:
            items: List of checklist items
            
        Returns:
            Deduplicated list of items
        """
        seen = set()
        deduplicated = []
        
        # Process in reverse to keep last occurrence
        for item in reversed(items):
            item_id = item.get("id")
            if item_id and item_id not in seen:
                deduplicated.append(item)
                seen.add(item_id)
        
        # Reverse back to original order
        return list(reversed(deduplicated))