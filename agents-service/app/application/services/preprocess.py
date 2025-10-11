"""Image preprocessing and optimization service."""
from __future__ import annotations

import logging
from io import BytesIO
from typing import List

from PIL import Image, ImageOps

from app.core.settings import Settings

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """Service for preprocessing images before agent processing."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def sample_for_classification(self, images: List[bytes], k: int = None) -> List[bytes]:
        """
        Deterministically sample images for type classification.
        
        Strategy: first, two mid points, last. Matches original server logic.
        
        Args:
            images: List of image bytes
            k: Number of images to sample (defaults to settings.MAX_CLASSIFY_IMAGES)
            
        Returns:
            Sampled and optimized images
        """
        if k is None:
            k = self.settings.MAX_CLASSIFY_IMAGES
            
        if len(images) <= k:
            return [self._optimize_for_classification(img) for img in images]
        
        # Original deterministic sampling strategy - matches _sample_images_for_classification
        indices = {0, len(images)//3, (2*len(images))//3, len(images)-1}
        sampled = [images[i] for i in sorted(indices)]
        
        return [self._optimize_for_classification(img) for img in sampled]
    
    def sample_for_checklist(self, images: List[bytes], k: int = None) -> List[bytes]:
        """
        Sample and optimize images for checklist evaluation.
        
        Args:
            images: List of image bytes
            k: Number of images to sample (defaults to settings.MAX_CHECKLIST_IMAGES)
            
        Returns:
            Sampled and optimized images
        """
        if k is None:
            k = self.settings.MAX_CHECKLIST_IMAGES
            
        if len(images) <= k:
            return [self._optimize_for_checklist(img) for img in images]
        
        # Take first k images for checklist (could implement different strategies)
        sampled = images[:k]
        return [self._optimize_for_checklist(img) for img in sampled]
    
    def process_image_bytes(self, img_bytes: bytes) -> bytes:
        """
        Process raw image bytes to standard format.
        
        Args:
            img_bytes: Raw image bytes
            
        Returns:
            Processed JPEG bytes
        """
        return self._normalize_image(
            img_bytes, 
            self.settings.MAX_IMAGE_EDGE, 
            self.settings.IMAGE_QUALITY
        )
    
    def _optimize_for_classification(self, img_bytes: bytes) -> bytes:
        """Optimize image for classification (smaller size, lower quality)."""
        return self._normalize_image(
            img_bytes,
            self.settings.CLASSIFY_MAX_EDGE,
            self.settings.CLASSIFY_QUALITY
        )
    
    def _optimize_for_checklist(self, img_bytes: bytes) -> bytes:
        """Optimize image for checklist evaluation (medium size, good quality)."""
        return self._normalize_image(
            img_bytes,
            self.settings.CHECKLIST_MAX_EDGE,
            self.settings.CHECKLIST_QUALITY
        )
    
    def _normalize_image(self, img_bytes: bytes, max_edge: int, quality: int) -> bytes:
        """
        Normalize image: fix orientation, resize, and recompress as JPEG.
        
        Args:
            img_bytes: Input image bytes
            max_edge: Maximum edge length
            quality: JPEG quality (1-95)
            
        Returns:
            Optimized JPEG bytes
        """
        try:
            with Image.open(BytesIO(img_bytes)) as im:
                # Validate image size
                if im.size[0] * im.size[1] > 50_000_000:  # 50MP limit
                    logger.warning(f"Image too large: {im.size}, will be heavily downscaled")
                
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
            logger.warning(f"Image processing failed, returning original: {e}")
            return img_bytes