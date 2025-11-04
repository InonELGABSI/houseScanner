"""
LangGraph state definitions for agent pipeline.

State represents the data flowing through the workflow graph.
"""
from typing import Dict, List, Any, Optional, TypedDict
from app.domain.models import RoomResult, ChecklistEvaluationOutput, ProsConsOutput


class PipelineState(TypedDict, total=False):
    """
    Complete state for the agent pipeline workflow.
    
    LangGraph will pass this state through each node, allowing nodes
    to read from and write to specific fields.
    """
    # Request metadata
    request_id: str
    
    # Input data
    all_images: List[bytes]
    rooms_map: Dict[str, List[bytes]]
    
    # Checklists (pre-merged from client or simulation)
    house_checklist: Dict[str, Any]
    rooms_checklist: Dict[str, Any]
    products_checklist: Dict[str, Any]
    
    # Agent 1 & 2: House analysis
    house_types: List[str]
    house_answers: ChecklistEvaluationOutput
    
    # Agent 3, 4, 5: Room analysis (parallel processing)
    room_results: List[RoomResult]
    
    # Agent 6: Final analysis
    summary: Dict[str, Any]
    pros_cons: ProsConsOutput
    
    # Error handling
    error: Optional[str]


class RoomProcessingState(TypedDict, total=False):
    """State for processing a single room (used in parallel map-reduce)."""
    request_id: str
    room_id: str
    room_images: List[bytes]
    rooms_checklist: Dict[str, Any]
    products_checklist: Dict[str, Any]
    
    # Results
    room_types: List[str]
    room_answers: ChecklistEvaluationOutput
    product_answers: ChecklistEvaluationOutput
    
    # Error handling
    error: Optional[str]
