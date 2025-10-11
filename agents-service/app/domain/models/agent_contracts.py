"""
Agent input and output contracts for the 6-agent pipeline.

This module defines the pure technical contracts for agent communication:
- Input schemas: What data agents receive
- Output schemas: What data agents return
- No business logic - only data structures for agent boundaries

These contracts are used by:
- Infrastructure layer: AgentsService implements these contracts
- Application layer: Use cases orchestrate agents using these contracts
"""
from __future__ import annotations

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from .value_objects import Quality


# =====================================
# AGENT INPUT CONTRACTS
# =====================================

class AgentChecklistItem(BaseModel):
    """
    Technical contract for checklist items in agent communication.
    
    This is a pure data transfer object for agent boundaries.
    - Used for input validation and serialization
    - No business logic - only data structure
    - Converted from business entities via ChecklistItem.to_agent_contract()
    """
    id: str = Field(..., description="Unique identifier for the checklist item")
    type: str = Field(..., description="Type: 'boolean', 'categorical', or 'conditional'")
    text: Optional[str] = Field(None, description="Human-readable question text")
    title: Optional[str] = Field(None, description="Display title (alternative to text)")
    description: Optional[str] = Field(None, description="Additional description or guidance")
    options: Optional[List[str]] = Field(None, description="Options for categorical items")
    subitems: Optional[List[Dict[str, Any]]] = Field(None, description="Sub-items for conditional items")
    
    model_config = {"extra": "forbid"}
    
    @classmethod
    def from_business_entity(cls, entity_data: Dict[str, Any]) -> "AgentChecklistItem":
        """Create from business entity conversion."""
        return cls(**entity_data)


class ClassificationInput(BaseModel):
    """Input contract for type classification agents (Agent 1 & 3)."""
    images: List[bytes] = Field(..., description="Preprocessed image bytes")
    allowed_types: List[str] = Field(..., description="List of allowed type identifiers")
    classification_type: str = Field(..., description="Type description for logging")
    
    model_config = {"extra": "forbid"}


class ChecklistEvaluationInput(BaseModel):
    """Input contract for checklist evaluation agents (Agent 2, 4 & 5)."""
    images: List[bytes] = Field(..., description="Preprocessed image bytes")
    checklist_items: List[AgentChecklistItem] = Field(..., description="Checklist items to evaluate")
    task_label: str = Field(..., description="Task description for logging")
    
    model_config = {"extra": "forbid"}


class ProsConsAnalysisInput(BaseModel):
    """Input contract for pros/cons analysis agent (Agent 6)."""
    house_issues: List[str] = Field(..., description="House-level issue summaries")
    room_issues: List[str] = Field(..., description="Room-level issue summaries")  
    product_issues: List[str] = Field(..., description="Product-level issue summaries")
    
    model_config = {"extra": "forbid"}


# =====================================
# AGENT OUTPUT CONTRACTS
# =====================================

class TypesOutput(BaseModel):
    """Output contract for type classification agents (Agent 1 & 3)."""
    types: List[str] = Field(..., description="Detected type IDs")
    
    model_config = {"extra": "forbid"}


class ConditionalAnswer(BaseModel):
    """Contract for conditional checklist answers."""
    exists: bool = Field(..., description="Whether the conditional item exists")
    condition: Optional[Quality] = Field(None, description="Overall condition if exists")
    subitems: Optional[Dict[str, Quality]] = Field(None, description="Sub-item condition mappings")
    
    model_config = {"extra": "forbid"}


class ChecklistEvaluationOutput(BaseModel):
    """Output contract for checklist evaluation agents (Agent 2, 4 & 5)."""
    booleans: Dict[str, bool] = Field(default_factory=dict, description="Boolean checklist results")
    categoricals: Dict[str, Quality] = Field(default_factory=dict, description="Categorical checklist results")
    conditionals: Dict[str, ConditionalAnswer] = Field(default_factory=dict, description="Conditional checklist results")
    
    model_config = {"extra": "forbid"}


class ProsConsOutput(BaseModel):
    """Output contract for pros/cons analysis agent (Agent 6)."""
    pros: List[str] = Field(default_factory=list, description="Positive aspects identified")
    cons: List[str] = Field(default_factory=list, description="Negative aspects identified")
    
    model_config = {"extra": "forbid"}


# =====================================
# COMPOSITE RESULT CONTRACTS
# =====================================

class RoomResult(BaseModel):
    """Contract for individual room analysis results."""
    room_id: str = Field(..., description="Unique identifier for the room")
    room_types: List[str] = Field(..., description="Detected room types from Agent 3")
    issues: ChecklistEvaluationOutput = Field(..., description="Room checklist from Agent 4")
    products: ChecklistEvaluationOutput = Field(..., description="Products evaluation from Agent 5")
    
    model_config = {"extra": "forbid"}


class HouseResult(BaseModel):
    """
    Contract for complete house analysis results.
    
    Combines outputs from all 6 agents:
    - house_types: Agent 1 (TypesOutput)
    - house_checklist: Agent 2 (ChecklistEvaluationOutput)  
    - rooms: Agents 3,4,5 per room (RoomResult)
    - summary: Aggregated from all evaluations
    - pros_cons: Agent 6 (ProsConsOutput)
    """
    house_types: List[str] = Field(..., description="Detected house types from Agent 1")
    house_checklist: ChecklistEvaluationOutput = Field(..., description="House evaluation from Agent 2")
    rooms: List[RoomResult] = Field(..., description="Room analysis results")
    summary: Dict[str, List[str]] = Field(..., description="Issue summary by category")
    pros_cons: ProsConsOutput = Field(..., description="Pros/cons from Agent 6")
    
    model_config = {"extra": "forbid"}