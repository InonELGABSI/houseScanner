"""Token usage tracking utilities for LLM calls.

We leverage LangChain callback handlers to capture token usage
reported by OpenAI responses. Each agent invocation attaches a
`TokenUsageHandler` with a label so we can attribute costs.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Dict, Any
import os
import logging

from langchain_core.callbacks import BaseCallbackHandler

logger = logging.getLogger("agents")

_TOTALS = defaultdict(int)  # key -> total tokens
_BREAKDOWN: Dict[str, Dict[str, int]] = {}  # label -> {prompt, completion, total}


PRICE_MAP = {
    # Approx public pricing (USD per 1K tokens). Adjust if OpenAI updates.
    "gpt-4o-mini": (0.00015, 0.00060),  # (prompt, completion)
}

_TOTALS_COST = 0.0
_BREAKDOWN_COST: Dict[str, float] = {}

def _price_for(model: str) -> tuple[float, float]:
    env_p = os.environ.get("OPENAI_PROMPT_COST_PER_1K")
    env_c = os.environ.get("OPENAI_COMPLETION_COST_PER_1K")
    if env_p and env_c:
        try:
            return float(env_p), float(env_c)
        except ValueError:
            pass
    return PRICE_MAP.get(model, (0.0, 0.0))


class TokenUsageHandler(BaseCallbackHandler):
    """Callback handler to log and aggregate token usage per agent call with cost estimation."""

    def __init__(self, label: str, model: str):
        self.label = label
        self.model = model

    def on_llm_end(self, response, **kwargs):  # type: ignore[override]
        global _TOTALS_COST
        try:
            llm_output = getattr(response, "llm_output", None) or {}
            usage: Dict[str, Any] = llm_output.get("token_usage") or llm_output.get("usage") or {}
            if not usage:
                return
            prompt = usage.get("prompt_tokens") or usage.get("prompt_tokens_total") or 0
            completion = usage.get("completion_tokens") or usage.get("completion_tokens_total") or 0
            total = usage.get("total_tokens") or (prompt + completion)
            _TOTALS["prompt"] += prompt
            _TOTALS["completion"] += completion
            _TOTALS["total"] += total

            p_price, c_price = _price_for(self.model)
            cost = (prompt / 1000.0) * p_price + (completion / 1000.0) * c_price
            _TOTALS_COST += cost
            _BREAKDOWN[self.label] = {
                "prompt": prompt,
                "completion": completion,
                "total": total,
            }
            _BREAKDOWN_COST[self.label] = cost
            logger.info(
                f"[TOKENS] {self.label}: prompt={prompt} completion={completion} total={total} cost=${cost:.4f} (agg_tokens={_TOTALS['total']} agg_cost=${_TOTALS_COST:.4f})"
            )
        except Exception as e:  # pragma: no cover - defensive
            logger.debug(f"Token usage handler failed: {e}")


def usage_totals() -> Dict[str, int]:
    """Return current aggregate token totals."""
    return dict(_TOTALS)


def usage_breakdown() -> Dict[str, Dict[str, int]]:
    """Return per-label usage snapshot."""
    return {k: dict(v) for k, v in _BREAKDOWN.items()}


def format_usage_summary() -> str:
    if not _TOTALS:
        return "No token usage captured yet."
    parts = [f"TOTAL prompt={_TOTALS['prompt']} completion={_TOTALS['completion']} total={_TOTALS['total']}"]
    if _BREAKDOWN_COST:
        total_cost = sum(_BREAKDOWN_COST.values())
        parts[0] += f" cost=${total_cost:.4f}"
    for label, stats in sorted(_BREAKDOWN.items()):
        c = _BREAKDOWN_COST.get(label)
        cost_part = f" cost=${c:.4f}" if c is not None else ""
        parts.append(
            f" - {label}: p={stats['prompt']} c={stats['completion']} t={stats['total']}{cost_part}"
        )
    return " | ".join(parts)
