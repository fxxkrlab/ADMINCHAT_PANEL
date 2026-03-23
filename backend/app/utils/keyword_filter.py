"""
Utility for matching keywords against filter patterns.

Used by both the scheduler (to skip keywords during analysis)
and the API (to auto-resolve existing keywords on filter creation).
"""
from __future__ import annotations

import re


def keyword_matches_filter(keyword: str, pattern: str, match_mode: str) -> bool:
    """Check if a keyword matches a filter pattern."""
    kw = keyword.lower()
    pat = pattern.lower()
    if match_mode == "exact":
        return kw == pat
    elif match_mode == "prefix":
        return kw.startswith(pat)
    elif match_mode == "contains":
        return pat in kw
    elif match_mode == "regex":
        try:
            return bool(re.search(pattern, keyword, re.IGNORECASE))
        except re.error:
            return False
    return False
