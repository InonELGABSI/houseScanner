"""Cost management and token usage tracking service."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class UsageMetrics:
    """Token usage metrics for tracking costs."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    requests: int = 0
    model_usage: Dict[str, int] = field(default_factory=dict)
    agent_usage: Dict[str, int] = field(default_factory=dict)
    
    def add_usage(self, prompt: int, completion: int, model: str, agent: str = None):
        """Add usage data to metrics."""
        self.prompt_tokens += prompt
        self.completion_tokens += completion
        self.total_tokens += prompt + completion
        self.requests += 1
        
        self.model_usage[model] = self.model_usage.get(model, 0) + prompt + completion
        
        if agent:
            self.agent_usage[agent] = self.agent_usage.get(agent, 0) + prompt + completion


class CostManager:
    """Service for managing API costs and token usage."""
    
    def __init__(self):
        self._usage = UsageMetrics()
        self._start_time = datetime.utcnow()
    
    def record_usage(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str,
        agent: str = None
    ) -> None:
        """
        Record token usage for cost tracking.
        
        Args:
            prompt_tokens: Number of prompt tokens used
            completion_tokens: Number of completion tokens used
            model: Model name used
            agent: Agent identifier (optional)
        """
        self._usage.add_usage(prompt_tokens, completion_tokens, model, agent)
        
        total_tokens = prompt_tokens + completion_tokens
        logger.info(
            f"💰 TOKEN USAGE [{agent or 'unknown'}]: "
            f"total={total_tokens} (prompt={prompt_tokens}, completion={completion_tokens}) "
            f"model={model} | running_total={self._usage.total_tokens}"
        )
    
    async def get_current_usage(self) -> int:
        """Get current total token usage."""
        return self._usage.total_tokens
    
    async def get_usage_summary(self) -> Dict[str, Any]:
        """
        Get comprehensive usage summary with cost estimates.
        
        Returns:
            Dictionary with usage statistics and cost estimates
        """
        duration = (datetime.utcnow() - self._start_time).total_seconds()
        
        # Basic cost estimates (approximate rates)
        cost_estimates = self._calculate_cost_estimates()
        
        return {
            "tokens": {
                "prompt_tokens": self._usage.prompt_tokens,
                "completion_tokens": self._usage.completion_tokens,
                "total_tokens": self._usage.total_tokens,
            },
            "requests": {
                "total_requests": self._usage.requests,
                "avg_tokens_per_request": (
                    self._usage.total_tokens / max(self._usage.requests, 1)
                ),
            },
            "models": dict(self._usage.model_usage),
            "agents": dict(self._usage.agent_usage),
            "costs": cost_estimates,
            "session": {
                "duration_seconds": round(duration, 2),
                "start_time": self._start_time.isoformat(),
                "tokens_per_second": round(self._usage.total_tokens / max(duration, 1), 2),
            }
        }
    
    def _calculate_cost_estimates(self) -> Dict[str, Any]:
        """Calculate estimated costs based on current OpenAI pricing."""
        # Approximate pricing (as of 2024) - should be updated regularly
        pricing = {
            "gpt-4o-mini": {
                "prompt": 0.000150,  # per 1K tokens
                "completion": 0.000600,  # per 1K tokens
            },
            "gpt-4o": {
                "prompt": 0.005,
                "completion": 0.015,
            },
            "gpt-4": {
                "prompt": 0.03,
                "completion": 0.06,
            }
        }
        
        total_cost = 0.0
        model_costs = {}
        
        for model, tokens in self._usage.model_usage.items():
            model_pricing = pricing.get(model, pricing["gpt-4o-mini"])  # default fallback
            
            # Estimate split between prompt and completion (rough approximation)
            prompt_ratio = self._usage.prompt_tokens / max(self._usage.total_tokens, 1)
            completion_ratio = 1 - prompt_ratio
            
            estimated_prompt_tokens = tokens * prompt_ratio
            estimated_completion_tokens = tokens * completion_ratio
            
            model_cost = (
                (estimated_prompt_tokens / 1000) * model_pricing["prompt"] +
                (estimated_completion_tokens / 1000) * model_pricing["completion"]
            )
            
            model_costs[model] = {
                "tokens": tokens,
                "estimated_cost_usd": round(model_cost, 4)
            }
            total_cost += model_cost
        
        return {
            "total_estimated_usd": round(total_cost, 4),
            "by_model": model_costs,
            "pricing_note": "Estimates based on approximate OpenAI pricing, may not reflect actual costs"
        }
    
    def reset_usage(self) -> None:
        """Reset usage tracking (for new session)."""
        self._usage = UsageMetrics()
        self._start_time = datetime.utcnow()
        logger.info("💰 Usage tracking reset")
    
    def get_formatted_summary(self) -> str:
        """Get a formatted string summary of usage."""
        return (
            f"Tokens: {self._usage.total_tokens:,} "
            f"(prompt: {self._usage.prompt_tokens:,}, "
            f"completion: {self._usage.completion_tokens:,}) | "
            f"Requests: {self._usage.requests} | "
            f"Models: {len(self._usage.model_usage)}"
        )