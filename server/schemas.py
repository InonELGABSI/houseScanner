from __future__ import annotations
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

Quality = Literal["Poor", "Average", "Good", "Excellent", "N/A"]

# ---------- Agent 1 & 3 ----------
class TypesOut(BaseModel):
    types: List[str] = Field(
        ..., description="One or more applicable type IDs (e.g., ['apartment'] or ['bedroom','office'])."
    )
    model_config = {"extra": "forbid"}

# ---------- Agent 2/4/5 ----------
class ConditionalAnswer(BaseModel):
    exists: bool
    condition: Optional[Quality] = None
    subitems: Optional[Dict[str, Quality]] = None
    model_config = {"extra": "forbid"}

class ChecklistAnswers(BaseModel):
    booleans: Dict[str, bool] = Field(default_factory=dict)
    categoricals: Dict[str, Quality] = Field(default_factory=dict)
    conditionals: Dict[str, ConditionalAnswer] = Field(default_factory=dict)
    model_config = {"extra": "forbid"}

# ---------- Agent 6 ----------
class ProsCons(BaseModel):
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    model_config = {"extra": "forbid"}

# ---------- Final payload ----------
class RoomResult(BaseModel):
    room_id: str
    room_types: List[str]
    issues: ChecklistAnswers
    products: ChecklistAnswers
    model_config = {"extra": "forbid"}

class HouseResult(BaseModel):
    house_types: List[str]
    house_checklist: ChecklistAnswers
    rooms: List[RoomResult]
    summary: Dict[str, List[str]]  # keys: 'house', 'rooms', 'products', 'custom'
    pros_cons: ProsCons
    model_config = {"extra": "forbid"}
