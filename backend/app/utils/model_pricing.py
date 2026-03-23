"""
Model pricing table and cost estimation.

Prices are per-token in USD, sourced from public provider pricing pages.
Updated: 2026-03-23
"""
from __future__ import annotations

import re
from typing import Dict, Tuple

# (input_cost_per_token, output_cost_per_token)
# Prices in USD per token (not per million tokens)
MODEL_PRICING: Dict[str, Tuple[float, float]] = {
    # OpenAI
    "gpt-4o": (2.5e-06, 10e-06),
    "gpt-4o-mini": (0.15e-06, 0.6e-06),
    "gpt-4.1": (2e-06, 8e-06),
    "gpt-4.1-mini": (0.4e-06, 1.6e-06),
    "gpt-4.1-nano": (0.1e-06, 0.4e-06),
    "gpt-4-turbo": (10e-06, 30e-06),
    "gpt-4": (30e-06, 60e-06),
    "gpt-3.5-turbo": (0.5e-06, 1.5e-06),
    "o1": (15e-06, 60e-06),
    "o1-mini": (3e-06, 12e-06),
    "o1-pro": (150e-06, 600e-06),
    "o3": (10e-06, 40e-06),
    "o3-mini": (1.1e-06, 4.4e-06),
    "o4-mini": (1.1e-06, 4.4e-06),
    # Anthropic
    "claude-opus-4": (15e-06, 75e-06),
    "claude-sonnet-4": (3e-06, 15e-06),
    "claude-3.5-sonnet": (3e-06, 15e-06),
    "claude-3-opus": (15e-06, 75e-06),
    "claude-3-sonnet": (3e-06, 15e-06),
    "claude-3-haiku": (0.25e-06, 1.25e-06),
    "claude-3.5-haiku": (1e-06, 5e-06),
    # Google
    "gemini-2.0-flash": (0.1e-06, 0.4e-06),
    "gemini-2.5-pro": (1.25e-06, 10e-06),
    "gemini-2.5-flash": (0.15e-06, 0.6e-06),
    "gemini-1.5-pro": (1.25e-06, 5e-06),
    "gemini-1.5-flash": (0.075e-06, 0.3e-06),
    # DeepSeek
    "deepseek-chat": (0.27e-06, 1.1e-06),
    "deepseek-reasoner": (0.55e-06, 2.19e-06),
}

# Compiled regex to strip date/version suffixes like "-2024-08-06", "-20241120", "-latest"
_SUFFIX_RE = re.compile(
    r"[-_](?:\d{4}[-_]?\d{2}[-_]?\d{2}|\d{8}|latest|preview|exp|v\d+)$",
    re.IGNORECASE,
)


def _normalize_model_name(model: str) -> str:
    """Normalize a model name for fuzzy lookup."""
    name = model.strip().lower()
    # Strip date/version suffixes repeatedly
    prev = ""
    while prev != name:
        prev = name
        name = _SUFFIX_RE.sub("", name)
    return name


def estimate_cost(
    model: str | None,
    prompt_tokens: int | None,
    completion_tokens: int | None,
) -> float:
    """
    Estimate cost in USD for the given model and token counts.
    Returns 0.0 for unknown models (never crashes).
    """
    if not model:
        return 0.0
    prompt_tokens = prompt_tokens or 0
    completion_tokens = completion_tokens or 0

    normalized = _normalize_model_name(model)

    # 1. Exact match
    if normalized in MODEL_PRICING:
        inp, out = MODEL_PRICING[normalized]
        return prompt_tokens * inp + completion_tokens * out

    # 2. Substring match (e.g., "gpt-4o" in "ft:gpt-4o-custom")
    for key, (inp, out) in MODEL_PRICING.items():
        if key in normalized or normalized in key:
            return prompt_tokens * inp + completion_tokens * out

    return 0.0
