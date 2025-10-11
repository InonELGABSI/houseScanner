"""
Domain models package - All domain model classes organized by purpose.

CLEAN ARCHITECTURE DOMAIN MODELS:

entities.py         - Core business entities (what the business cares about)
├── ChecklistItem   - Business checklist representation
├── RoomInfo        - Room business information
├── HouseInfo       - House business information  
├── AnalysisResult  - Analysis results data
└── ProcessingContext - Processing context

value_objects.py    - Value objects and shared types (immutable business values)
├── QualityLevel    - Quality assessment enumeration
├── Quality         - Quality type alias for technical contracts
├── ChecklistItemType - Type of checklist items
└── AgentType       - Agent classification types

agent_contracts.py  - Technical contracts for agent communication
├── Input Contracts:
│   ├── ClassificationInput        - Agent 1,3 input
│   ├── ChecklistEvaluationInput   - Agent 2,4,5 input
│   └── ProsConsAnalysisInput      - Agent 6 input
├── Output Contracts:
│   ├── TypesOutput               - Agent 1,3 output
│   ├── ChecklistEvaluationOutput - Agent 2,4,5 output
│   └── ProsConsOutput            - Agent 6 output
└── Composite Contracts:
    ├── RoomResult                - Room analysis result
    └── HouseResult               - Complete house analysis result

This organization follows Domain-Driven Design principles:
- Entities: Objects with identity and lifecycle
- Value Objects: Immutable objects representing business concepts
- Technical Contracts: Pure data transfer objects for system boundaries
"""

# Re-export all domain models from a single place
from .entities import (
    ChecklistItem,
    RoomInfo,
    HouseInfo,
    AnalysisResult,
    RoomAnalysis,
    HouseAnalysis, 
    ProcessingContext,
)

from .value_objects import (
    QualityLevel,
    Quality,
    ChecklistItemType,
    AnalysisType,
    quality_level_to_str,
    str_to_quality_level,
)

from .agent_contracts import (
    # Input contracts
    ClassificationInput,
    ChecklistEvaluationInput,
    ProsConsAnalysisInput,
    AgentChecklistItem,
    
    # Output contracts  
    TypesOutput,
    ChecklistEvaluationOutput,
    ProsConsOutput,
    ConditionalAnswer,
    
    # Composite contracts
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
    "str_to_quality_level",
    
    # Agent contracts
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