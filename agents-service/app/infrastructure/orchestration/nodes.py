"""
LangGraph node implementations for the agent pipeline.

Each node is a pure function that:
1. Receives state
2. Performs one task (agent call)
3. Returns updated state
"""
import asyncio
import logging
from typing import Dict, Any

from app.domain.models import (
    RoomResult,
    ClassificationInput,
    ChecklistEvaluationInput,
    ProsConsAnalysisInput,
    AgentChecklistItem,
)
from app.domain.policies import BusinessRulesPolicy
from app.infrastructure.orchestration.state import PipelineState, RoomProcessingState
from app.infrastructure.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class PipelineNodes:
    """
    Collection of node functions for the LangGraph pipeline.
    
    Each method is a node in the workflow graph.
    """
    
    def __init__(
        self,
        agents_service,
        cost_manager,
        preprocessor,
        aggregator,
        rate_limiter: RateLimiter,
    ):
        self.agents_service = agents_service
        self.cost_manager = cost_manager
        self.preprocessor = preprocessor
        self.aggregator = aggregator
        self.rate_limiter = rate_limiter
    
    async def classify_house_types(self, state: PipelineState) -> Dict[str, Any]:
        """
        Node: Agent 1 - Classify house types.
        
        Reads: all_images, house_checklist
        Writes: house_types
        """
        request_id = state["request_id"]
        logger.info(f"🚀 [REQ-{request_id}] Node: AGENT 1 - House Type Classification")
        
        try:
            house_checklist = state["house_checklist"]
            allowed_house_types = list(house_checklist.get("house_types", {}).keys())
            
            # Sample images for classification
            all_images = state["all_images"]
            house_cls_images = self.preprocessor.sample_for_classification(all_images)
            
            logger.info(
                f"📊 [REQ-{request_id}] Agent 1 Input: "
                f"{len(house_cls_images)} images, {len(allowed_house_types)} allowed types"
            )
            
            # Direct LLM call (agents service has its own throttling)
            house_classification_input = ClassificationInput(
                images=house_cls_images,
                allowed_types=allowed_house_types,
                classification_type="house type",
            )
            house_types_output = await self.agents_service.classify_types(
                house_classification_input,
                self.cost_manager,
                None,  # execution_tracker
            )
            
            house_types = BusinessRulesPolicy.validate_house_types(
                house_types_output.types,
                allowed_house_types,
            )
            
            logger.info(f"🏠 [REQ-{request_id}] Agent 1 Result: {house_types}")
            
            # Return only the updated fields - LangGraph will merge with existing state
            return {"house_types": house_types}
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Agent 1 failed: {e}")
            return {"error": str(e)}
    
    async def evaluate_house_checklist(self, state: PipelineState) -> Dict[str, Any]:
        """
        Node: Agent 2 - Evaluate house checklist.
        
        Reads: all_images, house_checklist, house_types
        Writes: house_answers
        """
        request_id = state["request_id"]
        logger.info(f"🚀 [REQ-{request_id}] Node: AGENT 2 - House Checklist Evaluation")
        
        try:
            house_checklist = state["house_checklist"]
            house_types = state["house_types"]
            
            # Merge default + type-specific items
            house_items_raw = []
            seen_ids = set()
            
            # Default items
            if "default" in house_checklist and "items" in house_checklist["default"]:
                for item in house_checklist["default"]["items"]:
                    item_id = item.get("id")
                    if item_id and item_id not in seen_ids:
                        house_items_raw.append(item)
                        seen_ids.add(item_id)
            
            # Type-specific items
            if "house_types" in house_checklist:
                for house_type in house_types:
                    if house_type in house_checklist["house_types"]:
                        type_items = house_checklist["house_types"][house_type].get("items", [])
                        for item in type_items:
                            item_id = item.get("id")
                            if item_id and item_id not in seen_ids:
                                house_items_raw.append(item)
                                seen_ids.add(item_id)
            
            house_items = [
                AgentChecklistItem(**item) if isinstance(item, dict) else item
                for item in house_items_raw
            ]
            
            # Sample images
            all_images = state["all_images"]
            house_chk_images = self.preprocessor.sample_for_checklist(all_images, k=6)
            
            logger.info(
                f"📊 [REQ-{request_id}] Agent 2 Input: "
                f"{len(house_chk_images)} images, {len(house_items)} checklist items"
            )
            
            # Direct LLM call (agents service has its own throttling)
            house_checklist_input = ChecklistEvaluationInput(
                images=house_chk_images,
                checklist_items=house_items,
                task_label="house checklist",
            )
            house_answers = await self.agents_service.evaluate_checklist(
                house_checklist_input,
                self.cost_manager,
                None,
            )
            
            total_items = (
                len(house_answers.booleans) +
                len(house_answers.categoricals) +
                len(house_answers.conditionals)
            )
            logger.info(
                f"🏠 [REQ-{request_id}] Agent 2 Result: "
                f"House evaluation completed ({total_items} items)"
            )
            
            return {"house_answers": house_answers}
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Agent 2 failed: {e}")
            return {"error": str(e)}
    
    async def process_rooms_parallel(self, state: PipelineState) -> Dict[str, Any]:
        """
        Node: Process all rooms in parallel (Agents 3, 4, 5).
        
        This is the key parallelization point. Each room runs through:
        - Agent 3: Room type classification
        - Agent 4: Room checklist evaluation
        - Agent 5: Products evaluation
        
        Reads: rooms_map, rooms_checklist, products_checklist
        Writes: room_results
        """
        request_id = state["request_id"]
        rooms_map = state["rooms_map"]
        
        logger.info(
            f"🚀 [REQ-{request_id}] Node: PROCESS ROOMS PARALLEL "
            f"({len(rooms_map)} rooms)"
        )
        
        try:
            # Process all rooms concurrently
            room_tasks = [
                self._process_single_room(
                    request_id=request_id,
                    room_id=room_id,
                    room_images=room_images,
                    rooms_checklist=state["rooms_checklist"],
                    products_checklist=state["products_checklist"],
                )
                for room_id, room_images in rooms_map.items()
                if room_images  # Skip empty rooms
            ]
            
            room_results = await asyncio.gather(*room_tasks, return_exceptions=True)
            
            # Filter out exceptions and log them
            valid_results = []
            for i, result in enumerate(room_results):
                if isinstance(result, Exception):
                    logger.error(f"❌ [REQ-{request_id}] Room processing failed: {result}")
                else:
                    valid_results.append(result)
            
            logger.info(
                f"✅ [REQ-{request_id}] Rooms processed: "
                f"{len(valid_results)}/{len(room_tasks)} successful"
            )
            
            return {"room_results": valid_results}
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Room processing failed: {e}")
            return {"error": str(e)}
    
    async def _process_single_room(
        self,
        request_id: str,
        room_id: str,
        room_images: list,
        rooms_checklist: Dict[str, Any],
        products_checklist: Dict[str, Any],
    ) -> RoomResult:
        """Process a single room through Agents 3, 4, 5."""
        logger.info(f"� [REQ-{request_id}] STARTING parallel processing for room '{room_id}'")
        
        # Agent 3: Room type classification
        allowed_room_types = list(rooms_checklist.get("room_types", {}).keys())
        room_cls_images = self.preprocessor.sample_for_classification(room_images, k=3)
        
        # Direct call (agents service has its own throttling)
        room_classification_input = ClassificationInput(
            images=room_cls_images,
            allowed_types=allowed_room_types,
            classification_type="room type",
        )
        room_types_output = await self.agents_service.classify_types(
            room_classification_input,
            self.cost_manager,
            None,
        )
        
        room_types = BusinessRulesPolicy.validate_room_types(
            room_types_output.types,
            allowed_room_types,
        )
        logger.info(f"🏷️ [REQ-{request_id}] Room '{room_id}' → {room_types}")
        
        # Agent 4: Room checklist
        room_items_raw = []
        room_seen_ids = set()
        
        # Default items
        if "default" in rooms_checklist and "items" in rooms_checklist["default"]:
            for item in rooms_checklist["default"]["items"]:
                item_id = item.get("id")
                if item_id and item_id not in room_seen_ids:
                    room_items_raw.append(item)
                    room_seen_ids.add(item_id)
        
        # Type-specific items
        if "room_types" in rooms_checklist:
            for room_type in room_types:
                if room_type in rooms_checklist["room_types"]:
                    type_items = rooms_checklist["room_types"][room_type].get("items", [])
                    for item in type_items:
                        item_id = item.get("id")
                        if item_id and item_id not in room_seen_ids:
                            room_items_raw.append(item)
                            room_seen_ids.add(item_id)
        
        room_items = [
            AgentChecklistItem(**item) if isinstance(item, dict) else item
            for item in room_items_raw
        ]
        room_chk_images = self.preprocessor.sample_for_checklist(room_images, k=3)
        
        # Direct call (agents service has its own throttling)
        room_checklist_input = ChecklistEvaluationInput(
            images=room_chk_images,
            checklist_items=room_items,
            task_label=f"room checklist ({room_id})",
        )
        room_answers = await self.agents_service.evaluate_checklist(
            room_checklist_input,
            self.cost_manager,
            None,
        )
        
        # Agent 5: Products
        product_items_raw = products_checklist.get("items", [])
        if "default" in products_checklist and "items" in products_checklist["default"]:
            product_items_raw = products_checklist["default"]["items"]
        
        product_items = [
            AgentChecklistItem(**item) if isinstance(item, dict) else item
            for item in product_items_raw
        ]
        product_chk_images = self.preprocessor.sample_for_checklist(room_images, k=3)
        
        # Direct call (agents service has its own throttling)
        product_checklist_input = ChecklistEvaluationInput(
            images=product_chk_images,
            checklist_items=product_items,
            task_label=f"products checklist ({room_id})",
        )
        product_answers = await self.agents_service.evaluate_checklist(
            product_checklist_input,
                self.cost_manager,
                None,
            )
        
        logger.info(f"✅ [REQ-{request_id}] Room '{room_id}' analysis complete")
        
        return RoomResult(
            room_id=room_id,
            room_types=room_types,
            issues=room_answers,
            products=product_answers,
        )
    
    async def analyze_pros_cons(self, state: PipelineState) -> Dict[str, Any]:
        """
        Node: Agent 6 - Analyze pros/cons.
        
        Reads: house_answers, room_results
        Writes: summary, pros_cons
        """
        request_id = state["request_id"]
        logger.info(f"🚀 [REQ-{request_id}] Node: AGENT 6 - Pros/Cons Analysis")
        
        try:
            # Generate summary
            house_answers = state["house_answers"]
            room_results = state["room_results"]
            summary = self.aggregator.generate_summary(house_answers, room_results)
            
            logger.info(
                f"📊 [REQ-{request_id}] Agent 6 Input: "
                f"house_issues={len(summary['house'])}, "
                f"room_issues={len(summary['rooms'])}, "
                f"product_issues={len(summary['products'])}"
            )
            
            # Direct LLM call (agents service has its own throttling)
            pros_cons_input = ProsConsAnalysisInput(
                house_issues=summary["house"],
                room_issues=summary["rooms"],
                product_issues=summary["products"],
            )
            pros_cons = await self.agents_service.analyze_pros_cons(
                pros_cons_input,
                self.cost_manager,
                None,
            )
            
            logger.info(
                f"🔍 [REQ-{request_id}] Agent 6 Result: "
                f"{len(pros_cons.pros)} pros, {len(pros_cons.cons)} cons"
            )
            
            return {
                "summary": summary,
                "pros_cons": pros_cons,
            }
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Agent 6 failed: {e}")
            return {"error": str(e)}
