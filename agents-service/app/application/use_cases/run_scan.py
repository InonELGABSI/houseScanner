"""Use case for running house scans with image URLs."""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.api.v1.model.request import RoomData
from app.api.v1.model.response import ScanResponse
from app.domain.models import HouseResult, RoomResult
from app.application.services.preprocess import ImagePreprocessor
from app.application.services.aggregation import ResultAggregator
from app.application.services.cost_manager import CostManager
from app.application.use_cases.run_agent_pipeline_langgraph import RunAgentPipelineLangGraphUseCase
from app.infrastructure.storage.fetch import ImageFetcher
from app.infrastructure.llm.agents import AgentsService
from app.core.settings import Settings

logger = logging.getLogger(__name__)


class RunScanUseCase:
    """
    Use case for orchestrating the complete scan pipeline with URLs.
    
    """
    
    def __init__(
        self,
        image_fetcher: ImageFetcher,
        agents_service: AgentsService,
        cost_manager: CostManager,
        execution_tracker,
        settings: Settings,
    ):
        self.image_fetcher = image_fetcher
        self.agents_service = agents_service
        self.cost_manager = cost_manager
        self.execution_tracker = execution_tracker
        self.settings = settings
        self.preprocessor = ImagePreprocessor(settings)
        self.aggregator = ResultAggregator()
    
    async def execute(
        self,
        rooms_data: List[RoomData],
        house_checklist: Dict[str, Any],
        rooms_checklist: Dict[str, Any],
        products_checklist: Dict[str, Any],
        request_id: str,
    ) -> ScanResponse:
        """
        Execute the complete scan pipeline.
        
        Args:
            rooms_data: List of room data with image URLs
            house_checklist: Pre-merged house checklist (basic + custom unified)
            rooms_checklist: Pre-merged rooms checklist (basic + custom unified)
            products_checklist: Pre-merged products checklist (basic + custom unified)
            request_id: Request identifier for tracking
            
        Returns:
            Complete scan response
        """
        logger.info(f"🚀 [REQ-{request_id}] Starting scan pipeline")
        start_time = time.time()
        
        try:
            # Step 1: Fetch and preprocess images
            all_images, rooms_map = await self._fetch_and_preprocess_images(
                rooms_data, request_id
            )
            
            if not all_images:
                raise ValueError("No images were successfully fetched")
            
            logger.info(f"📸 [REQ-{request_id}] Preprocessed {len(all_images)} images from {len(rooms_map)} rooms")
            
            # Step 2: Create and run agent pipeline with pre-merged checklists
            agent_pipeline = RunAgentPipelineLangGraphUseCase(
                agents_service=self.agents_service,
                cost_manager=self.cost_manager,
                settings=self.settings,
                execution_tracker=self.execution_tracker
            )
            
            result = await agent_pipeline.execute(
                all_images=all_images,
                rooms_map=rooms_map,
                house_checklist=house_checklist,
                rooms_checklist=rooms_checklist,
                products_checklist=products_checklist,
                request_id=request_id
            )
            
            # Step 3: Generate client summary with checklist metadata preserved
            client_summary = self.aggregator.generate_client_summary(
                result,
                house_checklist_def=house_checklist,
                rooms_checklist_def=rooms_checklist,
                products_checklist_def=products_checklist
            )
            
            # Step 4: Collect cost information and agent executions
            cost_info = await self.cost_manager.get_usage_summary()
            agent_executions = self.execution_tracker.get_executions()
            
            execution_time = time.time() - start_time
            
            metadata = {
                "request_id": request_id,
                "execution_time_seconds": round(execution_time, 2),
                "timestamp": datetime.utcnow().isoformat(),
                "total_images": len(all_images),
                "rooms_processed": len(result.rooms),
                "pipeline_version": "2.0.0",
                "total_agent_executions": len(agent_executions)
            }
            
            logger.info(f"🎉 [REQ-{request_id}] === SCAN PIPELINE COMPLETE ===")
            logger.info(f"⏱️  [REQ-{request_id}] Total execution time: {execution_time:.2f}s")
            logger.info(f"💰 [REQ-{request_id}] Total tokens used: {cost_info['tokens']['total_tokens']}")
            logger.info(f"📝 [REQ-{request_id}] Total agent executions recorded: {len(agent_executions)}")
            logger.info(f"📊 [REQ-{request_id}] Pipeline summary: "
                       f"house_types={len(result.house_types)}, "
                       f"rooms_processed={len(result.rooms)}, "
                       f"pros={len(result.pros_cons.pros)}, "
                       f"cons={len(result.pros_cons.cons)}")
            
            return ScanResponse(
                result=result,
                client_summary=client_summary,
                cost_info=cost_info,
                agent_executions=agent_executions,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Scan failed: {str(e)}")
            raise
    
    async def _fetch_and_preprocess_images(
        self, 
        rooms_data: List[RoomData], 
        request_id: str
    ) -> tuple[List[bytes], Dict[str, List[bytes]]]:
        """Fetch and preprocess images from URLs."""
        all_images = []
        rooms_map = {}
        
        for room_data in rooms_data:
            room_id = room_data.room_id
            image_urls = room_data.image_urls
            
            if not image_urls:
                logger.warning(f"⚠️ [REQ-{request_id}] No URLs for room '{room_id}'")
                continue
            
            logger.debug(f"📥 [REQ-{request_id}] Fetching {len(image_urls)} images for room '{room_id}'")
            
            # Fetch images
            room_images = await self.image_fetcher.fetch_multiple(image_urls)
            
            if room_images:
                # Preprocess images
                processed_images = [
                    self.preprocessor.process_image_bytes(img_bytes)
                    for img_bytes in room_images
                    if img_bytes is not None
                ]
                
                rooms_map[room_id] = processed_images
                all_images.extend(processed_images)
                
                logger.debug(f"✅ [REQ-{request_id}] Room '{room_id}': {len(processed_images)} images processed")
            else:
                logger.warning(f"⚠️ [REQ-{request_id}] No valid images fetched for room '{room_id}'")
        
        return all_images, rooms_map
    
