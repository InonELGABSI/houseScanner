"""Local file system storage for demo images."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Tuple, Any
from io import BytesIO

from PIL import Image, ImageOps

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class LocalFileStorage:
    """Storage service for reading local demo images."""
    
    def __init__(self):
        self.settings = get_settings()
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}
    
    async def collect_simulation_images(
        self, 
        simulation_path: Path
    ) -> Tuple[List[bytes], Dict[str, List[bytes]]]:
        """
        Collect images from local simulation directory structure.
        
        Expected structure:
        simulation_path/
        ├── room1/
        │   ├── image1.jpg
        │   └── image2.png
        └── room2/
            ├── image3.jpg
            └── image4.png
        
        Args:
            simulation_path: Path to simulation directory
            
        Returns:
            Tuple of (all_images, rooms_map) where:
            - all_images: List of all image bytes
            - rooms_map: Dict mapping room_id to list of image bytes
        """
        logger.info(f"📁 Collecting images from: {simulation_path}")
        
        if not simulation_path.exists() or not simulation_path.is_dir():
            raise FileNotFoundError(f"Simulation directory not found: {simulation_path}")
        
        all_images = []
        rooms_map = {}
        
        # Find room directories
        room_dirs = [
            d for d in simulation_path.iterdir() 
            if d.is_dir() and d.name.startswith('room')
        ]
        
        if not room_dirs:
            logger.warning(f"No room directories found in {simulation_path}")
            raise ValueError(f"No room* directories found in {simulation_path}")
        
        for room_dir in sorted(room_dirs):
            room_id = room_dir.name
            room_images = await self._load_room_images(room_dir)
            
            if room_images:
                rooms_map[room_id] = room_images
                all_images.extend(room_images)
                logger.info(f"📸 Room '{room_id}': loaded {len(room_images)} images")
            else:
                logger.warning(f"⚠️ Room '{room_id}': no valid images found")
        
        if not rooms_map:
            raise ValueError("No rooms with valid images found")
        
        logger.info(f"✅ Collected {len(all_images)} total images from {len(rooms_map)} rooms")
        return all_images, rooms_map
    
    async def _load_room_images(self, room_dir: Path) -> List[bytes]:
        """
        Load and process all images from a room directory.
        
        Args:
            room_dir: Path to room directory
            
        Returns:
            List of processed image bytes
        """
        images = []
        
        # Find all image files
        image_files = [
            f for f in room_dir.iterdir()
            if f.is_file() and f.suffix.lower() in self.supported_formats
        ]
        
        if not image_files:
            return images
        
        # Sort files for consistent ordering
        image_files.sort(key=lambda x: x.name)
        
        for image_file in image_files:
            try:
                image_bytes = await self._load_and_process_image(image_file)
                if image_bytes:
                    images.append(image_bytes)
                    logger.debug(f"✅ Loaded: {image_file.name}")
                else:
                    logger.warning(f"⚠️ Failed to process: {image_file.name}")
            except Exception as e:
                logger.warning(f"⚠️ Error loading {image_file.name}: {e}")
        
        return images
    
    async def _load_and_process_image(self, image_file: Path) -> bytes | None:
        """
        Load and process a single image file.
        
        Args:
            image_file: Path to image file
            
        Returns:
            Processed JPEG bytes or None if processing failed
        """
        try:
            # Read file
            with open(image_file, 'rb') as f:
                file_bytes = f.read()
            
            # Process image
            return self._process_image_bytes(file_bytes)
            
        except Exception as e:
            logger.warning(f"Failed to load image {image_file}: {e}")
            return None
    
    def _process_image_bytes(
        self, 
        img_bytes: bytes, 
        max_edge: int = None, 
        quality: int = None
    ) -> bytes:
        """
        Process image bytes: fix orientation, resize, and optimize.
        
        Args:
            img_bytes: Raw image bytes
            max_edge: Maximum edge length (defaults to settings)
            quality: JPEG quality (defaults to settings)
            
        Returns:
            Processed JPEG bytes
        """
        if max_edge is None:
            max_edge = self.settings.MAX_IMAGE_EDGE
        if quality is None:
            quality = self.settings.IMAGE_QUALITY
        
        try:
            with Image.open(BytesIO(img_bytes)) as im:
                # Validate image size
                if im.size[0] * im.size[1] > 50_000_000:  # 50MP limit
                    logger.warning(f"Large image detected: {im.size}, will be downscaled")
                
                # Fix EXIF orientation and convert to RGB
                im = ImageOps.exif_transpose(im)
                im = im.convert("RGB")
                
                # Resize preserving aspect ratio
                im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
                
                # Save as optimized JPEG
                output = BytesIO()
                im.save(
                    output,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                    progressive=True
                )
                
                return output.getvalue()
                
        except Exception as e:
            logger.warning(f"Image processing failed: {e}")
            # Return original bytes if processing fails
            return img_bytes
    
    async def get_available_simulations(self, demo_root: Path = None) -> List[Dict[str, Any]]:
        """
        Get list of available simulation directories.
        
        Args:
            demo_root: Optional demo root path (defaults to settings)
            
        Returns:
            List of simulation info dictionaries
        """
        if demo_root is None:
            demo_root = self.settings.DEMO_DIR
        
        simulations = []
        
        if not demo_root.exists():
            return simulations
        
        for item in demo_root.iterdir():
            if item.is_dir():
                # Check if it has room* subdirectories with images
                room_dirs = [
                    d for d in item.iterdir() 
                    if d.is_dir() and d.name.startswith('room')
                ]
                
                if room_dirs:
                    # Count images
                    total_images = 0
                    for room_dir in room_dirs:
                        image_files = [
                            f for f in room_dir.iterdir()
                            if f.is_file() and f.suffix.lower() in self.supported_formats
                        ]
                        total_images += len(image_files)
                    
                    simulations.append({
                        "name": item.name,
                        "path": str(item.relative_to(demo_root)),
                        "rooms": len(room_dirs),
                        "images": total_images
                    })
        
        return simulations