"""HTTP image fetcher for scan URLs."""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from httpx import AsyncClient

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class ImageFetcher:
    """Service for fetching images from HTTP/HTTPS URLs."""
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[AsyncClient] = None
    
    async def _get_client(self) -> AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = AsyncClient(
                timeout=httpx.Timeout(30.0),  # 30 second timeout
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                headers={
                    "User-Agent": "HouseCheck/2.0 Image Fetcher"
                }
            )
        return self._client
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def fetch_single(self, url: str) -> Optional[bytes]:
        """
        Fetch a single image from URL.
        
        Args:
            url: Image URL to fetch
            
        Returns:
            Image bytes or None if fetch failed
        """
        if not self._validate_url(url):
            logger.warning(f"Invalid or unsafe URL: {url}")
            return None
        
        try:
            client = await self._get_client()
            
            logger.debug(f"📥 Fetching image: {url}")
            response = await client.get(url)
            response.raise_for_status()
            
            # Validate content type
            content_type = response.headers.get('content-type', '').lower()
            if not self._is_image_content_type(content_type):
                logger.warning(f"Non-image content type for {url}: {content_type}")
                return None
            
            # Validate content length
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > 50_000_000:  # 50MB limit
                logger.warning(f"Image too large at {url}: {content_length} bytes")
                return None
            
            image_bytes = response.content
            
            # Additional size check on actual content
            if len(image_bytes) > 50_000_000:
                logger.warning(f"Fetched image too large: {len(image_bytes)} bytes")
                return None
            
            if len(image_bytes) < 100:  # Suspiciously small
                logger.warning(f"Suspiciously small image: {len(image_bytes)} bytes")
                return None
            
            logger.debug(f"✅ Fetched image: {len(image_bytes)} bytes")
            return image_bytes
            
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error fetching {url}: {e.response.status_code}")
            return None
        except httpx.RequestError as e:
            logger.warning(f"Request error fetching {url}: {e}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error fetching {url}: {e}")
            return None
    
    async def fetch_multiple(self, urls: List[str]) -> List[bytes]:
        """
        Fetch multiple images concurrently.
        
        Args:
            urls: List of image URLs to fetch
            
        Returns:
            List of successfully fetched image bytes (excludes failed fetches)
        """
        if not urls:
            return []
        
        logger.info(f"📥 Fetching {len(urls)} images")
        
        # Limit concurrent requests to avoid overwhelming servers
        semaphore = asyncio.Semaphore(5)
        
        async def fetch_with_semaphore(url: str) -> Optional[bytes]:
            async with semaphore:
                return await self.fetch_single(url)
        
        # Fetch all images concurrently
        results = await asyncio.gather(
            *[fetch_with_semaphore(url) for url in urls],
            return_exceptions=True
        )
        
        # Filter successful results
        successful_images = []
        failed_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Exception fetching URL {i}: {result}")
                failed_count += 1
            elif result is not None:
                successful_images.append(result)
            else:
                failed_count += 1
        
        logger.info(f"✅ Fetched {len(successful_images)} images, {failed_count} failed")
        return successful_images
    
    def _validate_url(self, url: str) -> bool:
        """
        Validate URL for safety and correctness.
        
        Args:
            url: URL to validate
            
        Returns:
            True if URL is valid and safe
        """
        try:
            parsed = urlparse(url)
            
            # Must be HTTP or HTTPS
            if parsed.scheme not in ('http', 'https'):
                return False
            
            # Must have a hostname
            if not parsed.hostname:
                return False
            
            # Block local/private networks for security (unless allowed in settings)
            if not self.settings.ALLOW_LOCALHOST_URLS:
                if parsed.hostname in ('localhost', '127.0.0.1', '::1'):
                    logger.warning(f"Blocked localhost URL: {url}")
                    return False
                
                # Block private IP ranges (basic check)
                if (parsed.hostname.startswith('10.') or 
                    parsed.hostname.startswith('192.168.') or
                    parsed.hostname.startswith('172.')):
                    logger.warning(f"Blocked private IP URL: {url}")
                    return False
            
            # URL length check
            if len(url) > 2048:
                logger.warning(f"URL too long: {len(url)} characters")
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"URL validation error: {e}")
            return False
    
    def _is_image_content_type(self, content_type: str) -> bool:
        """
        Check if content type indicates an image.
        
        Args:
            content_type: HTTP Content-Type header value
            
        Returns:
            True if content type is for an image
        """
        image_types = {
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/bmp',
            'image/tiff',
            'image/gif'
        }
        
        # Extract main content type (ignore charset, etc.)
        main_type = content_type.split(';')[0].strip().lower()
        return main_type in image_types