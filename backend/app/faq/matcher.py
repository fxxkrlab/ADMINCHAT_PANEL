"""
FAQ text matching functions.

Each function takes the user's text and a keyword/pattern,
returning True if the text matches according to the mode's rules.
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


def match_exact(text: str, keyword: str) -> bool:
    """Full text equals keyword (case insensitive, stripped)."""
    return text.strip().lower() == keyword.strip().lower()


def match_prefix(text: str, keyword: str) -> bool:
    """Text starts with keyword (case insensitive)."""
    return text.strip().lower().startswith(keyword.strip().lower())


def match_contains(text: str, keyword: str) -> bool:
    """Keyword found anywhere in text (case insensitive)."""
    return keyword.strip().lower() in text.strip().lower()


def match_regex(text: str, pattern: str) -> bool:
    """Regex match with error handling. Returns True if pattern matches anywhere in text."""
    try:
        return re.search(pattern, text, re.IGNORECASE) is not None
    except re.error as exc:
        logger.warning("Invalid regex pattern %r: %s", pattern, exc)
        return False


def match_catch_all(text: str, _keyword: str) -> bool:
    """Always matches any non-empty text. Used as a low-priority fallback (e.g. for RAG)."""
    return bool(text and text.strip())


# Dispatch table keyed by match_mode value
MATCHERS = {
    "exact": match_exact,
    "prefix": match_prefix,
    "contains": match_contains,
    "regex": match_regex,
    "catch_all": match_catch_all,
}

# Priority order for tie-breaking within the same rule priority
# Lower number = checked first within the same rule
MODE_PRIORITY = {
    "exact": 0,
    "prefix": 1,
    "contains": 2,
    "regex": 3,
    "catch_all": 99,  # Always last — acts as fallback
}
