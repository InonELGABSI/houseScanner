import base64
import logging
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageOps  # Pillow

logger = logging.getLogger(__name__)

# ---------- data: URLs for multimodal inputs ----------
def to_data_url(img_bytes: bytes, mime: str = "image/jpeg") -> str:
    """Convert image bytes to data URL."""
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:{mime};base64,{b64}"

# ---------- image normalization for simulation ----------
def load_image_as_jpeg_bytes(path: Path, max_edge: int = 1024, quality: int = 80) -> bytes:
    """
    Open any raster image (png/jpg/webp...), fix EXIF orientation,
    clamp longest edge to `max_edge` preserving aspect ratio, and
    return progressive JPEG bytes for compact uploads.
    
    Args:
        path: Path to image file
    max_edge: Maximum edge length (reduced to 1024 to cut tokenized payload size)
    quality: JPEG quality (1-95) (slightly reduced to 80 for smaller payload)
        
    Returns:
        JPEG bytes
        
    Raises:
        ValueError: If image cannot be processed
        FileNotFoundError: If file doesn't exist
    """
    try:
        if not path.exists():
            raise FileNotFoundError(f"Image file not found: {path}")
            
        with Image.open(path) as im:
            # Validate image
            if im.size[0] * im.size[1] > 50_000_000:  # 50MP limit
                raise ValueError(f"Image too large: {im.size}")
                
            im = ImageOps.exif_transpose(im)  # handle orientation
            im = im.convert("RGB")
            im.thumbnail((max_edge, max_edge))  # keeps aspect ratio
            
            buf = BytesIO()
            im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
            result = buf.getvalue()
            
            logger.debug(f"Processed image {path}: {len(result)} bytes")
            return result
            
    except Exception as e:
        logger.error(f"Failed to process image {path}: {e}")
        raise ValueError(f"Cannot process image {path}: {e}")

def collect_simulation_images(root: Path) -> Tuple[List[bytes], Dict[str, List[bytes]]]:
    """
    Expect structure:
      root/
        room1/
          *.png|jpg|jpeg|webp
        room2/
          ...
    Returns (all_images, rooms_map)
    """
    SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    rooms_map: Dict[str, List[bytes]] = {}
    all_images: List[bytes] = []
    for room_dir in sorted([p for p in root.iterdir() if p.is_dir()]):
        imgs: List[bytes] = []
        for file in sorted(room_dir.iterdir()):
            if file.suffix.lower() in SUPPORTED:
                b = load_image_as_jpeg_bytes(file)
                imgs.append(b)
                all_images.append(b)
        if imgs:
            rooms_map[room_dir.name] = imgs
    return all_images, rooms_map

# ---------- deterministic summary helpers ----------
NEGATIVE_CATS = {"Poor"}
BORDERLINE_CATS = {"Average"}
OK_CATS = {"Good", "Excellent", "N/A"}

PROBLEM_IF_TRUE = {"damage", "issue", "pest", "leak", "mold", "crack"}
PROBLEM_IF_FALSE = {"functional", "access", "lighting", "exists", "window", "toilet", "shower", "sink"}

def _bool_issue(id_: str, val: bool) -> bool:
    lid = id_.lower()
    if any(k in lid for k in PROBLEM_IF_TRUE):
        return val is True
    if any(k in lid for k in PROBLEM_IF_FALSE):
        return val is False
    return False

def _cat_issue(id_: str, cat: str) -> bool:
    if cat in NEGATIVE_CATS: return True
    if cat in BORDERLINE_CATS: return True
    return False

def checklist_to_issue_lines(scope: str, answers: Dict) -> List[str]:
    issues: List[str] = []
    for k, v in answers.items():
        if isinstance(v, bool) and _bool_issue(k, v):
            issues.append(f"{scope}: {k} = {v}")
        elif isinstance(v, str) and _cat_issue(k, v):
            issues.append(f"{scope}: {k} = {v}")
        elif isinstance(v, dict):
            exists = v.get("exists")
            cond = v.get("condition")
            sub = v.get("subitems", {})
            if exists and (cond in NEGATIVE_CATS or cond in BORDERLINE_CATS):
                issues.append(f"{scope}: {k} condition = {cond}")
            for sk, sval in sub.items():
                if _cat_issue(sk, sval):
                    issues.append(f"{scope}: {k}.{sk} = {sval}")
    return issues
