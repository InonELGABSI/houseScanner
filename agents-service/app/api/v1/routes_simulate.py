"""Simulate API routes - handles GET /v1/simulate with local demo + custom checklist."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.api.v1.model.response import SimulateResponse, ErrorResponse
from app.application.use_cases.run_simulation import RunSimulationUseCase
from app.core.deps import (
    SettingsDep,
    HouseLoaderDep,
    RoomsLoaderDep,
    ProductsLoaderDep,
    CustomUserLoaderDep,
    LocalStorageDep,
    AgentsServiceDep,
    CostManagerDep,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=SimulateResponse)
async def simulate(
    settings: SettingsDep,
    house_loader: HouseLoaderDep,
    rooms_loader: RoomsLoaderDep,
    products_loader: ProductsLoaderDep,
    custom_user_loader: CustomUserLoaderDep,
    local_storage: LocalStorageDep,
    agents_service: AgentsServiceDep,
    cost_manager: CostManagerDep,
    root: str = Query(
        default="",
        description="Subfolder under demo directory (default: demo root itself)"
    ),
):
    """
    Run a simulation using local demo images and data folder checklists.
    
    Simulation Mode (different from production scan):
    - Loads base checklists from data folder files
    - Loads custom checklist from custom_user_checklist.json  
    - Merges base + custom locally before processing
    - Processes local demo images from directory structure
    
    This contrasts with production scan which receives final merged checklists
    and has no knowledge of base/custom concepts.
    
    Query params:
      - root: subfolder under demo directory (e.g., 'variant1', 'test_case_2')
              If empty, uses demo root directly
    """
    request_id = str(uuid.uuid4())
    logger.info(f"📥 [SIM-{request_id}] New simulation request received")
    logger.debug(f"📁 [SIM-{request_id}] Requested root: '{root}'")
    
    try:
        # Validate and resolve simulation root path
        demo_root = settings.DEMO_DIR
        
        if root:
            # Security: Only allow alphanumeric characters and underscores
            if not root.replace("_", "").replace("-", "").isalnum():
                logger.warning(f"❌ [SIM-{request_id}] Invalid root path characters: '{root}'")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid root path characters. Only alphanumeric, underscores, and hyphens allowed."
                )
            
            target_path = demo_root / root
        else:
            target_path = demo_root
        
        # Resolve and validate path security
        resolved_path = target_path.resolve()
        demo_root_resolved = demo_root.resolve()
        
        # Ensure target is within demo directory (prevent path traversal)
        if not str(resolved_path).startswith(str(demo_root_resolved)):
            logger.warning(f"❌ [SIM-{request_id}] Path traversal attempt: '{resolved_path}'")
            raise HTTPException(
                status_code=400,
                detail="Invalid root path - path traversal not allowed."
            )
        
        if not resolved_path.exists() or not resolved_path.is_dir():
            logger.warning(f"❌ [SIM-{request_id}] Folder not found: {resolved_path}")
            raise HTTPException(
                status_code=404,
                detail=f"Simulation folder not found: {resolved_path.name}"
            )
        
        logger.info(f"📁 [SIM-{request_id}] Using simulation directory: {resolved_path}")
        
        # Initialize simulation use case
        use_case = RunSimulationUseCase(
            house_loader=house_loader,
            rooms_loader=rooms_loader,
            products_loader=products_loader,
            custom_user_loader=custom_user_loader,
            local_storage=local_storage,
            agents_service=agents_service,
            cost_manager=cost_manager,
            settings=settings,
        )
        
        # Execute simulation
        result = await use_case.execute(
            simulation_path=resolved_path,
            request_id=request_id,
        )
        
        logger.info(f"✅ [SIM-{request_id}] Simulation completed successfully")
        return JSONResponse(
            content=result.model_dump(),
            status_code=200
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [SIM-{request_id}] Simulation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Simulation processing failed: {str(e)}"
        )


@router.get("/health")
async def simulate_health():
    """Health check for simulate service."""
    return JSONResponse({
        "service": "simulate", 
        "status": "healthy",
        "capabilities": ["local_demo_processing", "custom_user_checklists", "full_pipeline"]
    })


@router.get("/available")
async def list_available_simulations(settings: SettingsDep):
    """List available simulation directories."""
    try:
        demo_root = settings.DEMO_DIR
        
        if not demo_root.exists():
            return JSONResponse({
                "available_simulations": [],
                "demo_root": str(demo_root),
                "status": "demo_directory_not_found"
            })
        
        # Find directories with room subdirectories containing images
        available = []
        for item in demo_root.iterdir():
            if item.is_dir():
                # Check if it has room* subdirectories with images
                room_dirs = [d for d in item.iterdir() if d.is_dir() and d.name.startswith('room')]
                if room_dirs:
                    room_count = len(room_dirs)
                    image_count = sum(
                        len([f for f in room_dir.iterdir() 
                             if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}])
                        for room_dir in room_dirs
                    )
                    available.append({
                        "name": item.name,
                        "path": str(item.relative_to(demo_root)),
                        "rooms": room_count,
                        "images": image_count
                    })
        
        return JSONResponse({
            "available_simulations": available,
            "demo_root": str(demo_root),
            "status": "success"
        })
        
    except Exception as e:
        logger.error(f"❌ Failed to list simulations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list available simulations: {str(e)}"
        )