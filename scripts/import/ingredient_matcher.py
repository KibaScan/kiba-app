"""
M3 Import Pipeline — Ingredient Matching Logic

Reusable matcher for exact + fuzzy ingredient matching against ingredients_dict.
Used by parse_ingredients.py (batch pipeline) and later by OCR Edge Function flow.
"""

import json
import re
from collections import Counter
from pathlib import Path
from typing import NamedTuple


SYNONYMS_PATH = Path(__file__).resolve().parent / 'synonyms.json'

# Prefixes stripped for matching (display name preserved separately)
STRIP_PREFIXES = [
    # Multi-word prefixes first (longer match takes priority)
    'natural and artificial', 'whole grain', 'whole ground',
    'freeze-dried', 'freeze dried',
    # Single-word prefixes
    'dehydrated', 'dried', 'ground', 'whole',
    'plain', 'organic', 'natural', 'fresh', 'deboned', 'raw',
    'hydrolyzed', 'fermented', 'powdered', 'smoked', 'roasted',
]


def levenshtein(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if not s2:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(
                prev[j + 1] + 1,
                curr[j] + 1,
                prev[j] + (c1 != c2),
            ))
        prev = curr
    return prev[-1]


def load_synonyms() -> dict[str, str]:
    """Load synonym mappings from synonyms.json."""
    if SYNONYMS_PATH.exists():
        with open(SYNONYMS_PATH) as f:
            return json.load(f)
    return {}


def _normalize_key(s: str) -> str:
    """Minimal normalization for dictionary key comparison.

    Applied to both dict canonical_names and normalized input
    to ensure consistent matching regardless of stored format.
    """
    s = s.lower().strip()
    s = s.replace('-', '')
    s = re.sub(r'\s+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)
    return s


def normalize_ingredient(raw: str, synonyms: dict[str, str] | None = None) -> str:
    """Normalize raw ingredient text to canonical form for matching.

    Pipeline Stage 3: lowercase, strip parens, apply synonyms,
    strip prefixes/suffixes, convert to underscore format.
    """
    s = raw.strip()
    # Fix common OCR/scrape artifacts: "VitaminE" -> "Vitamin E" (before lowering)
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
    s = s.lower()
    s = re.sub(r'\.+$', '', s).strip()

    # Strip parenthetical/bracket content (preserved in display_name, not for matching)
    s = re.sub(r'\s*\(.*?\)', '', s).strip()
    s = re.sub(r'\s*\[.*?\]', '', s).strip()

    # Check synonym table first (before prefix stripping)
    if synonyms and s in synonyms:
        return synonyms[s]

    # Strip known prefixes and re-check synonyms
    for prefix in STRIP_PREFIXES:
        pat = re.compile(r'^' + re.escape(prefix) + r'\s+', re.IGNORECASE)
        s_stripped = pat.sub('', s)
        if s_stripped != s:
            s = s_stripped
            if synonyms and s in synonyms:
                return synonyms[s]

    # Strip "supplement" suffix
    s = re.sub(r'\s+supplement$', '', s)
    if synonyms and s in synonyms:
        return synonyms[s]

    # Chelate/proteinate collapsing
    chelate_match = re.match(
        r'^(zinc|iron|copper|manganese|cobalt)\s+'
        r'(?:amino acid |protein |polysaccharide )?'
        r'(?:chelate|complex|proteinate)',
        s
    )
    if chelate_match:
        return chelate_match.group(1) + '_chelated'

    # Final: strip hyphens, spaces to underscores, remove non-alphanumeric
    s = s.replace('-', '')
    s = re.sub(r'\s+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)

    return s


class MatchResult(NamedTuple):
    ingredient_id: str | None
    canonical_name: str | None
    tier: str  # 'exact', 'fuzzy', 'new', 'empty'
    raw: str
    normalized: str
    fuzzy_distance: int | None = None


class IngredientMatcher:
    """Matches ingredient strings against ingredients_dict entries.

    Used by parse_ingredients.py (batch) and reusable for OCR Edge Function.
    """

    def __init__(self, dict_entries: list[dict], synonyms: dict[str, str] | None = None):
        self.synonyms = synonyms or {}
        self.stats = Counter()

        # Build lookup: normalized_key → dict entry
        self.lookup: dict[str, dict] = {}
        for entry in dict_entries:
            key = _normalize_key(entry['canonical_name'])
            self.lookup[key] = entry

        self.all_keys = list(self.lookup.keys())

    def add_entry(self, entry: dict):
        """Add a new entry to the matcher (after inserting into DB)."""
        key = _normalize_key(entry['canonical_name'])
        self.lookup[key] = entry
        self.all_keys.append(key)

    def match(self, raw: str) -> MatchResult:
        """Match a raw ingredient string. Returns MatchResult with tier."""
        normalized = normalize_ingredient(raw, self.synonyms)

        if not normalized:
            self.stats['empty'] += 1
            return MatchResult(None, None, 'empty', raw, '')

        key = _normalize_key(normalized)

        # Tier A: Exact match
        if key in self.lookup:
            entry = self.lookup[key]
            self.stats['exact'] += 1
            return MatchResult(entry['id'], entry['canonical_name'],
                               'exact', raw, normalized)

        # Tier B: Fuzzy match (Levenshtein distance)
        max_dist = 3 if len(key) > 15 else 2
        best_key = None
        best_dist = max_dist + 1
        ties = 0

        for dict_key in self.all_keys:
            # Quick length filter
            if abs(len(dict_key) - len(key)) > max_dist:
                continue
            dist = levenshtein(key, dict_key)
            if dist < best_dist:
                best_dist = dist
                best_key = dict_key
                ties = 0
            elif dist == best_dist and dict_key != best_key:
                ties += 1

        # Only accept unambiguous fuzzy matches (no ties)
        if best_key and best_dist <= max_dist and ties == 0:
            entry = self.lookup[best_key]
            self.stats['fuzzy'] += 1
            return MatchResult(entry['id'], entry['canonical_name'],
                               'fuzzy', raw, normalized, best_dist)

        # No match
        self.stats['new'] += 1
        return MatchResult(None, None, 'new', raw, normalized)
