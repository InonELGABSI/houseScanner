"""Custom user checklist loader for simulation mode."""
from __future__ import annotations

import json
import logging
from typing import Dict, Any

from app.infrastructure.cache.redis_cache import RedisCache
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class CustomUserLoader:
    """Loader for custom user checklist used in simulation mode."""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.settings = get_settings()
        self._cache_key = "housecheck:v1:custom_user_checklist"
    
    async def get_custom_user_checklist(self) -> Dict[str, Any]:
        """
        Get custom user checklist with caching.
        
        This returns user custom requirements that override or extend
        base checklists. Used primarily in simulation mode.
        
        Returns:
            Custom user checklist with sections:
            - global: items applied to all contexts
            - house_level: house-specific custom items
            - room_level: room-specific custom items by room_id
            - product_level: product-specific custom items
        """
        # Try cache first
        try:
            cached_data = await self.cache.get(self._cache_key)
            if cached_data:
                logger.debug("📦 Custom user checklist loaded from cache")
                return cached_data
        except Exception as e:
            logger.warning(f"Cache read failed for custom user checklist: {e}")
        
        # Load from file
        try:
            file_path = self.settings.DATA_DIR / "custom_user_checklist.json"
            
            if not file_path.exists():
                logger.info(f"Custom user checklist file not found: {file_path}, using empty default")
                return self._get_empty_custom_checklist()
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Validate and normalize structure
            normalized_data = self._normalize_custom_checklist(data)
            
            # Cache the result
            try:
                await self.cache.set(
                    self._cache_key, 
                    normalized_data, 
                    expire_seconds=self.settings.CACHE_EXPIRE_SECONDS
                )
                logger.debug("📦 Custom user checklist cached successfully")
            except Exception as e:
                logger.warning(f"Cache write failed for custom user checklist: {e}")
            
            logger.info("📄 Custom user checklist loaded successfully")
            return normalized_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in custom user checklist: {e}")
            return self._get_empty_custom_checklist()
        except Exception as e:
            logger.error(f"Failed to load custom user checklist: {e}")
            return self._get_empty_custom_checklist()
    
    async def get_house_custom_items(self) -> list[Dict[str, Any]]:
        """Get custom items for house-level analysis."""
        custom_checklist = await self.get_custom_user_checklist()
        items = []
        items.extend(custom_checklist.get("global", []))
        items.extend(custom_checklist.get("house_level", []))
        return items
    
    async def get_room_custom_items(self, room_id: str) -> list[Dict[str, Any]]:
        """Get custom items for specific room analysis."""
        custom_checklist = await self.get_custom_user_checklist()
        items = []
        items.extend(custom_checklist.get("global", []))
        
        # Find room-specific items
        for entry in custom_checklist.get("room_level", []):
            if entry.get("room_id") == room_id:
                items.extend(entry.get("custom_items", []))
        
        return items
    
    async def get_product_custom_items(self, room_id: str = None) -> list[Dict[str, Any]]:
        """Get custom items for product analysis."""
        custom_checklist = await self.get_custom_user_checklist()
        items = []
        items.extend(custom_checklist.get("global", []))
        items.extend(custom_checklist.get("product_level", []))
        
        # Add room-specific product items if room_id provided
        if room_id:
            for entry in custom_checklist.get("room_level", []):
                if entry.get("room_id") == room_id:
                    items.extend(entry.get("product_items", []))
        
        return items
    
    async def invalidate_cache(self) -> None:
        """Invalidate cached custom user checklist."""
        try:
            await self.cache.delete(self._cache_key)
            logger.info("🗑️ Custom user checklist cache invalidated")
        except Exception as e:
            logger.warning(f"Failed to invalidate custom user checklist cache: {e}")
    
    def _normalize_custom_checklist(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize custom checklist structure to expected format.
        
        Args:
            data: Raw custom checklist data
            
        Returns:
            Normalized custom checklist
        """
        if not isinstance(data, dict):
            logger.warning("Custom checklist is not a JSON object, using empty default")
            return self._get_empty_custom_checklist()
        
        normalized = {
            "global": data.get("global", []),
            "house_level": data.get("house_level", []),
            "room_level": data.get("room_level", []),
            "product_level": data.get("product_level", [])
        }
        
        # Validate room_level structure
        if not isinstance(normalized["room_level"], list):
            logger.warning("Invalid room_level structure in custom checklist")
            normalized["room_level"] = []
        
        # Ensure room_level items have proper structure
        valid_room_entries = []
        for entry in normalized["room_level"]:
            if isinstance(entry, dict) and "room_id" in entry:
                # Ensure custom_items and product_items are lists
                if "custom_items" not in entry or not isinstance(entry["custom_items"], list):
                    entry["custom_items"] = []
                if "product_items" not in entry or not isinstance(entry["product_items"], list):
                    entry["product_items"] = []
                valid_room_entries.append(entry)
        
        normalized["room_level"] = valid_room_entries
        
        return normalized
    
    def _get_empty_custom_checklist(self) -> Dict[str, Any]:
        """Get empty default custom checklist structure."""
        return {
            "global": [],
            "house_level": [],
            "room_level": [],
            "product_level": []
        }