"""Base products checklist loader with caching."""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional

from app.infrastructure.cache.redis_cache import RedisCache
from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class BaseProductsLoader:
    """Loader for base products checklist with Redis caching."""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
        self.settings = get_settings()
        self._cache_key = "housecheck:v1:base_products_checklist"
    
    async def get_base_product_checklist(self, room_types: List[str] = None) -> Dict[str, Any]:
        """
        Get base product checklist with caching.
        
        Returns global product checklist that can be filtered by room types
        or product categories as needed.
        
        Args:
            room_types: Optional list of room types for context
            
        Returns:
            Base products checklist dictionary
        """
        # Try cache first
        try:
            cached_data = await self.cache.get(self._cache_key)
            if cached_data:
                logger.debug("📦 Products checklist loaded from cache")
                return cached_data
        except Exception as e:
            logger.warning(f"Cache read failed for products checklist: {e}")
        
        # Load from file
        try:
            file_path = self.settings.DATA_DIR / "products_type_checklist.json"
            
            if not file_path.exists():
                logger.error(f"Products checklist file not found: {file_path}")
                raise FileNotFoundError(f"Products checklist file not found: {file_path}")
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Validate structure
            if not isinstance(data, dict):
                raise ValueError("Products checklist must be a JSON object")
            
            if "default" not in data:
                logger.debug("Products checklist uses direct 'items' structure, normalizing to include 'default' section")
                data["default"] = {"items": []}
            
            # Products checklist might have different structure than rooms/house
            # It could be organized by product categories or be a flat list
            if "product_types" not in data and "categories" not in data:
                logger.info("Products checklist appears to be a simple default structure")
            
            # Cache the result
            try:
                await self.cache.set(
                    self._cache_key, 
                    data, 
                    expire_seconds=self.settings.CACHE_EXPIRE_SECONDS
                )
                logger.debug("📦 Products checklist cached successfully")
            except Exception as e:
                logger.warning(f"Cache write failed for products checklist: {e}")
            
            logger.info(f"📄 Products checklist loaded")
            return data
            
        except Exception as e:
            logger.error(f"Failed to load products checklist: {e}")
            raise
    
    async def get_product_checklist_for_room(
        self, 
        room_types: Optional[List[str]] = None,
        product_whitelist: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get product checklist items, optionally filtered by room context.
        
        Args:
            room_types: Optional room types for context-aware filtering
            product_whitelist: Optional list of allowed product categories
            
        Returns:
            List of product checklist items
        """
        base_data = await self.get_base_product_checklist()
        
        # Start with default items
        items = []
        if "default" in base_data and "items" in base_data["default"]:
            items.extend(base_data["default"]["items"])
        
        # Add category-specific items if structure supports it
        if "categories" in base_data and product_whitelist:
            for category in product_whitelist:
                if category in base_data["categories"]:
                    category_items = base_data["categories"][category].get("items", [])
                    items.extend(category_items)
        
        # Add product type-specific items if structure supports it
        if "product_types" in base_data and room_types:
            for room_type in room_types:
                if room_type in base_data["product_types"]:
                    type_items = base_data["product_types"][room_type].get("items", [])
                    items.extend(type_items)
        
        # Apply product whitelist filtering if provided
        if product_whitelist:
            items = [
                item for item in items 
                if item.get("category") in product_whitelist
            ]
        
        return self._deduplicate_items(items)
    
    async def invalidate_cache(self) -> None:
        """Invalidate cached products checklist."""
        try:
            await self.cache.delete(self._cache_key)
            logger.info("🗑️ Products checklist cache invalidated")
        except Exception as e:
            logger.warning(f"Failed to invalidate products checklist cache: {e}")
    
    def get_available_categories(self, checklist: Dict[str, Any] = None) -> List[str]:
        """
        Get list of available product categories.
        
        Args:
            checklist: Optional checklist data (if None, loads fresh)
            
        Returns:
            List of available product categories
        """
        if checklist is None:
            logger.warning("get_available_categories called without checklist data")
            return []
        
        categories = set()
        
        # Extract categories from default items
        default_items = checklist.get("default", {}).get("items", [])
        for item in default_items:
            category = item.get("category")
            if category:
                categories.add(category)
        
        # Extract from categories section if it exists
        if "categories" in checklist:
            categories.update(checklist["categories"].keys())
        
        return list(categories)
    
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