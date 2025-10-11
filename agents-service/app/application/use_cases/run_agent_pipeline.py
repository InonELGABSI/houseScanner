"""
Use case for running the complete agent pipeline with preprocessed images.

ARCHITECTURE OVERVIEW:

Production Flow:
Client → [merges base + custom] → ScanRequest(final_checklists) → RunScanUseCase → RunAgentPipelineUseCase

Simulation Flow:  
Data Folder Files → RunSimulationUseCase → [merges locally] → RunAgentPipelineUseCase

The RunAgentPipelineUseCase is completely generic and processes final merged checklists
regardless of their source (client-merged vs locally-merged).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Any, Optional

from app.domain.models import (
    HouseResult, 
    RoomResult,
    ClassificationInput,
    ChecklistEvaluationInput,
    ProsConsAnalysisInput,
    AgentChecklistItem
)
from app.application.services.preprocess import ImagePreprocessor
from app.application.services.aggregation import ResultAggregator
from app.application.services.cost_manager import CostManager
from app.infrastructure.llm.agents import AgentsService
from app.core.settings import Settings
from app.domain.policies import BusinessRulesPolicy

logger = logging.getLogger(__name__)


class RunAgentPipelineUseCase:
    """
    Generic agent pipeline that processes final merged checklists.
    
    This class is completely agnostic to checklist sources and merging:
    - Receives final merged checklists (ready for processing)
    - Has NO knowledge of base vs custom vs merging concepts
    - Works identically regardless of checklist source
    
    Sources:
    - Production: Final checklists from client request
    - Simulation: Final checklists after local data folder merging
    
    Executes 6-agent pipeline:
    1. House type classification → 2. House checklist evaluation
    3. Room type classification → 4. Room checklist evaluation  
    5. Products evaluation → 6. Pros/Cons analysis
    """
    
    def __init__(
        self,
        agents_service: AgentsService,
        cost_manager: CostManager,
        settings: Settings,
    ):
        self.agents_service = agents_service
        self.cost_manager = cost_manager
        self.settings = settings
        self.preprocessor = ImagePreprocessor(settings)
        self.aggregator = ResultAggregator()
    
    async def execute(
        self,
        all_images: List[bytes],
        rooms_map: Dict[str, List[bytes]],
        house_checklist: Dict[str, Any],
        rooms_checklist: Dict[str, Any], 
        products_checklist: Dict[str, Any],
        request_id: str,
    ) -> HouseResult:
        """
        Execute the complete agent pipeline with preprocessed images and pre-merged checklists.
        
        Args:
            all_images: List of all preprocessed image bytes
            rooms_map: Dictionary mapping room_id to list of preprocessed image bytes
            house_checklist: Pre-merged house checklist (basic + custom unified)
            rooms_checklist: Pre-merged rooms checklist (basic + custom unified)
            products_checklist: Pre-merged products checklist (basic + custom unified)
            request_id: Request identifier for tracking
            
        Returns:
            Complete house analysis result
        """
        logger.info(f"🤖 [REQ-{request_id}] Starting agent pipeline")
        
        try:
            # Debug: Log checklist types and structure
            logger.info(f"🔍 [REQ-{request_id}] Checklist types: house={type(house_checklist)}, rooms={type(rooms_checklist)}, products={type(products_checklist)}")
            
            # Defensive programming: Ensure checklists are dictionaries
            if not isinstance(house_checklist, dict):
                logger.error(f"❌ [REQ-{request_id}] house_checklist is {type(house_checklist)}, expected dict. Value: {house_checklist}")
                raise TypeError(f"Expected house_checklist to be dict, got {type(house_checklist)}")
                
            if not isinstance(rooms_checklist, dict):
                logger.error(f"❌ [REQ-{request_id}] rooms_checklist is {type(rooms_checklist)}, expected dict. Value: {rooms_checklist}")
                raise TypeError(f"Expected rooms_checklist to be dict, got {type(rooms_checklist)}")
                
            if not isinstance(products_checklist, dict):
                logger.error(f"❌ [REQ-{request_id}] products_checklist is {type(products_checklist)}, expected dict. Value: {products_checklist}")
                raise TypeError(f"Expected products_checklist to be dict, got {type(products_checklist)}")
            
            # Step 1: Run Agent 1 - House type classification
            logger.info(f"🚀 [REQ-{request_id}] === AGENT 1: HOUSE TYPE CLASSIFICATION ===")
            await self._maybe_throttle("agent1")
            
            # Defensive get with try-catch for detailed error reporting
            try:
                allowed_house_types = list(house_checklist.get("house_types", {}).keys())
            except AttributeError as e:
                logger.error(f"❌ [REQ-{request_id}] Error calling house_checklist.get(): {e}")
                logger.error(f"❌ [REQ-{request_id}] house_checklist type: {type(house_checklist)}")
                logger.error(f"❌ [REQ-{request_id}] house_checklist value: {house_checklist}")
                raise
            
            house_cls_images = self.preprocessor.sample_for_classification(all_images)
            logger.info(f"📊 [REQ-{request_id}] Agent 1 Input: {len(house_cls_images)} images, {len(allowed_house_types)} allowed types")
            
            house_classification_input = ClassificationInput(
                images=house_cls_images,
                allowed_types=allowed_house_types,
                classification_type="house type"
            )
            house_types_output = await self.agents_service.classify_types(
                house_classification_input, self.cost_manager
            )
            house_types = BusinessRulesPolicy.validate_house_types(house_types_output.types, allowed_house_types)
            logger.info(f"🏠 [REQ-{request_id}] Agent 1 Result: {house_types}")
            
            # Step 2: Run Agent 2 - House checklist  
            logger.info(f"🚀 [REQ-{request_id}] === AGENT 2: HOUSE CHECKLIST EVALUATION ===")
            await self._maybe_throttle("agent2")
            
            # Use pre-merged house checklist items
            house_items_raw = house_checklist.get("items", [])
            if "default" in house_checklist and "items" in house_checklist["default"]:
                house_items_raw = house_checklist["default"]["items"]
            
            # Convert to AgentChecklistItem models
            house_items = [AgentChecklistItem(**item) if isinstance(item, dict) else item for item in house_items_raw]
            
            # Original uses k=6 for house checklist sampling
            house_chk_images = self.preprocessor.sample_for_checklist(all_images, k=6)
            logger.info(f"📊 [REQ-{request_id}] Agent 2 Input: {len(house_chk_images)} images, {len(house_items)} checklist items")
            
            house_checklist_input = ChecklistEvaluationInput(
                images=house_chk_images,
                checklist_items=house_items,
                task_label="house checklist"
            )
            house_answers = await self.agents_service.evaluate_checklist(
                house_checklist_input, self.cost_manager
            )
            total_house_items = len(house_answers.booleans) + len(house_answers.categoricals) + len(house_answers.conditionals)
            logger.info(f"🏠 [REQ-{request_id}] Agent 2 Result: House evaluation completed ({total_house_items} items)")
            
            # Step 3: Process each room (Agents 3-5)
            room_results = []
            
            # Defensive get with try-catch for detailed error reporting
            try:
                allowed_room_types = list(rooms_checklist.get("room_types", {}).keys())
            except AttributeError as e:
                logger.error(f"❌ [REQ-{request_id}] Error calling rooms_checklist.get(): {e}")
                logger.error(f"❌ [REQ-{request_id}] rooms_checklist type: {type(rooms_checklist)}")
                logger.error(f"❌ [REQ-{request_id}] rooms_checklist value: {rooms_checklist}")
                raise
            
            for room_id, room_images in rooms_map.items():
                if not room_images:
                    logger.warning(f"⚠️ [REQ-{request_id}] No images for room '{room_id}', skipping")
                    continue
                
                logger.info(f"📍 [REQ-{request_id}] Processing room '{room_id}' ({len(room_images)} images)")
                
                # Agent 3: Room type classification (k=3 like original)
                logger.info(f"🚀 [REQ-{request_id}] === AGENT 3: ROOM TYPE CLASSIFICATION (Room: {room_id}) ===")
                await self._maybe_throttle(f"agent3:{room_id}")
                room_cls_images = self.preprocessor.sample_for_classification(room_images, k=3)
                logger.info(f"📊 [REQ-{request_id}] Agent 3 Input: {len(room_cls_images)} images, allowed types: {allowed_room_types}")
                
                room_classification_input = ClassificationInput(
                    images=room_cls_images,
                    allowed_types=allowed_room_types,
                    classification_type="room type"
                )
                room_types_output = await self.agents_service.classify_types(
                    room_classification_input, self.cost_manager
                )
                room_types = BusinessRulesPolicy.validate_room_types(room_types_output.types, allowed_room_types)
                logger.info(f"🏷️ [REQ-{request_id}] Agent 3 Result: Room '{room_id}' classified as {room_types}")
                
                # Agent 4: Room checklist (k=3 like original)
                logger.info(f"🚀 [REQ-{request_id}] === AGENT 4: ROOM CHECKLIST EVALUATION (Room: {room_id}) ===")
                await self._maybe_throttle(f"agent4:{room_id}")
                
                # Use pre-merged room checklist items
                room_items_raw = rooms_checklist.get("items", [])
                if "default" in rooms_checklist and "items" in rooms_checklist["default"]:
                    room_items_raw = rooms_checklist["default"]["items"]
                room_items = [AgentChecklistItem(**item) if isinstance(item, dict) else item for item in room_items_raw]
                room_chk_images = self.preprocessor.sample_for_checklist(room_images, k=3)
                logger.info(f"📊 [REQ-{request_id}] Agent 4 Input: {len(room_chk_images)} images, {len(room_items)} checklist items")
                
                room_checklist_input = ChecklistEvaluationInput(
                    images=room_chk_images,
                    checklist_items=room_items,
                    task_label=f"room checklist ({room_id})"
                )
                room_answers = await self.agents_service.evaluate_checklist(
                    room_checklist_input, self.cost_manager
                )
                total_room_items = len(room_answers.booleans) + len(room_answers.categoricals) + len(room_answers.conditionals)
                logger.info(f"✅ [REQ-{request_id}] Agent 4 Result: Room '{room_id}' checklist evaluated ({total_room_items} items)")
                
                # Agent 5: Products checklist (k=3 like original)
                logger.info(f"🚀 [REQ-{request_id}] === AGENT 5: PRODUCTS CHECKLIST EVALUATION (Room: {room_id}) ===")
                await self._maybe_throttle(f"agent5:{room_id}")
                
                # Use pre-merged product checklist items
                product_items_raw = products_checklist.get("items", [])
                if "default" in products_checklist and "items" in products_checklist["default"]:
                    product_items_raw = products_checklist["default"]["items"]
                product_items = [AgentChecklistItem(**item) if isinstance(item, dict) else item for item in product_items_raw]
                product_chk_images = self.preprocessor.sample_for_checklist(room_images, k=3)
                logger.info(f"📊 [REQ-{request_id}] Agent 5 Input: {len(product_chk_images)} images, {len(product_items)} product items")
                
                product_checklist_input = ChecklistEvaluationInput(
                    images=product_chk_images,
                    checklist_items=product_items,
                    task_label=f"products checklist ({room_id})"
                )
                product_answers = await self.agents_service.evaluate_checklist(
                    product_checklist_input, self.cost_manager
                )
                total_product_items = len(product_answers.booleans) + len(product_answers.categoricals) + len(product_answers.conditionals)
                logger.info(f"🛒 [REQ-{request_id}] Agent 5 Result: Room '{room_id}' products evaluated ({total_product_items} items)")
                
                # Add room result
                room_results.append(RoomResult(
                    room_id=room_id,
                    room_types=room_types,
                    issues=room_answers,
                    products=product_answers
                ))
                
                logger.info(f"✅ [REQ-{request_id}] Room '{room_id}' analysis completed")
            
            # Step 4: Generate summary and run Agent 6 (Pros/Cons)
            logger.info(f"🚀 [REQ-{request_id}] === AGENT 6: PROS/CONS ANALYSIS ===")
            summary = self.aggregator.generate_summary(house_answers, room_results)
            logger.info(f"📊 [REQ-{request_id}] Agent 6 Input: "
                       f"house_issues={len(summary['house'])}, "
                       f"room_issues={len(summary['rooms'])}, "
                       f"product_issues={len(summary['products'])}")
            
            await self._maybe_throttle("agent6")
            pros_cons_input = ProsConsAnalysisInput(
                house_issues=summary["house"],
                room_issues=summary["rooms"],
                product_issues=summary["products"]
            )
            pros_cons = await self.agents_service.analyze_pros_cons(
                pros_cons_input, self.cost_manager
            )
            logger.info(f"🔍 [REQ-{request_id}] Agent 6 Result: {len(pros_cons.pros)} pros, {len(pros_cons.cons)} cons generated")
            
            # Step 5: Create final result
            result = HouseResult(
                house_types=house_types,
                house_checklist=house_answers,
                rooms=room_results,
                summary=summary,
                pros_cons=pros_cons
            )
            
            logger.info(f"🎉 [REQ-{request_id}] === AGENT PIPELINE COMPLETE ===")
            logger.info(f"📊 [REQ-{request_id}] Pipeline summary: "
                       f"house_types={len(house_types)}, "
                       f"rooms_processed={len(room_results)}, "
                       f"pros={len(pros_cons.pros)}, "
                       f"cons={len(pros_cons.cons)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Agent pipeline failed: {str(e)}")
            raise
    
    async def _maybe_throttle(self, label: str):
        """Apply throttling if configured."""
        if self.settings.THROTTLE_MS > 0:
            throttle_seconds = self.settings.THROTTLE_MS / 1000.0
            logger.debug(f"⏱️ Throttling {label} for {throttle_seconds:.3f}s")
            await asyncio.sleep(throttle_seconds)
        
        # Token-based pacing
        current_usage = await self.cost_manager.get_current_usage()
        if BusinessRulesPolicy.should_throttle_request(current_usage, self.settings.TOKEN_PACE_LIMIT):
            logger.warning(f"⏸️ Token pace limit reached ({current_usage} >= {self.settings.TOKEN_PACE_LIMIT}); sleeping {self.settings.TOKEN_PACE_SLEEP}s before {label}")
            await asyncio.sleep(self.settings.TOKEN_PACE_SLEEP)