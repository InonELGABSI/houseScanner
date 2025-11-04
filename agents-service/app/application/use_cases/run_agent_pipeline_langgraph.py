"""
Use case for running the agent pipeline with LangGraph orchestration.

This is the new LangGraph-powered version that replaces the sequential pipeline.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Any

from app.domain.models import HouseResult
from app.application.services.cost_manager import CostManager
from app.infrastructure.llm.agents import AgentsService
from app.infrastructure.orchestration.workflow import AgentPipelineGraph
from app.core.settings import Settings

logger = logging.getLogger(__name__)


class RunAgentPipelineLangGraphUseCase:
    """
    LangGraph-powered agent pipeline with parallel room processing.
    
    Key improvements over sequential version:
    - Parallel room processing (3x-5x faster for multi-room scans)
    - Built-in rate limiting (TPM/RPM compliance)
    - Semaphore-based concurrency control
    - State checkpointing for debugging
    - Streamable intermediate results
    - Visual workflow representation
    
    Architecture:
    - Uses LangGraph for workflow orchestration
    - Implements token bucket rate limiting
    - Limits concurrent LLM calls with semaphores
    - Processes all rooms in parallel (Agents 3, 4, 5)
    """
    
    def __init__(
        self,
        agents_service: AgentsService,
        cost_manager: CostManager,
        settings: Settings,
        execution_tracker=None,
    ):
        self.agents_service = agents_service
        self.cost_manager = cost_manager
        self.settings = settings
        self.execution_tracker = execution_tracker
        
        # Initialize LangGraph workflow
        self.graph = AgentPipelineGraph(
            agents_service=agents_service,
            cost_manager=cost_manager,
            settings=settings,
        )
        
        logger.info("✅ LangGraph pipeline use case initialized")
    
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
        Execute the complete agent pipeline with LangGraph orchestration.
        
        Args:
            all_images: List of all preprocessed image bytes
            rooms_map: Dictionary mapping room_id to list of preprocessed image bytes
            house_checklist: Pre-merged house checklist
            rooms_checklist: Pre-merged rooms checklist
            products_checklist: Pre-merged products checklist
            request_id: Request identifier for tracking
            
        Returns:
            Complete house analysis result
        """
        logger.info(f"🤖 [REQ-{request_id}] Starting LangGraph agent pipeline")
        logger.info(
            f"📊 [REQ-{request_id}] Input: "
            f"{len(all_images)} images, {len(rooms_map)} rooms"
        )
        
        try:
            # Execute the graph
            final_state = await self.graph.execute(
                request_id=request_id,
                all_images=all_images,
                rooms_map=rooms_map,
                house_checklist=house_checklist,
                rooms_checklist=rooms_checklist,
                products_checklist=products_checklist,
            )
            
            # Extract results from final state
            result = HouseResult(
                house_types=final_state["house_types"],
                house_checklist=final_state["house_answers"],
                rooms=final_state["room_results"],
                summary=final_state["summary"],
                pros_cons=final_state["pros_cons"],
            )
            
            logger.info(f"🎉 [REQ-{request_id}] === LANGGRAPH PIPELINE COMPLETE ===")
            logger.info(
                f"📊 [REQ-{request_id}] Pipeline summary: "
                f"house_types={len(result.house_types)}, "
                f"rooms_processed={len(result.rooms)}, "
                f"pros={len(result.pros_cons.pros)}, "
                f"cons={len(result.pros_cons.cons)}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] LangGraph pipeline failed: {str(e)}")
            raise
    
    async def execute_with_streaming(
        self,
        all_images: List[bytes],
        rooms_map: Dict[str, List[bytes]],
        house_checklist: Dict[str, Any],
        rooms_checklist: Dict[str, Any],
        products_checklist: Dict[str, Any],
        request_id: str,
    ):
        """
        Execute pipeline with streaming intermediate results.
        
        Useful for sending real-time progress updates to clients via WebSocket.
        
        Yields:
            State updates after each node completion
        """
        logger.info(f"🌊 [REQ-{request_id}] Starting streaming pipeline execution")
        
        async for state_update in self.graph.execute_with_streaming(
            request_id=request_id,
            all_images=all_images,
            rooms_map=rooms_map,
            house_checklist=house_checklist,
            rooms_checklist=rooms_checklist,
            products_checklist=products_checklist,
        ):
            # Yield intermediate state to caller
            yield state_update
