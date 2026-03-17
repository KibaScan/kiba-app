#!/usr/bin/env python3
"""
M3 Session 1: Parse ingredients_raw into product_ingredients junction table.

6-stage pipeline per INGREDIENT_PARSING_PIPELINE.md:
  Stage 1: Clean raw text (strip trailing codes, detect contamination/truncation)
  Stage 2: Tokenize with bracket-depth parser (parenthetical content stays together)
  Stage 3: Normalize for matching (lowercase, strip prefixes, apply synonyms)
  Stage 4: Match against ingredients_dict (exact -> fuzzy -> new)
  Stage 5: Insert new unknown ingredients into ingredients_dict
  Stage 6: Insert product_ingredients junction rows

Does NOT parse supplements (D-096 — stored but not scored).

v2 changes (2026-03-13):
  - Recipe boundary splitting for variety packs (pre-tokenization)
  - Leading conjunction stripping ("and Biotin" → "Biotin")
  - Token length/content validation (rejects CSS, marketing, >80 chars)
  - Expanded contamination markers (descriptions, reviews, CSS, zero-width chars)
  - "Inactive Ingredients:" prefix stripping
  - Preservative metadata extraction from parentheticals
  - Zero-width character cleanup
  - Per-recipe storage for variety packs (recipe_name on junction rows)

Usage:
    python3 scripts/import/parse_ingredients.py [--dry-run] [--limit N]
"""

import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_client, BATCH_SIZE
from ingredient_matcher import IngredientMatcher, load_synonyms, normalize_ingredient, normalize_colorant_canonical

REPORTS_DIR = Path(__file__).resolve().parent
JUNCTION_BATCH_SIZE = 500

# ─── Stage 1: Clean Raw Text ──────────────────────────────────

CONTAMINATION_MARKERS = [
    # HTML/JSON contamination from scraping
    'verdana', 'arial', 'roboto', 'schema.org',
    '<script', '</div', 'pricecurrency', 'font-family',
    '"url', '"description',
    # CSS contamination (v6 scraper page dumps)
    '.flyout__', '.kib-', 'display:block', 'margin-left:',
    'kib-media-icon', 'kib-truncation',
    # Product descriptions scraped instead of ingredients (v2)
    'about this item', 'about this product',
    'can help', 'won\'t make', 'support normal', 'improve vitality',
    # Review text grabbed instead of ingredients (v2)
    ' rated ', 'out of 5 stars', 'received free product',
    # JSON bleed (v2)
    '"offers"', '"pricecurrency"', '"@type"',
]

# Zero-width and invisible characters to strip (v2)
INVISIBLE_CHARS = re.compile(r'[\u200b\u200c\u200d\u200e\u200f\ufeff\u00ad]')


def clean_ingredients_raw(text: str) -> tuple[str, str]:
    """Clean raw ingredient text.

    Returns (cleaned_text, status).
    Status: 'clean', 'truncated', 'contaminated', 'empty'
    """
    if not text or not text.strip():
        return '', 'empty'

    text = text.strip()

    # v2: Strip zero-width characters early
    text = INVISIBLE_CHARS.sub('', text)

    # v2: Strip "Inactive Ingredients:" prefix
    # (scraper v5 sometimes grabbed only inactive section from supplements)
    text = re.sub(r'^Inactive Ingredients[:\s]*', '', text, flags=re.IGNORECASE)

    # v2.4: Strip "Ingredients:" prefix (variety packs sometimes repeat it)
    text = re.sub(r'^Ingredients[:\s]+', '', text, flags=re.IGNORECASE)

    # Check for HTML/JSON/CSS contamination
    text_lower = text.lower()
    if any(marker in text_lower for marker in CONTAMINATION_MARKERS):
        return text, 'contaminated'

    # v2: Length-based contamination — no real ingredient list is >10KB
    if len(text) > 10000:
        return text, 'contaminated'

    # v2: Sentence-heavy text is likely a product description, not ingredients
    # Real ingredient lists rarely have more than 1-2 sentence boundaries
    sentence_boundaries = len(re.findall(r'\.\s+[A-Z][a-z]', text))
    comma_count = text.count(',')
    if sentence_boundaries >= 5 and comma_count < sentence_boundaries:
        return text, 'contaminated'

    # Strip trailing product codes (e.g., M444922, A415423)
    text = re.sub(r'\.\s*[A-Z]?\d{4,}\s*$', '.', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # Normalize quotes
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')

    # Remove non-printable characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # v2: Normalize non-breaking spaces
    text = text.replace('\u00a0', ' ')

    # v2.1: Normalize accented characters (e.g., "Entrée" → "Entree", "pâté" → "pate")
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')

    # Strip leading/trailing periods
    text = text.strip('. ')

    # v2.1: Repair missing open parens
    # "Chicken Fat preserved with mixed tocopherols)" → "Chicken Fat (preserved with mixed tocopherols)"
    # "Salmon Oil a source of DHA)" → "Salmon Oil (a source of DHA)"
    text = re.sub(
        r'(\b\w+(?:\s+\w+)?)\s+(preserved with\s+[^,)]+)\)',
        r'\1 (\2)',
        text, flags=re.IGNORECASE
    )
    text = re.sub(
        r'(\b\w+(?:\s+\w+)?)\s+((?:a )?source of\s+[^,)]+)\)',
        r'\1 (\2)',
        text, flags=re.IGNORECASE
    )
    text = re.sub(
        r'(\b\w+(?:\s+\w+)?)\s+((?:a )?natural source of\s+[^,)]+)\)',
        r'\1 (\2)',
        text, flags=re.IGNORECASE
    )

    # Check for truncation: unbalanced brackets indicate cut-off mid-vitamin-pack
    open_count = text.count('(') + text.count('[')
    close_count = text.count(')') + text.count(']')
    if open_count > close_count:
        # Auto-close brackets so tokenizer doesn't fuse everything after the
        # unclosed paren into one giant token (depth never returns to 0)
        text += ')' * (open_count - close_count)
        return text, 'truncated'

    return text, 'clean'


# ─── Stage 2: Tokenize ────────────────────────────────────────

def split_recipes(text: str) -> list[tuple[str | None, str]]:
    """Split variety pack text on recipe boundaries (v2).

    Detects patterns like:
      "Chicken And Beef: Chicken, Broth, ... Carrageenan. Chicken And Turkey: Chicken, ..."
      "With Beef: Water, Chicken, ... Salt. With Chicken: Water, ..."
      "Filet Mignon Flavor: Beef, Pork By-Products, ..."

    Returns list of (recipe_name, ingredient_text) tuples.
    Single-recipe products return [(None, original_text)].
    """
    # Pattern: look for recipe boundary = period (or start), then a recipe header
    # ending with colon, followed by what looks like ingredients.
    #
    # Recipe headers are Title Case phrases like:
    #   "Chicken And Beef:", "With Beef:", "Filet Mignon Flavor:",
    #   "Chicken & Beef Recipe in Chicken Broth:",
    #   "Tuna Recipe x10 Tubes:"
    #
    # Key constraint: the word AFTER the colon should look like an ingredient
    # (starts with capital letter, is a food word) to avoid false positives
    # on things like "Vitamins: ..." which are vitamin packs, not recipes.

    # First, check if this even looks like a multi-recipe product
    # Must have at least 2 colon-delimited sections with food words after them
    # v2.2: \s* (not \s+) to handle "Kale.Chicken & Green Beans:" (no space after period)
    colon_splits = re.findall(
        r'(?:^|\.\s*)([A-Z][A-Za-z&\',\-\d ]{3,60})\s*:\s*([A-Z])',
        text
    )
    if len(colon_splits) < 2:
        return [(None, text)]

    # Verify headers look like recipe names (not vitamin/mineral packs or section labels)
    # v2.2: expanded guard list
    guard_words = {
        # Vitamin/mineral packs
        'vitamins', 'vitamin', 'minerals', 'mineral', 'trace',
        # Section labels
        'ingredients', 'ingredient',       # "Ingredients: Chicken, ..." label
        'essential', 'other',              # "Essential Nutrients And Other Ingredients:"
        'active', 'inactive',              # supplement section headers
        'directions', 'guaranteed',        # other section headers
        'calorie', 'feeding',
        # v2.2: Additional false-split guards
        'nutritional', 'supplements', 'supplement',  # "Nutritional Supplements: ..."
        'new',                             # "New: Rainbow Trout, ..." product label prefix
        'see',                             # "See individual items for ingredient information: ..."
        'contains',                        # "Contains 2% Or Less Of: ..." (human food style)
        'club',                            # "Club Cup One (...): ..." brand name prefix
    }
    recipe_headers = [
        h for h, _ in colon_splits
        if h.strip().split()[0].lower() not in guard_words
    ]
    if len(recipe_headers) < 2:
        return [(None, text)]

    # Split on recipe boundaries
    # Pattern: period + optional space + Recipe Header + colon
    # OR start of string + Recipe Header + colon
    boundary_pattern = re.compile(
        r'(?:^|\.\s*)'
        r'([A-Z][A-Za-z&\',\-\d ]{3,60}?)'
        r'\s*:\s*'
        r'(?=[A-Z])',
        re.MULTILINE
    )

    # Find all boundary positions
    boundaries = list(boundary_pattern.finditer(text))
    if len(boundaries) < 2:
        return [(None, text)]

    recipes = []
    for idx, match in enumerate(boundaries):
        recipe_name = match.group(1).strip()

        # Skip if this looks like a vitamin/mineral pack or section header
        first_word = recipe_name.split()[0].lower() if recipe_name.split() else ''
        if first_word in guard_words:
            continue

        # v2.1: Skip if recipe name is exactly "Ingredients" (with or without extra words)
        if re.match(r'^ingredients\b', recipe_name, re.IGNORECASE):
            continue

        # Get ingredient text: from end of this match to start of next boundary
        start = match.end()
        if idx + 1 < len(boundaries):
            # End at the period before the next recipe header
            end = boundaries[idx + 1].start()
            ingredient_text = text[start:end].strip().rstrip('.')
        else:
            # Last recipe — take everything to end
            ingredient_text = text[start:].strip().rstrip('.')

        if ingredient_text:
            recipes.append((recipe_name, ingredient_text))

    # If splitting produced valid recipes, return them
    if len(recipes) >= 2:
        return recipes

    # Fallback: single recipe
    return [(None, text)]


def detect_space_delimited(text: str) -> str:
    """Detect and fix space-delimited ingredient lists (v2).

    Some products use double-spaces instead of commas:
    "Lamb Meal  Oatmeal  Brown Rice  Chicken Fat"
    → "Lamb Meal, Oatmeal, Brown Rice, Chicken Fat"
    """
    comma_count = text.count(',')
    double_space_count = len(re.findall(r'  +', text))

    if comma_count < 3 and double_space_count >= 5:
        # Replace double+ spaces with commas, respecting parenthetical depth
        result = ''
        depth = 0
        i = 0
        while i < len(text):
            c = text[i]
            if c in '([':
                depth += 1
                result += c
            elif c in ')]':
                depth = max(0, depth - 1)
                result += c
            elif c == ' ' and depth == 0:
                # Check if this is a double-space run
                spaces = 0
                while i + spaces < len(text) and text[i + spaces] == ' ':
                    spaces += 1
                if spaces >= 2:
                    result += ', '
                    i += spaces
                    continue
                else:
                    result += c
            else:
                result += c
            i += 1
        return result

    return text


def fix_bare_preserved_with(text: str) -> str:
    """Re-wrap bare 'preserved with' clauses into parentheses (v2.1).

    Many ingredient lists omit parentheses around preservative clauses:
      "Chicken Fat, preserved with Mixed Tocopherols, Salt"
    This creates a junk token "preserved with Mixed Tocopherols".

    Fix: re-attach to the preceding ingredient with parentheses:
      "Chicken Fat (preserved with Mixed Tocopherols), Salt"

    Also handles:
      ", Mixed Tocopherols (preservative)," — standalone preservative, leave as-is
      ", preserved with BHA and Citric Acid," — multi-preservative

    v2.2: Stops at periods (not just commas) to prevent eating into next recipe:
      "..., preserved with Mixed Tocopherols. Beef: ..." was producing
      "(preserved with Mixed Tocopherols. Beef: ...)" — catastrophic.
    """
    # Pattern 1: ", preserved with X," or ", preserved using X,"
    # v2.2: [^,.] stops at both commas AND periods
    text = re.sub(
        r',\s*(preserved (?:with|using)\s+[^,.]+?)(?=\s*[,.]|\s*$)',
        r' (\1)',
        text, flags=re.IGNORECASE
    )

    # Pattern 2: ", naturally preserved with X,"
    text = re.sub(
        r',\s*(naturally preserved (?:with|using)\s+[^,.]+?)(?=\s*[,.]|\s*$)',
        r' (\1)',
        text, flags=re.IGNORECASE
    )

    # v2.2 / Fix 12: "Mixed Tocopherols added to preserve freshness"
    # "..., Kale, Mixed Tocopherols added to preserve freshness, Niacin, ..."
    # → "..., Kale (Mixed Tocopherols added to preserve freshness), Niacin, ..."
    # Note: re-attaches to PRECEDING ingredient (Kale gets the paren), which is
    # technically wrong (it's a standalone preservative note). But it prevents
    # "mixed_tocopherols_added_to_preserve_freshness" junk entries.
    # Better approach: convert to just "Mixed Tocopherols" as own token.
    text = re.sub(
        r',\s*Mixed Tocopherols?\s+added\s+(?:to preserve freshness|as a preservative|for freshness)\s*(?=,|\.|\s*$)',
        r', Mixed Tocopherols',
        text, flags=re.IGNORECASE
    )

    # Same for: "naturally preserved with mixed tocopherols and citric acid"
    # when it appears at end of list with trailing period/code
    # "..., Preserved With Mixed Tocopherols. A287624."
    # The period-stop above handles this — the trailing code is stripped by
    # clean_ingredients_raw's product code regex.

    return text


def tokenize(text: str) -> list[str]:
    """Split ingredients on commas, respecting parenthetical groups.

    Uses bracket-depth tracking: only splits on commas at depth 0.
    "Animal Fat (Preserved With BHA & Citric Acid)" stays as one token.
    """
    tokens = []
    depth = 0
    current = ''

    for char in text:
        if char in '([':
            depth += 1
            current += char
        elif char in ')]':
            depth = max(0, depth - 1)
            current += char
        elif char == ',' and depth == 0:
            token = current.strip()
            if token:
                tokens.append(token)
            current = ''
        else:
            current += char

    # Last token
    token = current.strip()
    if token:
        tokens.append(token)

    return tokens


def expand_packs(tokens: list[str]) -> list[str]:
    """Expand vitamin/mineral packs into individual ingredients.

    "VITAMINS [Vitamin E Supplement, Niacin, ...]" becomes individual tokens.
    Handles both brackets [...] and parens (...), with or without colons.
    Also handles unclosed packs (truncated ingredient lists).
    """
    expanded = []

    for token in tokens:
        # Match pack headers: VITAMINS [...], Minerals (...), Trace Minerals: (...)
        pack_match = re.match(
            r'^(vitamins?|minerals?|trace minerals?)\s*[:.]?\s*[\(\[](.+)',
            token, re.IGNORECASE | re.DOTALL
        )
        if pack_match:
            contents = pack_match.group(2)
            # Strip trailing close bracket/paren if present
            contents = re.sub(r'[\)\]]\s*\.?\s*$', '', contents)
            sub_tokens = tokenize(contents)
            if sub_tokens:
                expanded.extend(sub_tokens)
            else:
                expanded.append(token)  # Fallback: keep original
        else:
            expanded.append(token)

    return expanded


def split_slash_tokens(tokens: list[str]) -> list[str]:
    """Split tokens containing '/' into separate ingredients (v2.4).

    "BHA/BHT" → ["BHA", "BHT"]
    "BHA/Citric Acid" → ["BHA", "Citric Acid"]

    Only splits when both sides are short (≤25 chars each) to avoid
    splitting URLs or long descriptive text. Tokens inside parentheses
    or with slashes in known patterns (e.g., "Omega-3/6") are left alone.
    """
    result = []
    for token in tokens:
        if '/' not in token:
            result.append(token)
            continue
        # Don't split if slash is inside parentheses
        depth = 0
        slash_at_depth_0 = False
        for c in token:
            if c in '([':
                depth += 1
            elif c in ')]':
                depth = max(0, depth - 1)
            elif c == '/' and depth == 0:
                slash_at_depth_0 = True
                break
        if not slash_at_depth_0:
            result.append(token)
            continue
        # Split on slash at depth 0
        parts = []
        current = ''
        depth = 0
        for c in token:
            if c in '([':
                depth += 1
                current += c
            elif c in ')]':
                depth = max(0, depth - 1)
                current += c
            elif c == '/' and depth == 0:
                parts.append(current.strip())
                current = ''
            else:
                current += c
        parts.append(current.strip())
        # Only accept split if all parts are short ingredient-like strings
        if all(0 < len(p) <= 25 for p in parts):
            result.extend(p for p in parts if p)
        else:
            result.append(token)
    return result


def extract_primary_name(token: str) -> str:
    """Extract primary ingredient name, stripping parenthetical metadata.

    "Animal Fat (Source Of Omega 6 Fatty Acids)" -> "Animal Fat"
    "Chicken Fat (Preserved With Mixed Tocopherols)" -> "Chicken Fat"
    "Dried Whey (from milk) Protein" -> "Dried Whey Protein"
    "Red 40" -> "Red 40"

    v2.2: Uses non-greedy match to preserve text after closing paren.
    Old regex was greedy to end-of-string, losing trailing words.
    """
    # Strip each parenthetical group individually (non-greedy)
    result = re.sub(r'\s*\([^)]*\)', '', token).strip()
    result = re.sub(r'\s*\[[^\]]*\]', '', result).strip()
    # Strip trailing period
    result = result.rstrip('.').strip()
    # Collapse multiple spaces left by removed parens
    result = re.sub(r'\s+', ' ', result)
    return result if result else token


def extract_preservative(token: str) -> str | None:
    """Extract preservative from parenthetical metadata (v2).

    "Chicken Fat (Preserved With Mixed Tocopherols)" -> "Mixed Tocopherols"
    "Animal Fat (BHA Used As A Preservative)" -> "BHA"
    "Sorbic Acid (A Preservative)" -> None (parent IS the preservative, flag only)
    Returns None if no preservative found.
    """
    # Pattern: "(Preserved With X)" or "(Preserved Using X)"
    m = re.search(
        r'\(\s*(?:preserved with|preserved using)\s+(.+?)\s*\)',
        token, re.IGNORECASE
    )
    if m:
        return m.group(1).strip()

    # Pattern: "(X Used As A Preservative)"
    m = re.search(
        r'\(\s*(.+?)\s+used as (?:a )?preservative\s*\)',
        token, re.IGNORECASE
    )
    if m:
        return m.group(1).strip()

    # v2.1: Pattern: "(Used As A Preservative)" — no X before "used as"
    # Parent ingredient IS the preservative (same as "(A Preservative)")
    if re.search(r'\(\s*used as (?:a )?preservative\s*\)', token, re.IGNORECASE):
        return '__self__'

    # v2.1: Pattern: "(A Preservative)" or "(Preservative)" — parent IS the preservative
    if re.search(r'\(\s*(?:a )?preservative\s*\)', token, re.IGNORECASE):
        return '__self__'

    return None


def extract_flavor_species(token: str) -> str | None:
    """Extract species name from flavor ingredient parens (v2.1).

    "Natural Flavor (Source Of Roasted Chicken Flavor)" → "chicken"
    "Natural Flavors (Chicken)" → "chicken"
    "Animal Digest (Source Of Chicken Flavor)" → "chicken"

    Returns lowercase species name or None.
    Used to build allergen-aware canonical names (natural_chicken_flavor)
    instead of generic natural_flavor that loses allergen info.
    """
    # Known protein species for allergen matching
    species_pattern = r'(chicken|beef|pork|lamb|turkey|duck|salmon|fish|tuna|crab|shrimp|venison|bison|rabbit|quail|herring|whitefish|cod|mackerel|sardine|anchovy|deer|elk|goat|pheasant)'

    # Pattern 1: "Natural Flavor (Source Of X Flavor)"
    m = re.search(
        r'\(\s*(?:source of|a source of)?\s*(?:roasted\s+|grilled\s+)?'
        + species_pattern +
        r'\s+flavou?r\s*\)',
        token, re.IGNORECASE
    )
    if m:
        return m.group(1).lower()

    # Pattern 2: "Natural Flavor (Chicken)" or "Natural Flavors (Beef, Chicken)"
    m = re.search(
        r'(?:natural\s+)?flavou?rs?\s*\(\s*' + species_pattern + r'\s*\)',
        token, re.IGNORECASE
    )
    if m:
        return m.group(1).lower()

    return None


def validate_token(primary: str) -> bool:
    """Check if a token looks like a real ingredient (v2.4).

    Rejects CSS artifacts, marketing text, overly long strings, etc.
    Returns True if the token should be processed, False to skip.
    """
    # Too long — real ingredient names cap around 55 chars
    # (longest legit: "Dried Lactobacillus Acidophilus Fermentation Product" = 53)
    if len(primary) > 55:
        return False

    # Too short — single char or empty
    if len(primary) < 2:
        return False

    # CSS/HTML artifacts
    if re.search(r'[{}]|\.flyout|\.kib-|display:|margin:|font-|padding:', primary):
        return False

    # URL fragments
    if re.search(r'https?://|www\.|\.com|\.org', primary, re.IGNORECASE):
        return False

    # v2.4: Too many words — real ingredients rarely exceed 5 words
    # (longest legit: "Dried Bacillus Coagulans Fermentation Product" = 5 words)
    word_count = len(primary.split())
    if word_count > 5:
        return False

    # Review/marketing fragments
    if re.search(
        r'\b(rated|stars|review|perfect for|great for|your dog|your cat|your pet)\b',
        primary, re.IGNORECASE
    ):
        return False

    # v2.4: Marketing/promotional keywords
    if re.search(
        r'\b(pawsome|furbaby|whisker.?licking|pawfect|kitties|kittys|'
        r'wellbeing|well-being|locking in|made with real|'
        r'easy to digest|freeze.?drying|overall health|'
        r'bad stuff|good for them|variety pack|lickable|squeeze up|'
        r'see individual|most accurate|complete ingredients|'
        r'single.?protein treat|lipsmacking|purrworthy|'
        r'pour in a bowl|tasty topper|'
        r'artificial preservatives|no artificial|'
        r'store in a cool|refer to|please refer|'
        r'the real deal|just \d+ calorie|'
        r'naturally occurring|rich in protein|'
        r'texture and freshness|contains a)\b',
        primary, re.IGNORECASE
    ):
        return False

    # v2.4: Product size/weight patterns (not ingredients)
    if re.match(r'^\d*\.?\d+[\s-]*(?:oz|lb|g|kg|can|bag|cup|tube|pouch)\b', primary, re.IGNORECASE):
        return False

    # v2.4: Product/SKU codes (e.g., "E-4101", "D407620", "I605423-S")
    if re.match(r'^[A-Z][\-]?\d{4,}', primary):
        return False

    # v2.4: Standalone marketing fragments from period-splitting
    # These are single words or short phrases that are never ingredient names
    primary_lower = primary.lower().strip()
    if primary_lower in (
        'plus', 'pure', 'additionally', 'new', 'original',
        'just tear', 'rich in protein', 'with real',
    ):
        return False

    # v2.4: "Ingredients:" prefix that survived clean_ingredients_raw
    # (happens in variety pack sub-recipes)
    if re.match(r'^Ingredients\b', primary, re.IGNORECASE):
        return False

    # v2.4: Fused text from bad recipe boundaries (e.g., "SupplementChicken Broth")
    # Real ingredients don't have camelCase junctions in the middle
    if re.search(r'[a-z][A-Z]', primary) and len(primary) > 20:
        return False

    # v2.4: Product/brand names that leaked through scraping
    if re.search(
        r'\b(Pure Bites|Club Cup|Can One|Round Cup|'
        r'Accept No Imitations|Original Chicken|Original Beef)\b',
        primary, re.IGNORECASE
    ):
        return False

    # Numeric-only or code-like
    if re.match(r'^[\d\s.]+$', primary):
        return False

    # Contains sentence structure (Subject + verb pattern = not an ingredient)
    # "These treats help boost" — but allow "DL-Methionine" and similar
    if re.search(r'\b(is|are|was|were|has|have|does|will|can|should|these|this|those)\b',
                 primary, re.IGNORECASE) and len(primary) > 15:
        return False

    # v2.4: Contains possessives or contractions — marketing, not ingredients
    if re.search(r"(?:they'?re|it'?s|you'?re|we'?re|that'?s|don'?t|won'?t)\b",
                 primary, re.IGNORECASE):
        return False

    # v2.4: Function words that never appear in real ingredient names
    if re.search(r'\b(its|her|his|their|your|our|next|ready|makes|also|just|every|much)\b',
                 primary, re.IGNORECASE) and len(primary) > 15:
        return False

    # v2.1: Bare preservative clauses that survived pre-tokenization fix
    if re.match(r'^(?:preserved|naturally preserved)\s+(?:with|using)\b', primary, re.IGNORECASE):
        return False

    # v2.1: Standalone "Mixed Tocopherols" as a preservative note (not a real position)
    # Only reject if it starts with "mixed tocopherols" AND looks like metadata
    if re.match(r'^mixed tocopherols?\s*(?:\(|$)', primary, re.IGNORECASE):
        # This is fine as an ingredient — Mixed Tocopherols IS a real ingredient
        # Only reject the metadata form: "Mixed Tocopherols (preservative)"
        pass

    return True


def strip_leading_conjunction(primary: str) -> str:
    """Strip leading 'and', 'or', '&' from ingredient names (v2).

    "and Biotin" -> "Biotin"
    "and Folic Acid" -> "Folic Acid"
    "& Citric Acid" -> "Citric Acid"
    """
    return re.sub(r'^(?:and|or|&)\s+', '', primary, flags=re.IGNORECASE).strip()


# ─── Supabase Helpers ──────────────────────────────────────────

def fetch_products(client, limit=None):
    """Fetch daily_food and treat products with ingredients_raw."""
    all_products = []
    page_size = 1000
    offset = 0

    while True:
        result = (client.table('products')
                  .select('id,ingredients_raw,ingredients_hash,category')
                  .range(offset, offset + page_size - 1)
                  .execute())
        all_products.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    # Filter in Python (reliable across supabase-py versions)
    filtered = [
        p for p in all_products
        if p.get('ingredients_raw')
        and p['category'] in ('daily_food', 'treat')
    ]

    if limit:
        filtered = filtered[:limit]

    return filtered


def fetch_ingredients_dict(client):
    """Fetch all ingredients_dict entries."""
    all_entries = []
    page_size = 1000
    offset = 0

    while True:
        result = (client.table('ingredients_dict')
                  .select('id,canonical_name')
                  .range(offset, offset + page_size - 1)
                  .execute())
        all_entries.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    return all_entries


# ─── Main Pipeline ─────────────────────────────────────────────

def main():
    dry_run = '--dry-run' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1])

    print("=" * 60)
    print("M3 INGREDIENT PARSER v2")
    print("=" * 60)

    if dry_run:
        print("\n=== DRY RUN MODE ===\n")

    # ─── Phase 1: Fetch data ──────────────────────────────
    print("\nPhase 1: Fetching data from Supabase...")
    client = get_client()

    products = fetch_products(client, limit)
    print(f"  Products fetched: {len(products)} (daily_food + treat with ingredients)")

    dict_entries = fetch_ingredients_dict(client)
    print(f"  ingredients_dict entries: {len(dict_entries)}")

    synonyms = load_synonyms()
    print(f"  Synonyms loaded: {len(synonyms)}")

    matcher = IngredientMatcher(dict_entries, synonyms)

    # ─── Phase 2: Parse & match ────────────────────────────
    print("\nPhase 2: Parsing ingredients...")

    # Group by ingredients_hash for deduplication (size variants share formulas)
    hash_groups: dict[str, list[dict]] = defaultdict(list)
    no_hash: list[dict] = []
    for p in products:
        h = p.get('ingredients_hash')
        if h:
            hash_groups[h].append(p)
        else:
            no_hash.append(p)

    unique_formulas = list(hash_groups.values()) + [[p] for p in no_hash]
    print(f"  Unique formulas to parse: {len(unique_formulas)} "
          f"(from {len(products)} products)")

    # Results tracking
    parsed_formulas: list[tuple[list[dict], list[tuple]]] = []
    # Each entry: (product_group, [(position, canonical, ingredient_id, recipe_name)])
    new_ingredients: dict[str, dict] = {}  # normalized -> {display_name, count, ...}
    matched_counts: Counter = Counter()  # canonical_name -> count
    parsing_errors: list[dict] = []
    status_counts: Counter = Counter()

    # v2: Track variety pack stats
    variety_pack_count = 0
    total_recipes = 0
    tokens_rejected = 0
    conjunctions_stripped = 0
    preservatives_extracted = 0
    space_delimited_fixed = 0

    for i, formula_group in enumerate(unique_formulas):
        representative = formula_group[0]
        raw = representative['ingredients_raw']
        group_size = len(formula_group)

        # Stage 1: Clean
        cleaned, status = clean_ingredients_raw(raw)
        status_counts[status] += 1

        if status in ('contaminated', 'empty'):
            parsing_errors.append({
                'product_ids': [p['id'] for p in formula_group],
                'status': status,
                'raw_preview': raw[:200] if raw else None,
            })
            continue

        # v2: Detect and fix space-delimited ingredient lists
        original_cleaned = cleaned
        cleaned = detect_space_delimited(cleaned)
        if cleaned != original_cleaned:
            space_delimited_fixed += group_size

        # v2.1: Re-wrap bare "preserved with" clauses into parentheses
        cleaned = fix_bare_preserved_with(cleaned)

        # v2: Split variety pack recipes BEFORE tokenization
        recipes = split_recipes(cleaned)
        is_variety_pack = len(recipes) > 1
        if is_variety_pack:
            variety_pack_count += group_size
            total_recipes += len(recipes)

        # Process each recipe (or just the single recipe for non-variety-packs)
        ingredient_links = []

        for recipe_idx, (recipe_name, recipe_text) in enumerate(recipes):
            # v2.3 Fix 1B: Offset positions per recipe to avoid UNIQUE(product_id, position)
            # collisions. Recipe 0 = positions 1-99, Recipe 1 = 100-199, etc.
            # Single-recipe products (recipe_idx=0) are unaffected.
            position_offset = recipe_idx * 100

            # v2.4: Treat period+space+capital as comma separator
            # Handles ingredient lists using periods instead of commas:
            #   "Garlic Oil. E-4101" → "Garlic Oil, E-4101"
            #   "Calcium Carbonate. Chicken Fat" → "Calcium Carbonate, Chicken Fat"
            # Also handles bracket+period: "Biotin]. D407620" → "Biotin], D407620"
            # Excludes decimal numbers (3.5%)
            recipe_text = re.sub(r'(?<!\d)[\.\]]+\s+(?=[A-Z])', ', ', recipe_text)

            # Stage 2: Tokenize
            tokens = tokenize(recipe_text)
            tokens = expand_packs(tokens)
            tokens = split_slash_tokens(tokens)

            if not tokens:
                if not is_variety_pack:
                    parsing_errors.append({
                        'product_ids': [p['id'] for p in formula_group],
                        'status': 'no_tokens',
                        'raw_preview': raw[:200],
                    })
                continue

            # Stages 3-4: Normalize & match each token
            for local_pos, token in enumerate(tokens, 1):
                position = local_pos + position_offset

                # v2.1: Extract flavor species BEFORE stripping parens
                flavor_species = extract_flavor_species(token)

                primary = extract_primary_name(token)

                # v2.3 Fix 2B: Broaden flavor species injection beyond "Natural Flavor"
                # Also handles "Animal Digest (Source Of Chicken Flavor)",
                # "Artificial Flavor (Chicken)", generic "Flavor (Beef)"
                if flavor_species:
                    flavor_bases = [
                        r'natural\s+flavou?rs?$',
                        r'animal\s+digest$',
                        r'digest$',
                        r'artificial\s+flavou?rs?$',
                        r'flavou?rs?$',
                    ]
                    if any(re.match(p, primary, re.IGNORECASE) for p in flavor_bases):
                        if re.match(r'artificial', primary, re.IGNORECASE):
                            primary = f"Artificial {flavor_species.title()} Flavor"
                        elif re.match(r'animal\s+digest', primary, re.IGNORECASE):
                            primary = f"Animal Digest ({flavor_species.title()})"
                        else:
                            primary = f"Natural {flavor_species.title()} Flavor"

                # v2: Strip leading conjunctions
                stripped = strip_leading_conjunction(primary)
                if stripped != primary:
                    conjunctions_stripped += 1
                    primary = stripped

                # v2: Extract preservative metadata before discarding parens
                preservative = extract_preservative(token)
                if preservative and preservative != '__self__':
                    preservatives_extracted += 1

                # v2: Validate token — skip junk
                if not validate_token(primary):
                    tokens_rejected += 1
                    continue

                result = matcher.match(primary)

                if result.ingredient_id:
                    canon = normalize_colorant_canonical(result.canonical_name)
                    matched_counts[canon] += group_size
                    ingredient_links.append((
                        position, canon,
                        result.ingredient_id, recipe_name
                    ))
                elif result.normalized:
                    normalized = normalize_colorant_canonical(result.normalized)
                    if normalized not in new_ingredients:
                        new_ingredients[normalized] = {
                            'display_name': primary,
                            'count': 0,
                            'example_products': [],
                            'example_positions': [],
                        }
                    new_ingredients[normalized]['count'] += group_size
                    if len(new_ingredients[normalized]['example_products']) < 3:
                        new_ingredients[normalized]['example_products'].append(
                            representative['id']
                        )
                        new_ingredients[normalized]['example_positions'].append(
                            position
                        )
                    ingredient_links.append((
                        position, normalized, None, recipe_name
                    ))

                # v2: Also insert the preservative as a synthetic ingredient
                # Skip __self__ sentinel — parent ingredient IS the preservative
                if preservative and preservative != '__self__':
                    # v2.3 Fix 3B: Split multi-preservatives ("BHA And Citric Acid")
                    # v2.4: Also split on "/" ("BHA/BHT" → ["BHA", "BHT"])
                    pres_parts = re.split(r'\s+(?:and|&)\s+|/', preservative, flags=re.IGNORECASE)
                    for pres_idx, pres_part in enumerate(pres_parts):
                        pres_primary = strip_leading_conjunction(pres_part.strip())
                        if not pres_primary or not validate_token(pres_primary):
                            continue
                        pres_result = matcher.match(pres_primary)
                        synth_pos = 900 + position_offset + local_pos + pres_idx
                        if pres_result.ingredient_id:
                            pres_canon = normalize_colorant_canonical(pres_result.canonical_name)
                            matched_counts[pres_canon] += group_size
                            ingredient_links.append((
                                synth_pos, pres_canon,
                                pres_result.ingredient_id, recipe_name
                            ))
                        elif pres_result.normalized:
                            norm_pres = normalize_colorant_canonical(pres_result.normalized)
                            if norm_pres not in new_ingredients:
                                new_ingredients[norm_pres] = {
                                    'display_name': pres_primary,
                                    'count': 0,
                                    'example_products': [],
                                    'example_positions': [],
                                }
                            new_ingredients[norm_pres]['count'] += group_size
                            ingredient_links.append((
                                synth_pos, norm_pres, None, recipe_name
                            ))

        if ingredient_links:
            parsed_formulas.append((formula_group, ingredient_links))
        elif not is_variety_pack:
            # Only log error for non-variety-packs with zero links
            # (variety packs may have all tokens rejected for one recipe)
            parsing_errors.append({
                'product_ids': [p['id'] for p in formula_group],
                'status': 'no_valid_tokens',
                'raw_preview': raw[:200],
            })

        # Progress
        if (i + 1) % 1000 == 0 or (i + 1) == len(unique_formulas):
            print(f"  Parsed {i + 1}/{len(unique_formulas)} formulas...")

    # Compute stats
    total_positions = sum(
        len(links) * len(group)
        for group, links in parsed_formulas
    )
    matched_positions = sum(
        sum(1 for _, _, iid, _ in links if iid) * len(group)
        for group, links in parsed_formulas
    )
    match_rate = matched_positions / total_positions * 100 if total_positions else 0

    print(f"\n  Parsing results:")
    print(f"    Total ingredient-position rows: {total_positions}")
    print(f"    Matched to existing dict:       {matched_positions} ({match_rate:.1f}%)")
    print(f"    New ingredients found:          {len(new_ingredients)}")
    print(f"    Match tiers: {dict(matcher.stats)}")
    print(f"    Ingredient status: {dict(status_counts)}")
    print(f"    --- v2 stats ---")
    print(f"    Variety packs split:            {variety_pack_count} products ({total_recipes} recipes)")
    print(f"    Tokens rejected (validation):   {tokens_rejected}")
    print(f"    Conjunctions stripped:          {conjunctions_stripped}")
    print(f"    Preservatives extracted:        {preservatives_extracted}")
    print(f"    Space-delimited fixed:          {space_delimited_fixed}")

    # ─── Phase 3: Expand dictionary (Stage 5) ─────────────
    print(f"\nPhase 3: Inserting {len(new_ingredients)} new ingredients "
          f"into ingredients_dict...")

    new_ingredient_ids: dict[str, str] = {}  # normalized -> DB id
    dict_insert_errors: list[dict] = []

    # Sort by frequency (high-frequency first for review priority)
    sorted_new = sorted(new_ingredients.items(), key=lambda x: -x[1]['count'])

    if not dry_run and sorted_new:
        for batch_start in range(0, len(sorted_new), BATCH_SIZE):
            batch = sorted_new[batch_start:batch_start + BATCH_SIZE]
            rows = []
            for canonical, info in batch:
                rows.append({
                    'canonical_name': normalize_colorant_canonical(canonical),
                    'display_name': info['display_name'],
                    # Schema CHECK: ('danger','caution','neutral','good')
                    # 'unknown' not allowed — neutral is safe default
                    'dog_base_severity': 'neutral',
                    'cat_base_severity': 'neutral',
                })

            try:
                result = client.table('ingredients_dict').insert(rows).execute()
                for entry in result.data:
                    new_ingredient_ids[entry['canonical_name']] = entry['id']
                    matcher.add_entry(entry)
            except Exception:
                # One-by-one fallback
                for row in rows:
                    try:
                        result = client.table('ingredients_dict').insert(row).execute()
                        entry = result.data[0]
                        new_ingredient_ids[entry['canonical_name']] = entry['id']
                        matcher.add_entry(entry)
                    except Exception as e2:
                        err_str = str(e2).lower()
                        if 'duplicate' in err_str or 'unique' in err_str:
                            # Already exists (re-run), fetch existing
                            try:
                                existing = (client.table('ingredients_dict')
                                            .select('id,canonical_name')
                                            .eq('canonical_name', row['canonical_name'])
                                            .execute())
                                if existing.data:
                                    entry = existing.data[0]
                                    new_ingredient_ids[entry['canonical_name']] = entry['id']
                            except Exception:
                                pass
                        else:
                            dict_insert_errors.append({
                                'canonical_name': row['canonical_name'],
                                'error': str(e2)[:300],
                            })

            done = min(batch_start + BATCH_SIZE, len(sorted_new))
            if done % 500 < BATCH_SIZE or done >= len(sorted_new):
                print(f"  {len(new_ingredient_ids)}/{len(sorted_new)} "
                      f"new ingredients inserted")

        if dict_insert_errors:
            print(f"  Insert errors: {len(dict_insert_errors)}")
    elif dry_run:
        for canonical, _ in sorted_new:
            new_ingredient_ids[canonical] = f"dry-run-{canonical}"

    # ─── Phase 4: Load product_ingredients (Stage 6) ──────
    print(f"\nPhase 4: Building product_ingredients rows...")

    # Build all junction rows, resolving new ingredient IDs
    insert_rows: list[dict] = []
    unresolved = 0

    for formula_group, ingredient_links in parsed_formulas:
        for product in formula_group:
            for position, canonical, ingredient_id, recipe_name in ingredient_links:
                # Resolve ID: use existing or newly inserted
                iid = ingredient_id or new_ingredient_ids.get(canonical)
                if iid:
                    row = {
                        'product_id': product['id'],
                        'ingredient_id': iid,
                        'position': position,
                    }
                    # v2: include recipe_name for variety packs
                    # (only if schema supports it — otherwise omit)
                    # NOTE: Add 'recipe_name TEXT' column to product_ingredients
                    # if you want to store this. For now, we skip to avoid
                    # schema errors on existing databases.
                    # if recipe_name:
                    #     row['recipe_name'] = recipe_name
                    insert_rows.append(row)
                else:
                    unresolved += 1

    print(f"  Total rows to insert: {len(insert_rows)}")
    if unresolved:
        print(f"  Skipped (unresolved ingredient_id): {unresolved}")

    pi_inserted = 0
    pi_errors: list[dict] = []
    pi_skipped_dupes = 0

    if not dry_run and insert_rows:
        for batch_start in range(0, len(insert_rows), JUNCTION_BATCH_SIZE):
            batch = insert_rows[batch_start:batch_start + JUNCTION_BATCH_SIZE]
            try:
                result = client.table('product_ingredients').insert(batch).execute()
                pi_inserted += len(result.data)
            except Exception:
                # One-by-one fallback
                for row in batch:
                    try:
                        result = (client.table('product_ingredients')
                                  .insert(row).execute())
                        pi_inserted += 1
                    except Exception as e2:
                        err_str = str(e2).lower()
                        if 'duplicate' in err_str or 'unique' in err_str:
                            pi_skipped_dupes += 1
                        else:
                            pi_errors.append({
                                'product_id': row['product_id'],
                                'position': row['position'],
                                'error': str(e2)[:300],
                            })

            done = min(batch_start + JUNCTION_BATCH_SIZE, len(insert_rows))
            if done % 10000 < JUNCTION_BATCH_SIZE or done >= len(insert_rows):
                print(f"  {pi_inserted}/{len(insert_rows)} rows inserted"
                      + (f" ({pi_skipped_dupes} dupes skipped)"
                         if pi_skipped_dupes else ""))
    else:
        pi_inserted = len(insert_rows)

    # ─── Phase 5: Reports ─────────────────────────────────
    print("\nPhase 5: Writing reports...")

    # matched_ingredients.json: {canonical_name: count} sorted by frequency
    matched_sorted = sorted(matched_counts.items(), key=lambda x: -x[1])
    with open(REPORTS_DIR / 'matched_ingredients.json', 'w') as f:
        json.dump(dict(matched_sorted), f, indent=2)
    print(f"  matched_ingredients.json: {len(matched_sorted)} unique ingredients")

    # new_ingredients.json: new ingredients with context for review
    new_report = [
        {'canonical_name': k, **v}
        for k, v in sorted_new
    ]
    with open(REPORTS_DIR / 'new_ingredients.json', 'w') as f:
        json.dump(new_report, f, indent=2, default=str)
    print(f"  new_ingredients.json: {len(new_report)} new ingredients for review")

    # parsing_errors.json: comprehensive error log
    with open(REPORTS_DIR / 'parsing_errors.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'parsing_errors': parsing_errors,
            'dict_insert_errors': dict_insert_errors,
            'junction_insert_errors': pi_errors[:200],
            'summary': {
                'products_processed': len(products),
                'unique_formulas': len(unique_formulas),
                'total_positions': total_positions,
                'matched_positions': matched_positions,
                'match_rate_pct': round(match_rate, 1),
                'new_ingredients_found': len(new_ingredients),
                'new_ingredients_inserted': len(new_ingredient_ids),
                'pi_rows_inserted': pi_inserted,
                'pi_dupes_skipped': pi_skipped_dupes,
                'pi_errors': len(pi_errors),
                'status_breakdown': dict(status_counts),
                'match_tiers': dict(matcher.stats),
                'v2_stats': {
                    'variety_packs_split': variety_pack_count,
                    'total_recipes': total_recipes,
                    'tokens_rejected': tokens_rejected,
                    'conjunctions_stripped': conjunctions_stripped,
                    'preservatives_extracted': preservatives_extracted,
                    'space_delimited_fixed': space_delimited_fixed,
                },
            }
        }, f, indent=2, default=str)
    print(f"  parsing_errors.json written")

    # ─── Summary ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("PARSING SUMMARY")
    print("=" * 60)
    print(f"Products processed:         {len(products)}")
    print(f"Unique formulas parsed:     {len(unique_formulas)}")
    print(f"Ingredient status:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status:20s}      {count}")
    print(f"Total ingredient positions: {total_positions}")
    print(f"Match rate:                 {match_rate:.1f}%")
    print(f"  Exact matches:            {matcher.stats.get('exact', 0)}")
    print(f"  Fuzzy matches:            {matcher.stats.get('fuzzy', 0)}")
    print(f"  New ingredients:          {matcher.stats.get('new', 0)}")
    print(f"New dict entries inserted:  {len(new_ingredient_ids)}")
    print(f"product_ingredients rows:   {pi_inserted}")
    if pi_skipped_dupes:
        print(f"  Dupes skipped (re-run):   {pi_skipped_dupes}")
    if pi_errors:
        print(f"  Insert errors:            {len(pi_errors)}")
    print(f"\nv2 improvements:")
    print(f"  Variety packs:            {variety_pack_count} products → {total_recipes} recipes")
    print(f"  Tokens rejected:          {tokens_rejected}")
    print(f"  Conjunctions stripped:    {conjunctions_stripped}")
    print(f"  Preservatives extracted:  {preservatives_extracted}")
    print(f"  Space-delimited fixed:    {space_delimited_fixed}")

    if sorted_new:
        print(f"\nTop 15 new ingredients by frequency:")
        for canonical, info in sorted_new[:15]:
            print(f"  {canonical:45s} {info['count']:5d} occurrences")

    # Warn if match rate below quality gate
    if match_rate < 95 and total_positions > 0:
        print(f"\n  WARNING: Match rate {match_rate:.1f}% is below 95% quality gate.")
        print(f"  Review new_ingredients.json and expand synonyms.json, then re-run.")

    if dry_run:
        print("\n=== DRY RUN COMPLETE (no data written to Supabase) ===")


if __name__ == '__main__':
    main()
