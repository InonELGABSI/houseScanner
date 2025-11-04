"""
Rate limiting and concurrency control for LLM API calls.

Implements token bucket algorithm for TPM/RPM limits and semaphore
for concurrent request limiting.
"""
import asyncio
import logging
from time import time
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter for OpenAI API compliance.
    
    Handles both:
    - TPM (Tokens Per Minute) limits
    - RPM (Requests Per Minute) limits
    
    Uses token bucket algorithm for smooth rate limiting.
    """
    
    def __init__(
        self,
        tokens_per_minute: int = 90000,
        requests_per_minute: int = 500,
        max_concurrent: int = 3,
    ):
        """
        Initialize rate limiter.
        
        Args:
            tokens_per_minute: Maximum tokens allowed per minute (TPM)
            requests_per_minute: Maximum requests allowed per minute (RPM)
            max_concurrent: Maximum concurrent LLM calls (semaphore limit)
        """
        # Token bucket for TPM
        self.tpm_capacity = tokens_per_minute
        self.tpm_tokens = float(tokens_per_minute)
        
        # Token bucket for RPM
        self.rpm_capacity = requests_per_minute
        self.rpm_tokens = float(requests_per_minute)
        
        # Last refill timestamp
        self.last_refill = time()
        
        # Concurrency semaphore (limits parallel calls)
        self.semaphore = asyncio.Semaphore(max_concurrent)
        
        # Lock for thread-safe bucket updates
        self._lock = asyncio.Lock()
        
        logger.info(
            f"🔒 Rate limiter initialized: "
            f"TPM={tokens_per_minute}, RPM={requests_per_minute}, "
            f"max_concurrent={max_concurrent}"
        )
    
    async def acquire(
        self,
        estimated_tokens: int = 1000,
        request_label: str = "unknown",
    ) -> None:
        """
        Acquire permission to make an LLM call.
        
        This will:
        1. Wait for semaphore slot (concurrent limit)
        2. Wait until token buckets have enough capacity
        3. Deduct tokens from buckets
        
        Args:
            estimated_tokens: Estimated tokens for this request
            request_label: Label for logging purposes
        """
        # First, acquire semaphore (limits concurrent calls)
        await self.semaphore.acquire()
        
        try:
            # Then wait for token bucket capacity
            while True:
                async with self._lock:
                    self._refill_buckets()
                    
                    # Check if we have enough tokens
                    if (self.tpm_tokens >= estimated_tokens and 
                        self.rpm_tokens >= 1):
                        # Deduct tokens
                        self.tpm_tokens -= estimated_tokens
                        self.rpm_tokens -= 1
                        
                        logger.debug(
                            f"✅ Rate limit acquired for {request_label}: "
                            f"tokens={estimated_tokens}, "
                            f"remaining_tpm={self.tpm_tokens:.0f}, "
                            f"remaining_rpm={self.rpm_tokens:.0f}"
                        )
                        return
                
                # Not enough tokens, wait before retrying
                wait_time = self._calculate_wait_time(estimated_tokens)
                logger.warning(
                    f"⏸️ Rate limit reached for {request_label}, "
                    f"waiting {wait_time:.2f}s "
                    f"(TPM: {self.tpm_tokens:.0f}/{self.tpm_capacity}, "
                    f"RPM: {self.rpm_tokens:.0f}/{self.rpm_capacity})"
                )
                await asyncio.sleep(wait_time)
                
        except Exception:
            # Release semaphore on error
            self.semaphore.release()
            raise
    
    def release(self) -> None:
        """Release the semaphore slot after LLM call completes."""
        self.semaphore.release()
    
    def _refill_buckets(self) -> None:
        """Refill token buckets based on elapsed time."""
        now = time()
        elapsed = now - self.last_refill
        
        if elapsed <= 0:
            return
        
        # Refill TPM bucket (proportional to time elapsed)
        tpm_refill = (elapsed / 60.0) * self.tpm_capacity
        self.tpm_tokens = min(self.tpm_capacity, self.tpm_tokens + tpm_refill)
        
        # Refill RPM bucket
        rpm_refill = (elapsed / 60.0) * self.rpm_capacity
        self.rpm_tokens = min(self.rpm_capacity, self.rpm_tokens + rpm_refill)
        
        self.last_refill = now
    
    def _calculate_wait_time(self, needed_tokens: int) -> float:
        """
        Calculate how long to wait before retrying.
        
        Returns wait time in seconds.
        """
        # Calculate time needed for TPM refill
        if self.tpm_tokens < needed_tokens:
            tpm_deficit = needed_tokens - self.tpm_tokens
            tpm_wait = (tpm_deficit / self.tpm_capacity) * 60.0
        else:
            tpm_wait = 0
        
        # Calculate time needed for RPM refill
        if self.rpm_tokens < 1:
            rpm_deficit = 1 - self.rpm_tokens
            rpm_wait = (rpm_deficit / self.rpm_capacity) * 60.0
        else:
            rpm_wait = 0
        
        # Use the longer wait time
        wait_time = max(tpm_wait, rpm_wait, 0.5)  # Minimum 0.5s
        return min(wait_time, 10.0)  # Cap at 10s
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current rate limiter status."""
        async with self._lock:
            self._refill_buckets()
            return {
                "tpm_available": int(self.tpm_tokens),
                "tpm_capacity": self.tpm_capacity,
                "tpm_utilization": f"{(1 - self.tpm_tokens / self.tpm_capacity) * 100:.1f}%",
                "rpm_available": int(self.rpm_tokens),
                "rpm_capacity": self.rpm_capacity,
                "rpm_utilization": f"{(1 - self.rpm_tokens / self.rpm_capacity) * 100:.1f}%",
                "concurrent_slots_available": self.semaphore._value,
            }


class RateLimitedCall:
    """Context manager for rate-limited LLM calls."""
    
    def __init__(
        self,
        rate_limiter: RateLimiter,
        estimated_tokens: int,
        request_label: str,
    ):
        self.rate_limiter = rate_limiter
        self.estimated_tokens = estimated_tokens
        self.request_label = request_label
    
    async def __aenter__(self):
        await self.rate_limiter.acquire(
            self.estimated_tokens,
            self.request_label,
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.rate_limiter.release()
        return False
