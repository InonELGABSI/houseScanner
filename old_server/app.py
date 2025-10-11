from __future__ import annotations
import os
import logging
from pathlib import Path
from typing import Dict, List, Any, Tuple

from flask import Flask, request, jsonify, abort
from flask_cors import CORS
from dotenv import load_dotenv

from logging_config import setup_logging
from checklist_loader import load_all, merged_house_items, merged_room_items, merged_product_items
from agents import agent_types_from_images, agent_fill_checklist, agent_pros_cons, flatten_answers, _sample_images_for_classification
from schemas import HouseResult, RoomResult
from utils import checklist_to_issue_lines, collect_simulation_images
from token_usage import format_usage_summary, usage_totals

load_dotenv()

# Setup logging
setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# Validate required environment variables
if not os.environ.get("OPENAI_API_KEY"):
    logger.error("OPENAI_API_KEY environment variable is required")
    raise ValueError("OPENAI_API_KEY environment variable is required")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
logger.info("Flask application initialized")

# Load once at startup
HOUSE_JSON, ROOMS_JSON, PRODUCTS_JSON, CUSTOM_JSON = load_all()

# Base directory for simulation images; constrain traversal to this tree
SIM_ROOT = (Path(__file__).parent / "demo").resolve()

def _run_full_flow(all_images: List[bytes], rooms_map: Dict[str, List[bytes]], custom: Dict | None) -> Dict[str, Any]:
    """Run the complete house inspection flow with detailed logging."""
    logger.info("=== Starting Full House Inspection Flow ===")
    logger.info(f"Total images: {len(all_images)}, Rooms: {list(rooms_map.keys())}")
    
    custom = custom or CUSTOM_JSON
    logger.debug(f"Using custom checklist: {bool(custom != CUSTOM_JSON)}")

    # Throttle configuration (optional) for rate-limit friendliness
    import time as _time
    THROTTLE = int(os.getenv("SIM_THROTTLE_MS", "0")) / 1000.0
    def _maybe_throttle(label: str):
        if THROTTLE > 0:
            logger.debug(f"Throttling {label} for {THROTTLE:.3f}s")
            _time.sleep(THROTTLE)

    TOKEN_PACE_LIMIT = int(os.getenv("TOKEN_PACE_LIMIT", "160000"))  # below 200k TPM
    def _maybe_token_pace(label: str):
        totals = usage_totals()
        used = totals.get("total", 0)
        if used >= TOKEN_PACE_LIMIT:
            wait = float(os.getenv("TOKEN_PACE_SLEEP", "8"))
            logger.warning(f"Token pace reached {used} (>= {TOKEN_PACE_LIMIT}); sleeping {wait}s before {label}")
            _time.sleep(wait)

    # Agent 1: house types (sample images to reduce token load)
    logger.info("🏠 AGENT 1: Starting house type classification")
    allowed_house_types = list(HOUSE_JSON["house_types"].keys())
    logger.debug(f"Allowed house types: {allowed_house_types}")
    house_cls_imgs = _sample_images_for_classification(all_images, k=4)
    _maybe_throttle("agent1")
    _maybe_token_pace("agent1")
    house_types = agent_types_from_images(house_cls_imgs, allowed_house_types, "house type")
    logger.info(f"✅ AGENT 1 Complete: Detected house types: {house_types}")

    # Agent 2: house checklist
    logger.info("🏠 AGENT 2: Starting house checklist evaluation")
    house_items = merged_house_items(HOUSE_JSON, house_types, custom)
    logger.debug(f"House checklist items count: {len(house_items)}")
    
    _maybe_throttle("agent2")
    _maybe_token_pace("agent2")
    # Sample for checklist separate from classification (cap to minimize token load)
    house_chk_imgs = _sample_images_for_classification(all_images, k=6)
    house_answers = agent_fill_checklist(house_chk_imgs, house_items, "house checklist")
    house_flat = flatten_answers(house_answers)
    logger.info(f"✅ AGENT 2 Complete: House checklist evaluated ({len(house_flat)} items)")
    logger.debug(f"House answers summary: {_summarize_answers(house_flat)}")

    # Per-room: Agents 3/4/5
    logger.info("🏠 AGENTS 3-5: Starting per-room analysis")
    room_results: List[RoomResult] = []
    room_issue_lines: List[str] = []
    product_issue_lines: List[str] = []
    allowed_room_types = list(ROOMS_JSON["room_types"].keys())

    for i, (room_id, imgs) in enumerate(rooms_map.items(), 1):
        logger.info(f"📍 Processing room {i}/{len(rooms_map)}: '{room_id}' ({len(imgs)} images)")

        # Agent 3: room types (sample images)
        logger.info(f"🏠 AGENT 3: Room type classification for '{room_id}'")
        room_cls_imgs = _sample_images_for_classification(imgs, k=3)
        _maybe_throttle(f"agent3:{room_id}")
        _maybe_token_pace("agent3")
        room_types = agent_types_from_images(room_cls_imgs, allowed_room_types, "room type")
        logger.info(f"✅ AGENT 3 Complete: Room '{room_id}' types: {room_types}")

        # Agent 4: room checklist
        logger.info(f"🏠 AGENT 4: Room checklist evaluation for '{room_id}'")
        room_items = merged_room_items(ROOMS_JSON, room_types, custom, room_id)
        logger.debug(f"Room '{room_id}' checklist items count: {len(room_items)}")
        _maybe_throttle(f"agent4:{room_id}")
        _maybe_token_pace("agent4")
        room_chk_imgs = _sample_images_for_classification(imgs, k=3)
        room_answers = agent_fill_checklist(room_chk_imgs, room_items, f"room checklist ({room_id})")
        room_flat = flatten_answers(room_answers)
        logger.info(f"✅ AGENT 4 Complete: Room '{room_id}' checklist evaluated ({len(room_flat)} items)")
        logger.debug(f"Room '{room_id}' answers summary: {_summarize_answers(room_flat)}")

        # Agent 5: products checklist
        logger.info(f"🏠 AGENT 5: Products checklist evaluation for '{room_id}'")
        product_items = merged_product_items(PRODUCTS_JSON, custom, room_product_whitelist=None)
        logger.debug(f"Room '{room_id}' product items count: {len(product_items)}")
        _maybe_throttle(f"agent5:{room_id}")
        _maybe_token_pace("agent5")
        product_chk_imgs = _sample_images_for_classification(imgs, k=3)
        product_answers = agent_fill_checklist(product_chk_imgs, product_items, f"products checklist ({room_id})")
        product_flat = flatten_answers(product_answers)
        logger.info(f"✅ AGENT 5 Complete: Room '{room_id}' products evaluated ({len(product_flat)} items)")
        logger.debug(f"Room '{room_id}' products summary: {_summarize_answers(product_flat)}")

        # deterministic issue lines
        room_issues = checklist_to_issue_lines(f"room:{room_id}", room_flat)
        product_issues = checklist_to_issue_lines(f"product:{room_id}", product_flat)
        room_issue_lines += room_issues
        product_issue_lines += product_issues
        logger.debug(f"Room '{room_id}' issues found: {len(room_issues)} room, {len(product_issues)} product")

        room_results.append(RoomResult(
            room_id=room_id,
            room_types=room_types,
            issues=room_answers,
            products=product_answers
        ))

    logger.info("✅ Per-room analysis complete")

    # Generate summary
    house_issue_lines = checklist_to_issue_lines("house", house_flat)
    summary = {
        "house": house_issue_lines,
        "rooms": room_issue_lines,
        "products": product_issue_lines,
        "custom": [
            ln for ln in (house_issue_lines + room_issue_lines + product_issue_lines)
        ],
    }
    
    logger.info(f"📊 Issues summary: {len(house_issue_lines)} house, {len(room_issue_lines)} room, {len(product_issue_lines)} product")

    # Agent 6: pros/cons analysis
    logger.info("🏠 AGENT 6: Starting pros/cons analysis")
    _maybe_throttle("agent6")
    _maybe_token_pace("agent6")
    pros_cons = agent_pros_cons(house_issue_lines, room_issue_lines, product_issue_lines)
    logger.info(f"✅ AGENT 6 Complete: Generated {len(pros_cons.pros)} pros, {len(pros_cons.cons)} cons")
    logger.debug(f"Pros: {pros_cons.pros[:3]}...")  # Log first 3 pros
    logger.debug(f"Cons: {pros_cons.cons[:3]}...")  # Log first 3 cons

    result = HouseResult(
        house_types=house_types,
        house_checklist=house_answers,
        rooms=room_results,
        summary=summary,
        pros_cons=pros_cons
    )

    # -------- Client-focused summary (booleans true + categoricals) --------
    def _extract_true_and_cats(chk: Any) -> Dict[str, Any]:
        try:
            booleans_true = sorted([k for k, v in (chk.booleans or {}).items() if v is True])
            categoricals = {k: v for k, v in (chk.categoricals or {}).items()}
            return {"booleans_true": booleans_true, "categoricals": categoricals}
        except Exception:  # pragma: no cover
            return {"booleans_true": [], "categoricals": {}}

    client_summary: Dict[str, Any] = {
        "house": _extract_true_and_cats(house_answers),
        "rooms": {r.room_id: _extract_true_and_cats(r.issues) for r in room_results},
        "products": {r.room_id: _extract_true_and_cats(r.products) for r in room_results},
    "pros_cons": {"pros": pros_cons.pros, "cons": pros_cons.cons},
    }

    # Logging (info-level concise + debug-level detailed)
    house_true_ct = len(client_summary["house"]["booleans_true"])
    house_cat_ct = len(client_summary["house"]["categoricals"])
    rooms_true_ct = sum(len(v["booleans_true"]) for v in client_summary["rooms"].values())
    rooms_cat_ct = sum(len(v["categoricals"]) for v in client_summary["rooms"].values())
    prod_true_ct = sum(len(v["booleans_true"]) for v in client_summary["products"].values())
    prod_cat_ct = sum(len(v["categoricals"]) for v in client_summary["products"].values())
    logger.info(
        "🧾 CLIENT SUMMARY COUNTS: "
        f"house(true={house_true_ct}, cat={house_cat_ct}) | "
        f"rooms(true={rooms_true_ct}, cat={rooms_cat_ct}) | "
    f"products(true={prod_true_ct}, cat={prod_cat_ct}) | pros={len(pros_cons.pros)} cons={len(pros_cons.cons)}"
    )
    logger.debug(f"CLIENT SUMMARY DETAIL: {client_summary}")
    
    logger.info("=== Full House Inspection Flow Complete ===")
    logger.info(f"Token usage summary: {format_usage_summary()}")
    out = result.model_dump()
    out["client_summary"] = client_summary
    return out

def _summarize_answers(answers: Dict[str, Any]) -> str:
    """Create a summary of checklist answers for logging."""
    bools = sum(1 for v in answers.values() if isinstance(v, bool))
    cats = sum(1 for v in answers.values() if isinstance(v, str))
    conditionals = sum(1 for v in answers.values() if isinstance(v, dict))
    return f"{bools} boolean, {cats} categorical, {conditionals} conditional"

# ---------- existing JSON-uploaded flow ----------
def _read_images_list(raw_list: List[Dict[str, Any]]) -> List[bytes]:
    import base64
    out: List[bytes] = []
    for obj in raw_list:
        if "base64" in obj:
            out.append(base64.b64decode(obj["base64"]))
    return out

@app.post("/inspect")
def inspect():
    request_id = id(request)  # Simple request ID
    logger.info(f"📥 [REQ-{request_id}] New inspect request received")
    
    try:
        body = request.get_json(force=True)
        if not body:
            logger.warning(f"❌ [REQ-{request_id}] Invalid JSON payload")
            abort(400, description="Invalid JSON payload")
            
        custom = body.get("custom_checklist") or CUSTOM_JSON
        all_images = _read_images_list(body.get("all_images", []))
        rooms_map: Dict[str, List[bytes]] = {
            rid: _read_images_list(imgs) for rid, imgs in (body.get("rooms") or {}).items()
        }
        
        logger.info(f"📊 [REQ-{request_id}] Request details: {len(all_images)} total images, {len(rooms_map)} rooms")
        
        if not all_images and not rooms_map:
            logger.warning(f"❌ [REQ-{request_id}] No images provided")
            abort(400, description="No images provided")
            
        result = _run_full_flow(all_images, rooms_map, custom)
        
        logger.info(f"✅ [REQ-{request_id}] Inspect request completed successfully")
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ [REQ-{request_id}] Inspect request failed: {str(e)}")
        app.logger.error(f"Error in inspect endpoint: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# ---------- NEW: simulation flow that reads demo/room* folders ----------
@app.get("/simulate")
def simulate():
    """
    Query params:
      - root (optional): subfolder under SIM_ROOT (default 'demo' root itself)
        e.g. /simulate?root=demo to use SIM_ROOT directly
        e.g. /simulate?root=demo_variant to use SIM_ROOT/demo_variant if present
    Security: We only allow traversal under SIM_ROOT.
    """
    request_id = id(request)  # Simple request ID
    logger.info(f"📥 [SIM-{request_id}] New simulate request received")
    
    sub = request.args.get("root", "").strip()
    logger.debug(f"📁 [SIM-{request_id}] Requested root: '{sub}'")
    
    # Security: Only allow alphanumeric characters and underscores
    if sub and not sub.replace("_", "").isalnum():
        logger.warning(f"❌ [SIM-{request_id}] Invalid root path characters: '{sub}'")
        abort(400, description="Invalid root path characters.")
    
    # Resolve target - keep within SIM_ROOT's parent but prevent traversal attacks
    if not sub:
        target = SIM_ROOT
    else:
        target = (SIM_ROOT.parent / sub).resolve()
    
    # Ensure the target is inside the allowed SIM_ROOT parent folder
    allowed_base = SIM_ROOT.parent.resolve()
    if not str(target).startswith(str(allowed_base)):
        logger.warning(f"❌ [SIM-{request_id}] Path traversal attempt: '{target}'")
        abort(400, description="Invalid root path.")

    if not target.exists() or not target.is_dir():
        logger.warning(f"❌ [SIM-{request_id}] Folder not found: {target}")
        abort(404, description=f"Folder not found: {target}")

    logger.info(f"📁 [SIM-{request_id}] Using simulation directory: {target}")

    # Collect images: target is the directory that contains room* subfolders
    try:
        all_images, rooms_map = collect_simulation_images(target)
        logger.info(f"📊 [SIM-{request_id}] Collected {len(all_images)} images from {len(rooms_map)} rooms")
    except Exception as e:
        logger.error(f"❌ [SIM-{request_id}] Failed to collect images: {e}")
        abort(500, description="Failed to collect simulation images")

    if not rooms_map:
        logger.warning(f"❌ [SIM-{request_id}] No room subfolders with supported images were found")
        abort(400, description="No room subfolders with supported images were found.")

    try:
        result = _run_full_flow(all_images, rooms_map, custom=None)
        logger.info(f"✅ [SIM-{request_id}] Simulation completed successfully")
        
        return jsonify({
            "sim_root": str(target),
            **result
        }), 200
        
    except Exception as e:
        logger.error(f"❌ [SIM-{request_id}] Simulation failed: {e}")
        return jsonify({"error": "Simulation processing failed"}), 500

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "house-scanner",
        "version": "1.0.0"
    }), 200

if __name__ == "__main__":
    # export OPENAI_API_KEY=...
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=False)
