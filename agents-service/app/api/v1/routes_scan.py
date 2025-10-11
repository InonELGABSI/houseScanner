"""Scan API routes - handles POST /v1/scan/run with URLs + user custom."""
from __future__ import annotations

import logging
import uuid
from typing import Dict, List, Any

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.api.v1.model.request import ScanRequest
from app.api.v1.model.response import ScanResponse, ErrorResponse
from app.application.use_cases.run_scan import RunScanUseCase
from app.core.deps import (
    SettingsDep,
    HouseLoaderDep,
    RoomsLoaderDep,
    ProductsLoaderDep,
    CustomUserLoaderDep,
    ImageFetcherDep,
    AgentsServiceDep,
    CostManagerDep,
    AgentTrackerDep,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/run", response_model=ScanResponse)
async def run_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    settings: SettingsDep,
    house_loader: HouseLoaderDep,
    rooms_loader: RoomsLoaderDep,
    products_loader: ProductsLoaderDep,
    custom_user_loader: CustomUserLoaderDep,
    image_fetcher: ImageFetcherDep,
    agents_service: AgentsServiceDep,
    cost_manager: CostManagerDep,
    agent_tracker: AgentTrackerDep,
):
    """
    Run a comprehensive house scan using image URLs and final merged checklists.
    
    This endpoint receives:
    - Room image URLs for analysis
    - Final merged checklists (client handles base + custom merging)
    
    The service has no knowledge of base vs custom checklists - it processes
    whatever final checklists the client provides after their own merging logic.
    
    Orchestrates the complete Agent 1-6 pipeline for house analysis.
    """
    request_id = str(uuid.uuid4())
    logger.info(f"📥 [REQ-{request_id}] New scan request received")
    logger.debug(f"📊 [REQ-{request_id}] Request: {len(request.rooms)} rooms")
    
    try:
        # Validate request
        if not request.rooms:
            logger.warning(f"❌ [REQ-{request_id}] No rooms provided")
            raise HTTPException(
                status_code=400,
                detail="At least one room must be provided"
            )
        
        # Initialize scan use case
        use_case = RunScanUseCase(
            image_fetcher=image_fetcher,
            agents_service=agents_service,
            cost_manager=cost_manager,
            execution_tracker=agent_tracker,
            settings=settings,
        )
        
        # Execute scan with final merged checklists from request
        # Client is responsible for merging base + custom before sending
        result = await use_case.execute(
            rooms_data=request.rooms,
            house_checklist=request.house_checklist,    # Final merged checklist
            rooms_checklist=request.rooms_checklist,    # Final merged checklist  
            products_checklist=request.products_checklist,  # Final merged checklist
            request_id=request_id,
        )
        
        # Add background task for cleanup if needed
        background_tasks.add_task(
            _cleanup_scan_resources,
            request_id=request_id
        )
        
        logger.info(f"✅ [REQ-{request_id}] Scan completed successfully")
        return JSONResponse(
            content=result.model_dump(),
            status_code=200
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [REQ-{request_id}] Scan failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


async def _cleanup_scan_resources(request_id: str):
    """Clean up resources after scan completion."""
    try:
        logger.debug(f"🧹 [REQ-{request_id}] Cleaning up scan resources")
        # Add any cleanup logic here (temp files, cache entries, etc.)
    except Exception as e:
        logger.warning(f"⚠️ [REQ-{request_id}] Cleanup failed: {e}")


@router.get("/health")
async def scan_health():
    """Health check for scan service."""
    return JSONResponse({
        "service": "scan",
        "status": "healthy",
        "capabilities": ["image_url_processing", "custom_checklists", "full_pipeline"]
    })