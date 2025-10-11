"""Core business entities for the house scanning domain."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Any

from .value_objects import QualityLevel, ChecklistItemType


@dataclass
class ChecklistItem:
    """
    Core business entity representing a checklist item.
    
    This is the authoritative business representation of a checklist item.
    Use this for business logic, domain rules, and data persistence.
    For agent communication, convert to AgentChecklistItem using to_agent_contract().
    """
    id: str
    question: str
    type: ChecklistItemType
    category: Optional[str] = None
    priority: int = 0
    metadata: Optional[Dict[str, Any]] = None
    
    def to_agent_contract(self) -> Dict[str, Any]:
        """Convert to agent contract format for technical boundaries."""
        return {
            "id": self.id,
            "type": self.type.value_str,
            "text": self.question,
            "options": self.metadata.get("options") if self.metadata else None,
            "subitems": self.metadata.get("subitems") if self.metadata else None,
        }


@dataclass
class RoomInfo:
    """Information about a room being analyzed."""
    room_id: str
    room_types: List[str]
    image_urls: Optional[List[str]] = None
    image_data: Optional[List[bytes]] = None


@dataclass
class HouseInfo:
    """Information about the house being analyzed."""
    house_types: List[str]
    rooms: List[RoomInfo]
    custom_checklist: Optional[Dict[str, Any]] = None


@dataclass
class AnalysisResult:
    """Result of checklist analysis."""
    booleans: Dict[str, bool]
    categoricals: Dict[str, QualityLevel]
    conditionals: Dict[str, Dict[str, Any]]
    
    
@dataclass
class RoomAnalysis:
    """Complete analysis results for a room."""
    room_id: str
    room_types: List[str]
    room_checklist: AnalysisResult
    products_checklist: AnalysisResult


@dataclass
class HouseAnalysis:
    """Complete analysis results for a house."""
    house_types: List[str]
    house_checklist: AnalysisResult
    rooms: List[RoomAnalysis]
    pros_cons: Dict[str, List[str]]
    summary: Dict[str, List[str]]
    metadata: Dict[str, Any]


@dataclass
class ProcessingContext:
    """Context information for processing pipeline."""
    request_id: str
    timestamp: str
    user_preferences: Optional[Dict[str, Any]] = None
    processing_options: Optional[Dict[str, Any]] = None