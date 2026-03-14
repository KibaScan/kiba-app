"""
M3 Import Pipeline — Ingredient Matching Logic

Reusable matcher for exact + fuzzy ingredient matching against ingredients_dict.
Used by parse_ingredients.py (batch pipeline) and later by OCR Edge Function flow.

v2 changes (2026-03-13):
  - FD&C color normalization: "FD&C Yellow #6 Lake" → "yellow_6"
  - "Lake" suffix stripping for all colorants
  - "#" normalization before underscore conversion
  - "And" conjunction handling: "BHA And Citric Acid" (from preservative parens)
  - Mineral form collapsing: "zinc sulfate" → "zinc" (broader chelate patterns)
  - "Added" prefix stripping: "Added Color" → "Color"
  - Amino acid prefix handling: "L-Tryptophan" → "tryptophan"
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
    # v2: additional prefixes
    'added',         # "Added Color" → "Color"
    # NOTE: 'artificial' deliberately EXCLUDED (v2.3 Fix 2A)
    # Stripping it converts "Artificial Beef Flavor" → "Beef Flavor" → allergen_group='beef'
    # But artificial flavors don't contain allergenic proteins. Must stay as own entry.
    'concentrated',  # "Concentrated Soy Protein" → "Soy Protein"
    'purified',      # "Purified Water" → "Water"
    # v2.4: additional processing adjectives
    'enriched',      # "Enriched Wheat Flour" → "Wheat Flour"
    'flaked',        # "Flaked Tuna" → "Tuna"
    'chopped',       # "Chopped Cattle Hide" → "Cattle Hide"
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


# ─── v2: FD&C Color Normalization ─────────────────────────────

# Direct mapping for FD&C dyes — these MUST resolve deterministically
# because they carry severity ratings (caution/danger).
# Covers all formatting variants seen in Chewy scrapes.
_COLOR_PATTERNS = [
    # FD&C colors with various separators, optional "No.", and "lake" suffix
    (r'fd\s*&\s*c\s+red\s*(?:no\.?\s*)?#?\s*40', 'red_40'),
    (r'fd\s*&\s*c\s+red\s*(?:no\.?\s*)?#?\s*3',  'red_3'),
    (r'fd\s*&\s*c\s+yellow\s*(?:no\.?\s*)?#?\s*5(?!\d)', 'yellow_5'),
    (r'fd\s*&\s*c\s+yellow\s*(?:no\.?\s*)?#?\s*6', 'yellow_6'),
    (r'fd\s*&\s*c\s+blue\s*(?:no\.?\s*)?#?\s*1(?!\d)', 'blue_1'),
    (r'fd\s*&\s*c\s+blue\s*(?:no\.?\s*)?#?\s*2', 'blue_2'),
    # Without FD&C prefix (with or without "No." / "No")
    (r'^red\s*(?:no\.?\s*)?#?\s*40(?:\s+lake)?$', 'red_40'),
    (r'^red\s*(?:no\.?\s*)?#?\s*3(?:\s+lake)?$',  'red_3'),
    (r'^yellow\s*(?:no\.?\s*)?#?\s*5(?:\s+lake)?(?!\d)$', 'yellow_5'),
    (r'^yellow\s*(?:no\.?\s*)?#?\s*6(?:\s+lake)?$', 'yellow_6'),
    (r'^blue\s*(?:no\.?\s*)?#?\s*1(?:\s+lake)?(?!\d)$',  'blue_1'),
    (r'^blue\s*(?:no\.?\s*)?#?\s*2(?:\s+lake)?$',  'blue_2'),
    # Common alternative names
    (r'^allura\s+red(?:\s+ac)?$', 'red_40'),
    (r'^tartrazine$', 'yellow_5'),
    (r'^brilliant\s+blue(?:\s+fcf)?$', 'blue_1'),
    (r'^erythrosine$', 'red_3'),
    (r'^sunset\s+yellow(?:\s+fcf)?$', 'yellow_6'),
    (r'^indigotine$', 'blue_2'),
    (r'^indigo\s+carmine$', 'blue_2'),
]

_COMPILED_COLORS = [(re.compile(pat, re.IGNORECASE), canon) for pat, canon in _COLOR_PATTERNS]


def _match_color(s: str) -> str | None:
    """Try to match a colorant pattern. Returns canonical name or None."""
    # Strip "lake" suffix for matching (it's just a dye carrier form)
    test = re.sub(r'\s+lake$', '', s, flags=re.IGNORECASE).strip()
    # Strip "fd&c" for an extra pass
    for compiled, canonical in _COMPILED_COLORS:
        if compiled.search(test):
            return canonical
    return None


# ─── v2: Amino Acid Prefix Handling ───────────────────────────

def _strip_amino_prefix(s: str) -> str:
    """Strip L-/D-/DL- prefix from amino acids.

    "L-Tryptophan" → "tryptophan"
    "DL-Methionine" → "methionine"
    "D-Alpha Tocopheryl Acetate" → "alpha tocopheryl acetate"
    """
    return re.sub(r'^[dl]{1,2}[\-]\s*', '', s, flags=re.IGNORECASE)


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

    # v2: Strip zero-width chars that survived into the token
    s = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', s)

    # Strip parenthetical/bracket content (preserved in display_name, not for matching)
    s = re.sub(r'\s*\(.*?\)', '', s).strip()
    s = re.sub(r'\s*\[.*?\]', '', s).strip()

    # v2.4: Strip "100%" marketing prefix ("100% Chicken Breast" → "Chicken Breast")
    s = re.sub(r'^100\s*%?\s+', '', s).strip()

    # v2.4: Strip "New:" product label prefix ("New: Chicken" → "Chicken")
    s = re.sub(r'^new:\s*', '', s, flags=re.IGNORECASE).strip()

    # v2: FD&C color detection — must happen early, before prefix stripping
    # destroys the "fd&c" marker
    color_match = _match_color(s)
    if color_match:
        return color_match

    # Check synonym table first (before prefix stripping)
    if synonyms and s in synonyms:
        return synonyms[s]

    # v2: Strip "lake" suffix (dye carrier form, not a different ingredient)
    s = re.sub(r'\s+lake$', '', s).strip()

    # v2: Strip "FD&C" prefix if it survived past color matching
    s = re.sub(r'^fd\s*&?\s*c\s+', '', s).strip()

    # v2: Normalize "#" in remaining cases
    s = s.replace('#', '')

    # v2.3 Fix 3C: While-loop prefix stripping until stable
    # Handles double-prefixed like "Added Natural Flavor" → "Natural Flavor" → "Flavor"
    # Also runs amino acid prefix inside the loop
    prev = None
    while s != prev:
        prev = s

        # Check synonym table after each strip
        if synonyms and s in synonyms:
            return synonyms[s]

        # Strip known prefixes
        for prefix in STRIP_PREFIXES:
            pat = re.compile(r'^' + re.escape(prefix) + r'\s+', re.IGNORECASE)
            s = pat.sub('', s).strip()

        # Strip amino acid prefix (L-/D-/DL-)
        s = _strip_amino_prefix(s)

    # Final synonym check after all stripping
    if synonyms and s in synonyms:
        return synonyms[s]

    # Strip "supplement" suffix
    s = re.sub(r'\s+supplement$', '', s)
    if synonyms and s in synonyms:
        return synonyms[s]

    # v2: Strip "extract" → check synonyms
    s_no_extract = re.sub(r'\s+extract$', '', s)
    if s_no_extract != s:
        if synonyms and s_no_extract in synonyms:
            return synonyms[s_no_extract]

    # Chelate/proteinate collapsing
    chelate_match = re.match(
        r'^(zinc|iron|copper|manganese|cobalt)\s+'
        r'(?:amino acid |protein |polysaccharide )?'
        r'(?:chelate|complex|proteinate)',
        s
    )
    if chelate_match:
        return chelate_match.group(1) + '_chelated'

    # v2.3 Fix 4B: Removed dead mineral sulfate/oxide collapsing code.
    # Mineral form normalization (zinc_sulfate → zinc) is handled by
    # the synonym table per-mineral, since some forms (iron_sulfate)
    # ARE the canonical name in the master list.

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
        # v2.3 Fix 3A: Length-scaled thresholds to prevent short-word collisions
        # Old: max_dist = 3 if len > 15 else 2
        # Risk: levenshtein("beef", "bean") = 2, levenshtein("pork", "corn") = 2
        key_len = len(key)
        if key_len <= 5:
            max_dist = 0  # No fuzzy for very short names — exact only
        elif key_len <= 10:
            max_dist = 1
        elif key_len <= 15:
            max_dist = 2
        else:
            max_dist = 3
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
