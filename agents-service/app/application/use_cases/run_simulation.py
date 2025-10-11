"""Use case for running simulations with local demo images."""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

from app.api.v1.model.response import SimulateResponse
from app.domain.models import HouseResult, RoomResult
from app.application.services.preprocess import ImagePreprocessor
from app.application.services.aggregation import ResultAggregator
from app.application.services.cost_manager import CostManager
from app.application.use_cases.run_agent_pipeline import RunAgentPipelineUseCase
from app.infrastructure.loaders.base_house_loader import BaseHouseLoader
from app.infrastructure.loaders.base_rooms_loader import BaseRoomsLoader
from app.infrastructure.loaders.base_products_loader import BaseProductsLoader
from app.infrastructure.loaders.custom_user_loader import CustomUserLoader
from app.infrastructure.storage.localfs import LocalFileStorage
from app.infrastructure.llm.agents import AgentsService
from app.core.settings import Settings
from app.domain.policies import ChecklistMergingPolicy

logger = logging.getLogger(__name__)


class RunSimulationUseCase:
    """
    Use case for orchestrating simulations with local demo images.
    
    Simulation Mode:
    - Loads base checklists from data folder files:
      * house_type_checklist.json
      * rooms_type_checklist.json  
      * products_type_checklist.json
      * custom_user_checklist.json
    - Merges base + custom locally to create final checklists
    - Passes merged results to generic agent pipeline
    - Used for testing and development with local data
    """
    
    def __init__(
        self,
        house_loader: BaseHouseLoader,
        rooms_loader: BaseRoomsLoader,
        products_loader: BaseProductsLoader,
        custom_user_loader: CustomUserLoader,
        local_storage: LocalFileStorage,
        agents_service: AgentsService,
        cost_manager: CostManager,
        settings: Settings,
    ):
        self.house_loader = house_loader
        self.rooms_loader = rooms_loader
        self.products_loader = products_loader
        self.custom_user_loader = custom_user_loader
        self.local_storage = local_storage
        self.agents_service = agents_service
        self.cost_manager = cost_manager
        self.settings = settings
        self.aggregator = ResultAggregator()
    
    async def execute(
        self,
        simulation_path: Path,
        request_id: str,
    ) -> SimulateResponse:
        """
        Execute the complete simulation pipeline.
        
        Args:
            simulation_path: Path to simulation directory with room folders
            request_id: Request identifier for tracking
            
        Returns:
            Complete simulation response
        """
        logger.info(f"🎮 [SIM-{request_id}] Starting simulation pipeline")
        start_time = time.time()
        
        try:
            # Step 1: Load local images from demo structure
            all_images, rooms_map = await self.local_storage.collect_simulation_images(simulation_path)
            
            if not rooms_map:
                raise ValueError("No room directories with valid images found")
            
            logger.info(f"📸 [SIM-{request_id}] Loaded {len(all_images)} images from {len(rooms_map)} rooms")
            
            # Step 2: Load base checklists and merge with custom (simulation-specific)
            house_checklist_base, rooms_checklist_base, products_checklist_base, custom_checklist = await asyncio.gather(
                self.house_loader.get_base_house_checklist(),
                self.rooms_loader.get_base_room_checklist(),
                self.products_loader.get_base_product_checklist(),
                self.custom_user_loader.get_custom_user_checklist()
            )
            
            # Merge checklists locally for simulation
            house_checklist = self._merge_house_checklist_for_simulation(house_checklist_base, custom_checklist)
            rooms_checklist = self._merge_rooms_checklist_for_simulation(rooms_checklist_base, custom_checklist)
            products_checklist = self._merge_products_checklist_for_simulation(products_checklist_base, custom_checklist)
            
            # Step 3: Create and run agent pipeline with merged checklists
            agent_pipeline = RunAgentPipelineUseCase(
                agents_service=self.agents_service,
                cost_manager=self.cost_manager,
                settings=self.settings
            )
            
            result = await agent_pipeline.execute(
                all_images=all_images,
                rooms_map=rooms_map,
                house_checklist=house_checklist,
                rooms_checklist=rooms_checklist,
                products_checklist=products_checklist,
                request_id=request_id
            )
            
            # Step 4: Generate client summary
            client_summary = self.aggregator.generate_client_summary(result)
            
            # Step 5: Collect cost information
            cost_info = await self.cost_manager.get_usage_summary()
            
            execution_time = time.time() - start_time
            metadata = {
                "request_id": request_id,
                "execution_time_seconds": round(execution_time, 2),
                "timestamp": datetime.utcnow().isoformat(),
                "simulation_path": str(simulation_path),
                "total_images": len(all_images),
                "rooms_processed": len(result.rooms),
                "pipeline_version": "2.0.0"
            }
            
            # Step 6: Log pipeline completion summary
            logger.info(f"📈 [SIM-{request_id}] === SIMULATION PIPELINE COMPLETE ===")
            logger.info(f"📊 [SIM-{request_id}] Total execution time: {execution_time:.2f}s")
            logger.info(f"📊 [SIM-{request_id}] Images processed: {len(all_images)} total")
            logger.info(f"📊 [SIM-{request_id}] Rooms analyzed: {len(result.rooms)} rooms")
            total_house_checklist = len(result.house_checklist.booleans) + len(result.house_checklist.categoricals) + len(result.house_checklist.conditionals)
            logger.info(f"📊 [SIM-{request_id}] House checklist: {total_house_checklist} items")
            logger.info(f"📊 [SIM-{request_id}] Pros/Cons: {len(result.pros_cons.pros)} pros, {len(result.pros_cons.cons)} cons")
            logger.info(f"💰 [SIM-{request_id}] Cost summary: {cost_info}")
            logger.info(f"✅ [SIM-{request_id}] Simulation completed successfully")
            
            return SimulateResponse(
                sim_root=str(simulation_path),
                result=result,
                client_summary=client_summary,
                cost_info=cost_info,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"❌ [SIM-{request_id}] Simulation failed: {str(e)}")
            raise
    
    def _merge_house_checklist_for_simulation(
        self, 
        base_checklist: Dict[str, Any], 
        custom_checklist: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge base house checklist with custom for simulation."""
        # For simulation, we assume all house types are possible
        house_types = list(base_checklist.get("house_types", {}).keys())
        merged_items = ChecklistMergingPolicy.merge_house_checklist(
            base_checklist, house_types, custom_checklist
        )
        return {"items": merged_items}
    
    def _merge_rooms_checklist_for_simulation(
        self, 
        base_checklist: Dict[str, Any], 
        custom_checklist: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge base rooms checklist with custom for simulation."""
        # For simulation, we assume all room types are possible
        room_types = list(base_checklist.get("room_types", {}).keys())
        
        # Merge for a generic room (simulation doesn't know specific room IDs yet)
        merged_items = ChecklistMergingPolicy.merge_room_checklist(
            base_checklist, room_types, "simulation_room", custom_checklist
        )
        return {"items": merged_items}
    
    def _merge_products_checklist_for_simulation(
        self, 
        base_checklist: Dict[str, Any], 
        custom_checklist: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge base products checklist with custom for simulation."""
        merged_items = ChecklistMergingPolicy.merge_product_checklist(
            base_checklist, None, "simulation_room", custom_checklist, None
        )
        return {"items": merged_items}
    
