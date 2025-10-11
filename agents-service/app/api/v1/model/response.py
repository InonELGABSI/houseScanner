"""API v1 response schemas."""
from __future__ import annotations

from typing import Dict, Optional, Any
from pydantic import BaseModel

from app.domain.models import HouseResult


# Response Schemas
class ScanResponse(BaseModel):
    """Schema for scan response."""
    result: HouseResult
    client_summary: Dict[str, Any]
    cost_info: Dict[str, Any]
    metadata: Dict[str, Any]


class SimulateResponse(BaseModel):
    """Schema for simulate response."""
    sim_root: str
    result: HouseResult
    client_summary: Dict[str, Any]
    cost_info: Dict[str, Any]
    metadata: Dict[str, Any]


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None