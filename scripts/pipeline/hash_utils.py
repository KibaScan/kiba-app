"""
M3 Shared Utility: Ingredients Hash (D-044)

Normalization and SHA-256 hashing of ingredient strings.
Used by both the import pipeline (Session 1) and change detection (Session 3).

IMPORTANT: Do NOT alphabetize ingredients before hashing.
Order reflects proportion per AAFCO labeling rules.
"""

import hashlib
import re
from typing import Optional


def normalize_ingredients(ingredients_raw: str) -> str:
    """Normalize ingredient string for consistent hashing.

    Steps:
    1. Lowercase
    2. Collapse whitespace
    3. Standardize separators to comma-space
    4. Trim each entry
    5. Join (preserving original order)
    """
    normalized = ingredients_raw.lower().strip()
    normalized = re.sub(r'\s+', ' ', normalized)
    normalized = re.sub(r'\s*,\s*', ', ', normalized)
    parts = [p.strip() for p in normalized.split(',')]
    return ', '.join(p for p in parts if p)


def compute_ingredients_hash(ingredients_raw: Optional[str]) -> Optional[str]:
    """Normalize and SHA-256 hash ingredient string per D-044."""
    if not ingredients_raw:
        return None
    normalized = normalize_ingredients(ingredients_raw)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
