"""API v1 request schemas."""
from __future__ import annotations

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


# Request Schemas
class ImageData(BaseModel):
    """Schema for image data in requests."""
    base64: str = Field(..., description="Base64 encoded image data")


class RoomData(BaseModel):
    """Schema for room data in scan requests."""
    room_id: str = Field(..., description="Unique identifier for the room")
    image_urls: List[str] = Field(..., description="List of image URLs for the room")


class ScanRequest(BaseModel):
    """
    Schema for scan request payload.
    
    The service receives final merged checklists and has no knowledge of:
    - Base/default checklists
    - Custom user checklists  
    - Merging logic
    
    Client is responsible for merging base + custom before sending request.
    """
    rooms: List[RoomData] = Field(..., description="List of rooms to analyze")
    house_checklist: Dict[str, Any] = Field(..., description="Final merged house checklist ready for agents")
    rooms_checklist: Dict[str, Any] = Field(..., description="Final merged rooms checklist ready for agents") 
    products_checklist: Dict[str, Any] = Field(..., description="Final merged products checklist ready for agents")