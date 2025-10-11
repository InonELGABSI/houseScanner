"""Result aggregation and summary generation service."""
from __future__ import annotations

import logging
from typing import Dict, List, Any

from app.domain.models import HouseResult, ChecklistEvaluationOutput, RoomResult

logger = logging.getLogger(__name__)


class ResultAggregator:
    """Service for aggregating and summarizing analysis results."""
    
    def flatten_answers(self, answers: ChecklistEvaluationOutput) -> Dict[str, Any]:
        """
        Flatten checklist answers to a single dictionary.
        
        Args:
            answers: ChecklistEvaluationOutput object containing all evaluation results
            
        Returns:
            Flattened dictionary combining all answer types
        """
        flat: Dict[str, Any] = {}
        
        # Add boolean answers
        if answers.booleans:
            flat.update(answers.booleans)
        
        # Add categorical answers  
        if answers.categoricals:
            flat.update(answers.categoricals)
        
        # Add conditional answers (expanded format)
        if answers.conditionals:
            for key, conditional in answers.conditionals.items():
                flat[key] = {
                    "exists": conditional.exists,
                    "condition": conditional.condition,
                    "subitems": conditional.subitems or {}
                }
        
        return flat
    
    def generate_summary(
        self, 
        house_answers: ChecklistEvaluationOutput,
        room_results: List[RoomResult]
    ) -> Dict[str, List[str]]:
        """
        Generate deterministic summary of all findings.
        
        Args:
            house_answers: House checklist results
            room_results: List of room analysis results
            
        Returns:
            Categorized summary of issues
        """
        # Convert house answers to issue lines
        house_issues = self._checklist_to_issue_lines("house", house_answers)
        
        # Aggregate room and product issues
        room_issues = []
        product_issues = []
        
        for room_result in room_results:
            room_id = room_result.room_id
            room_answers = room_result.issues
            product_answers = room_result.products
            
            room_issues.extend(
                self._checklist_to_issue_lines(f"room:{room_id}", room_answers)
            )
            product_issues.extend(
                self._checklist_to_issue_lines(f"product:{room_id}", product_answers)
            )
        
        # Combine custom issues
        custom_issues = house_issues + room_issues + product_issues
        
        return {
            "house": house_issues,
            "rooms": room_issues,
            "products": product_issues,
            "custom": custom_issues,
        }
    
    def generate_client_summary(self, result: HouseResult) -> Dict[str, Any]:
        """
        Generate client-focused summary with booleans true + categoricals.
        
        Args:
            result: Complete house analysis result
            
        Returns:
            Client-friendly summary
        """
        def extract_true_and_categoricals(checklist: ChecklistEvaluationOutput) -> Dict[str, Any]:
            """Extract boolean trues and categoricals from checklist."""
            try:
                booleans_true = sorted([
                    k for k, v in (checklist.booleans or {}).items() 
                    if v is True
                ])
                categoricals = dict(checklist.categoricals or {})
                return {
                    "booleans_true": booleans_true,
                    "categoricals": categoricals
                }
            except Exception as e:
                logger.warning(f"Error extracting checklist data: {e}")
                return {"booleans_true": [], "categoricals": {}}
        
        # Extract house summary
        house_summary = extract_true_and_categoricals(result.house_checklist)
        
        # Extract room summaries
        rooms_summary = {}
        products_summary = {}
        
        for room_result in result.rooms:
            room_id = room_result.room_id
            rooms_summary[room_id] = extract_true_and_categoricals(room_result.issues)
            products_summary[room_id] = extract_true_and_categoricals(room_result.products)
        
        # Aggregate statistics for logging
        house_true_count = len(house_summary["booleans_true"])
        house_cat_count = len(house_summary["categoricals"])
        rooms_true_count = sum(len(v["booleans_true"]) for v in rooms_summary.values())
        rooms_cat_count = sum(len(v["categoricals"]) for v in rooms_summary.values())
        products_true_count = sum(len(v["booleans_true"]) for v in products_summary.values())
        products_cat_count = sum(len(v["categoricals"]) for v in products_summary.values())
        
        logger.info(
            f"🧾 CLIENT SUMMARY COUNTS: "
            f"house(true={house_true_count}, cat={house_cat_count}) | "
            f"rooms(true={rooms_true_count}, cat={rooms_cat_count}) | "
            f"products(true={products_true_count}, cat={products_cat_count}) | "
            f"pros={len(result.pros_cons.pros)} cons={len(result.pros_cons.cons)}"
        )
        
        return {
            "house": house_summary,
            "rooms": rooms_summary,
            "products": products_summary,
            "pros_cons": {
                "pros": result.pros_cons.pros,
                "cons": result.pros_cons.cons
            },
        }
    
    def _checklist_to_issue_lines(self, prefix: str, answers: ChecklistEvaluationOutput) -> List[str]:
        """
        Convert checklist answers to deterministic issue lines.
        
        Args:
            prefix: Prefix for categorization (e.g., "house", "room:kitchen")
            answers: Checklist answers
            
        Returns:
            List of issue description lines
        """
        lines = []
        
        try:
            # Process boolean answers (only True values become issues)
            for key, value in (answers.booleans or {}).items():
                if value is True:
                    lines.append(f"{prefix}:{key}:true")
            
            # Process categorical answers
            for key, value in (answers.categoricals or {}).items():
                if value and value != "N/A":
                    lines.append(f"{prefix}:{key}:{value}")
            
            # Process conditional answers
            for key, conditional in (answers.conditionals or {}).items():
                if conditional.exists:
                    lines.append(f"{prefix}:{key}:exists")
                    
                    if conditional.condition:
                        lines.append(f"{prefix}:{key}:condition:{conditional.condition}")
                    
                    if conditional.subitems:
                        for subkey, subvalue in conditional.subitems.items():
                            if subvalue and subvalue != "N/A":
                                lines.append(f"{prefix}:{key}:{subkey}:{subvalue}")
        
        except Exception as e:
            logger.warning(f"Error processing checklist {prefix}: {e}")
        
        return lines
    
    def calculate_completion_stats(self, result: HouseResult) -> Dict[str, Any]:
        """
        Calculate completion and coverage statistics.
        
        Args:
            result: Complete house analysis result
            
        Returns:
            Statistics dictionary
        """
        stats = {
            "total_rooms": len(result.rooms),
            "house_types_count": len(result.house_types),
            "total_house_items": len(result.house_checklist.booleans or {}) + 
                               len(result.house_checklist.categoricals or {}) +
                               len(result.house_checklist.conditionals or {}),
            "room_stats": [],
            "overall_coverage": 0.0
        }
        
        total_items = stats["total_house_items"]
        
        for room_result in result.rooms:
            room_items = (len(room_result.issues.booleans or {}) + 
                         len(room_result.issues.categoricals or {}) +
                         len(room_result.issues.conditionals or {}))
            
            product_items = (len(room_result.products.booleans or {}) + 
                           len(room_result.products.categoricals or {}) +
                           len(room_result.products.conditionals or {}))
            
            room_stat = {
                "room_id": room_result.room_id,
                "room_types": room_result.room_types,
                "room_items": room_items,
                "product_items": product_items,
                "total_items": room_items + product_items
            }
            
            stats["room_stats"].append(room_stat)
            total_items += room_stat["total_items"]
        
        stats["total_items_analyzed"] = total_items
        
        # Calculate coverage as a simple metric
        if total_items > 0:
            completed_items = sum(
                len([v for v in (result.house_checklist.booleans or {}).values() if v is not None]) +
                len([v for v in (result.house_checklist.categoricals or {}).values() if v]) +
                len([v for v in (result.house_checklist.conditionals or {}).values() if v])
            )
            
            for room_result in result.rooms:
                completed_items += sum([
                    len([v for v in (room_result.issues.booleans or {}).values() if v is not None]),
                    len([v for v in (room_result.issues.categoricals or {}).values() if v]),
                    len([v for v in (room_result.issues.conditionals or {}).values() if v]),
                    len([v for v in (room_result.products.booleans or {}).values() if v is not None]),
                    len([v for v in (room_result.products.categoricals or {}).values() if v]),
                    len([v for v in (room_result.products.conditionals or {}).values() if v])
                ])
            
            stats["overall_coverage"] = completed_items / total_items
        
        return stats