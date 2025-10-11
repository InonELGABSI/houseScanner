"""Domain value objects and shared types."""
from __future__ import annotations

from typing import Literal
from enum import Enum


# =====================================
# QUALITY ASSESSMENT
# =====================================

class QualityLevel(Enum):
    """Quality assessment levels for domain use."""
    POOR = "Poor"
    AVERAGE = "Average"
    GOOD = "Good"
    EXCELLENT = "Excellent"
    NOT_APPLICABLE = "N/A"


# Type alias for technical contracts (Pydantic-compatible)
Quality = Literal["Poor", "Average", "Good", "Excellent", "N/A"]


# =====================================
# CHECKLIST TYPES
# =====================================

class ChecklistItemType(Enum):
    """Types of checklist items in the business domain."""
    BOOLEAN = "boolean"
    CATEGORICAL = "categorical"
    CONDITIONAL = "conditional"
    
    @property
    def value_str(self) -> str:
        """Get string value for technical contracts."""
        return self.value


# =====================================
# ANALYSIS TYPES
# =====================================

class AnalysisType(Enum):
    """Types of analysis that can be performed."""
    HOUSE_TYPE_CLASSIFICATION = "house_classification"
    HOUSE_CHECKLIST_EVALUATION = "house_checklist"
    ROOM_TYPE_CLASSIFICATION = "room_classification"
    ROOM_CHECKLIST_EVALUATION = "room_checklist"
    PRODUCT_EVALUATION = "products_evaluation"
    PROS_CONS_ANALYSIS = "pros_cons_analysis"


# =====================================
# QUALITY CONVERSION UTILITIES
# =====================================

def quality_level_to_str(quality: QualityLevel) -> str:
    """Convert QualityLevel enum to string for technical contracts."""
    return quality.value

def str_to_quality_level(quality_str: str) -> QualityLevel:
    """Convert string to QualityLevel enum from technical contracts."""
    for level in QualityLevel:
        if level.value == quality_str:
            return level
    raise ValueError(f"Invalid quality level: {quality_str}")