"""Domain policies for checklist merging and business rules."""
from __future__ import annotations

from typing import Dict, List, Any, Set, Optional
import logging

from app.domain.models import ChecklistItem, ChecklistItemType

logger = logging.getLogger(__name__)


class ChecklistMergingPolicy:
    """Policies for merging base checklists with custom user requirements."""
    
    @staticmethod
    def merge_house_checklist(
        base_checklist: Dict[str, Any],
        house_types: List[str],
        custom_checklist: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Merge base house checklist with type-specific and custom items.
        
        Args:
            base_checklist: Base house checklist JSON
            house_types: Detected house types
            custom_checklist: User custom requirements
            
        Returns:
            Merged checklist items with duplicates removed
        """
        items = []
        
        # Add default items
        if "default" in base_checklist and "items" in base_checklist["default"]:
            items.extend(base_checklist["default"]["items"])
        
        # Add type-specific items
        if "house_types" in base_checklist:
            for house_type in house_types:
                if house_type in base_checklist["house_types"]:
                    type_items = base_checklist["house_types"][house_type].get("items", [])
                    items.extend(type_items)
        
        # Add custom items
        if custom_checklist:
            items.extend(custom_checklist.get("global", []))
            items.extend(custom_checklist.get("house_level", []))
        
        return ChecklistMergingPolicy._deduplicate_items(items)
    
    @staticmethod
    def merge_room_checklist(
        base_checklist: Dict[str, Any],
        room_types: List[str],
        room_id: str,
        custom_checklist: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Merge base room checklist with type-specific and custom items.
        
        Args:
            base_checklist: Base rooms checklist JSON
            room_types: Detected room types
            room_id: Specific room identifier
            custom_checklist: User custom requirements
            
        Returns:
            Merged checklist items with duplicates removed
        """
        items = []
        
        # Add default items
        if "default" in base_checklist and "items" in base_checklist["default"]:
            items.extend(base_checklist["default"]["items"])
        
        # Add type-specific items
        if "room_types" in base_checklist:
            for room_type in room_types:
                if room_type in base_checklist["room_types"]:
                    type_items = base_checklist["room_types"][room_type].get("items", [])
                    items.extend(type_items)
        
        # Add custom items
        if custom_checklist:
            items.extend(custom_checklist.get("global", []))
            
            # Add room-specific custom items
            for entry in custom_checklist.get("room_level", []):
                if entry.get("room_id") == room_id:
                    items.extend(entry.get("custom_items", []))
        
        return ChecklistMergingPolicy._deduplicate_items(items)
    
    @staticmethod
    def merge_product_checklist(
        base_checklist: Dict[str, Any],
        room_types: Optional[List[str]] = None,
        room_id: Optional[str] = None,
        custom_checklist: Optional[Dict[str, Any]] = None,
        product_whitelist: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Merge base product checklist with custom items and filtering.
        Matches original server logic exactly.
        
        Args:
            base_checklist: Base products checklist JSON
            room_types: Room types for context (optional filtering)
            room_id: Specific room identifier
            custom_checklist: User custom requirements
            product_whitelist: Allowed product categories
            
        Returns:
            Merged checklist items with duplicates removed
        """
        items = []
        
        # Original server expects products_json["items"] directly
        if "items" in base_checklist:
            items.extend(base_checklist["items"])
        elif "default" in base_checklist and "items" in base_checklist["default"]:
            items.extend(base_checklist["default"]["items"])
        
        # Apply room product whitelist filtering (original logic)
        if product_whitelist:
            items = [
                item for item in items 
                if item.get("id") in product_whitelist
            ]
        
        # Add custom product items (original logic)
        if custom_checklist:
            for entry in custom_checklist.get("product_level", []):
                pid = entry.get("product_id")
                for new_item in entry.get("custom_items", []):
                    cloned = dict(new_item)
                    cloned["id"] = f"{pid}__{cloned['id']}"
                    items.append(cloned)
        
        return ChecklistMergingPolicy._deduplicate_items(items)
    
    @staticmethod
    def _deduplicate_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate items by ID, keeping the last occurrence.
        
        Args:
            items: List of checklist items
            
        Returns:
            Deduplicated list of items
        """
        seen: Set[str] = set()
        deduplicated: List[Dict[str, Any]] = []
        
        # Process in reverse to keep last occurrence
        for item in reversed(items):
            item_id = item.get("id")
            if item_id and item_id not in seen:
                deduplicated.append(item)
                seen.add(item_id)
        
        # Reverse back to original order
        return list(reversed(deduplicated))


class BusinessRulesPolicy:
    """Business rules and validation policies."""
    
    @staticmethod
    def validate_house_types(house_types: List[str], allowed_types: List[str]) -> List[str]:
        """
        Validate and filter house types against allowed values.
        
        Args:
            house_types: Detected house types
            allowed_types: List of allowed house types
            
        Returns:
            Filtered list of valid house types
        """
        valid_types = [ht for ht in house_types if ht in allowed_types]
        
        if not valid_types and house_types:
            logger.warning(f"No valid house types found in {house_types}, allowed: {allowed_types}")
        
        return valid_types
    
    @staticmethod
    def validate_room_types(room_types: List[str], allowed_types: List[str]) -> List[str]:
        """
        Validate and filter room types against allowed values.
        
        Args:
            room_types: Detected room types
            allowed_types: List of allowed room types
            
        Returns:
            Filtered list of valid room types
        """
        valid_types = [rt for rt in room_types if rt in allowed_types]
        
        if not valid_types and room_types:
            logger.warning(f"No valid room types found in {room_types}, allowed: {allowed_types}")
        
        return valid_types
    
    @staticmethod
    def should_throttle_request(token_usage: int, limit: int) -> bool:
        """
        Determine if request should be throttled based on token usage.
        
        Args:
            token_usage: Current token usage
            limit: Token limit threshold
            
        Returns:
            True if request should be throttled
        """
        return token_usage >= limit