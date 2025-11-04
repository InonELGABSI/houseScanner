"""
LangGraph workflow definition for agent pipeline.

This module defines the complete workflow graph connecting all agents.
"""
import logging
import os
from typing import Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.infrastructure.orchestration.state import PipelineState
from app.infrastructure.orchestration.nodes import PipelineNodes
from app.infrastructure.orchestration.rate_limiter import RateLimiter
from app.application.services.preprocess import ImagePreprocessor
from app.application.services.aggregation import ResultAggregator
from app.application.services.cost_manager import CostManager
from app.infrastructure.llm.agents import AgentsService
from app.core.settings import Settings

logger = logging.getLogger(__name__)


class AgentPipelineGraph:
    """
    LangGraph workflow for the agent pipeline.
    
    Workflow:
    START → Agent1 (House Classification) 
          → Agent2 (House Checklist)
          → Process Rooms Parallel (Agent3, 4, 5 per room)
          → Agent6 (Pros/Cons)
          → END
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
        
        # Initialize helpers
        self.preprocessor = ImagePreprocessor(settings)
        self.aggregator = ResultAggregator()
        
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            tokens_per_minute=settings.RATE_LIMIT_TPM or 90000,
            requests_per_minute=settings.RATE_LIMIT_RPM or 500,
            max_concurrent=settings.MAX_CONCURRENT_CALLS or 3,
        )
        
        # Configure LangSmith tracing
        self._configure_langsmith(settings)
        
        # Initialize nodes
        self.nodes = PipelineNodes(
            agents_service=agents_service,
            cost_manager=cost_manager,
            preprocessor=self.preprocessor,
            aggregator=self.aggregator,
            rate_limiter=self.rate_limiter,
        )
        
        # Build the graph
        self.graph = self._build_graph()
        
        logger.info("🎯 LangGraph pipeline initialized")
    
    def _configure_langsmith(self, settings: Settings):
        """Configure LangSmith tracing."""
        if settings.LANGCHAIN_API_KEY:
            os.environ["LANGCHAIN_TRACING_V2"] = settings.LANGCHAIN_TRACING_V2
            os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
            os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
            os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
            logger.info(f"🔍 LangSmith tracing enabled for project: {settings.LANGCHAIN_PROJECT}")
        else:
            logger.info("🔍 LangSmith tracing disabled (no API key provided)")
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        # Create graph with our state schema
        workflow = StateGraph(PipelineState)
        
        # Add nodes (each node is an agent or processing step)
        workflow.add_node("agent1_classify_house", self.nodes.classify_house_types)
        workflow.add_node("agent2_house_checklist", self.nodes.evaluate_house_checklist)
        workflow.add_node("process_rooms_parallel", self.nodes.process_rooms_parallel)
        workflow.add_node("agent6_pros_cons", self.nodes.analyze_pros_cons)
        
        # Define the flow (edges)
        workflow.set_entry_point("agent1_classify_house")
        workflow.add_edge("agent1_classify_house", "agent2_house_checklist")
        workflow.add_edge("agent2_house_checklist", "process_rooms_parallel")
        workflow.add_edge("process_rooms_parallel", "agent6_pros_cons")
        workflow.add_edge("agent6_pros_cons", END)
        
        # Optional: Add conditional error handling
        # workflow.add_conditional_edges(
        #     "process_rooms_parallel",
        #     self._should_retry,
        #     {
        #         "retry": "process_rooms_parallel",
        #         "continue": "agent6_pros_cons",
        #     }
        # )
        
        # Compile the graph with checkpointing for persistence
        return workflow.compile(
            checkpointer=MemorySaver(),  # For state persistence/debugging
        )
    
    async def execute(
        self,
        request_id: str,
        all_images: list,
        rooms_map: dict,
        house_checklist: dict,
        rooms_checklist: dict,
        products_checklist: dict,
    ) -> PipelineState:
        """
        Execute the complete agent pipeline using LangGraph.
        
        Args:
            request_id: Unique request identifier
            all_images: All house images (preprocessed)
            rooms_map: Room ID to images mapping
            house_checklist: Pre-merged house checklist
            rooms_checklist: Pre-merged rooms checklist
            products_checklist: Pre-merged products checklist
            
        Returns:
            Final pipeline state with all results
        """
        logger.info(f"🚀 [REQ-{request_id}] Starting LangGraph pipeline")
        
        # Create initial state
        initial_state: PipelineState = {
            "request_id": request_id,
            "all_images": all_images,
            "rooms_map": rooms_map,
            "house_checklist": house_checklist,
            "rooms_checklist": rooms_checklist,
            "products_checklist": products_checklist,
            # Initialize all output fields that nodes will write to
            "house_types": [],
            "house_answers": {},
            "room_results": [],
            "summary": {},
            "pros_cons": {},
        }
        
        # Execute the graph
        config = {"configurable": {"thread_id": request_id}}
        
        try:
            # Execute the full pipeline
            final_state = await self.graph.ainvoke(initial_state, config)
            
            # Check for errors
            if final_state and final_state.get("error"):
                raise RuntimeError(f"Pipeline failed: {final_state['error']}")
            
            logger.info(f"✅ [REQ-{request_id}] LangGraph pipeline complete")
            
            # Debug state structure
            logger.info(f"🔍 [REQ-{request_id}] Final state keys: {list(final_state.keys()) if final_state else 'None'}")
            if final_state and 'house_types' in final_state:
                logger.info(f"🏠 [REQ-{request_id}] House types: {final_state['house_types']}")
            else:
                logger.error(f"❌ [REQ-{request_id}] Missing house_types in final state!")
            
            # Log rate limiter status
            status = await self.rate_limiter.get_status()
            logger.info(f"📊 [REQ-{request_id}] Rate limiter status: {status}")
            
            return final_state
            
        except Exception as e:
            logger.error(f"❌ [REQ-{request_id}] Pipeline execution failed: {e}")
            raise
    
    async def execute_with_streaming(
        self,
        request_id: str,
        all_images: list,
        rooms_map: dict,
        house_checklist: dict,
        rooms_checklist: dict,
        products_checklist: dict,
    ):
        """
        Execute pipeline with streaming intermediate results.
        
        Yields state updates after each node completion.
        Useful for real-time progress updates to clients.
        """
        initial_state: PipelineState = {
            "request_id": request_id,
            "all_images": all_images,
            "rooms_map": rooms_map,
            "house_checklist": house_checklist,
            "rooms_checklist": rooms_checklist,
            "products_checklist": products_checklist,
        }
        
        config = {"configurable": {"thread_id": request_id}}
        
        async for state_update in self.graph.astream(initial_state, config):
            yield state_update
    
    def _should_retry(self, state: PipelineState) -> str:
        """
        Conditional edge function for error handling.
        
        Returns "retry" or "continue" based on state.
        """
        if state.get("error") and state.get("retry_count", 0) < 3:
            return "retry"
        return "continue"
