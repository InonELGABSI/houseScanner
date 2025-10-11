"""
Domain layer - Core business logic and contracts.

Clean Architecture Domain Layer Organization:

entities.py          - Core business entities (dataclasses)
├── ChecklistItem    - Business checklist item
├── RoomInfo         - Room business information  
├── HouseInfo        - House business information
├── AnalysisResult   - Analysis results
└── ProcessingContext - Processing context

value_objects.py     - Value objects and shared types
├── QualityLevel     - Quality assessment enum
├── Quality          - Quality type alias for agents
├── ChecklistItemType - Checklist item type enum
└── AgentType        - Agent type enum

agent_contracts.py   - Agent input/output technical contracts
├── ClassificationInput        - Agent 1,3 input contract
├── ChecklistEvaluationInput   - Agent 2,4,5 input contract  
├── ProsConsAnalysisInput      - Agent 6 input contract
├── TypesOutput               - Agent 1,3 output contract
├── ChecklistEvaluationOutput - Agent 2,4,5 output contract
├── ProsConsOutput            - Agent 6 output contract
├── RoomResult                - Room analysis contract
└── HouseResult               - Complete analysis contract

policies.py          - Business rules and policies
└── (existing business rules)

This organization separates:
- Business entities (what the business cares about)
- Value objects (shared business types)  
- Technical contracts (how agents communicate)
- Business rules (how business logic works)
"""

# Import all domain models from the models package
from .models import (
    # Business entities
    ChecklistItem,
    RoomInfo, 
    HouseInfo,
    AnalysisResult,
    RoomAnalysis,
    HouseAnalysis,
    ProcessingContext,
    
    # Value objects and shared types
    QualityLevel,
    Quality,
    ChecklistItemType,
    AnalysisType,
    quality_level_to_str,
    str_to_quality_level,
    
    # Agent technical contracts
    ClassificationInput,
    ChecklistEvaluationInput,
    ProsConsAnalysisInput,
    AgentChecklistItem,
    TypesOutput,
    ChecklistEvaluationOutput,
    ProsConsOutput,
    ConditionalAnswer,
    RoomResult,
    HouseResult,
)

__all__ = [
    # Business entities
    "ChecklistItem",
    "RoomInfo",
    "HouseInfo", 
    "AnalysisResult",
    "RoomAnalysis",
    "HouseAnalysis",
    "ProcessingContext",
    
    # Value objects
    "QualityLevel",
    "Quality", 
    "ChecklistItemType",
    "AnalysisType",
    "quality_level_to_str",
    "str_to_quality_level",    # Agent contracts
    "ClassificationInput",
    "ChecklistEvaluationInput",
    "ProsConsAnalysisInput",
    "AgentChecklistItem",
    "TypesOutput",
    "ChecklistEvaluationOutput", 
    "ProsConsOutput",
    "ConditionalAnswer",
    "RoomResult",
    "HouseResult",
]
