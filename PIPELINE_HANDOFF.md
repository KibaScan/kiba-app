# Kiba Data Pipeline — Complete Handoff

**Date:** 2026-03-14
**Context:** Scraper v6 + Parser v2.3 + Matcher v2.3 — full rewrite session
**Status:** Scrape COMPLETE. 9,089 products merged and validated. Ready for Phase 3 (database cleanup) onward.

---

## 1. The Problem We Solved

Kiba's ingredient database was built on bad data. The original scraper (v5) produced corrupt `ingredients_raw` for ~47% of 9,083 products. The parser then faithfully turned that garbage into ~2,400 junk entries in `ingredients_dict` and thousands of wrong `product_ingredients` rows. Scores were contaminated.

### Scraper Failures (v5 → v6 fixes)

| Issue | Count | % | Root cause | v6 fix |
|---|---|---|---|---|
| Null ingredients | 1,618 | 17.8% | CSS selector missed accordion | Strategy A: `#INGREDIENTS-section p` |
| Grabbed description | 878 | 9.7% | "About This Item" scored higher | Section ID runs first, skips heuristic |
| Grabbed reviews | 110 | 1.2% | Review text had food keywords | Negative scoring signals added |
| Inactive only | 153 | 1.7% | Missed active ingredients table | Strategy A2: merge active+inactive |
| JSON/schema bleed | 43 | 0.5% | LD+JSON passed filters | Hard rejection in `isValidIngredientText` |
| Full page dump (148KB) | 54 | 0.6% | No size cap | `deepFindAllStrings` capped at 10KB |
| Short treats rejected | ~200 | 2.2% | `commas < 3` sanity check | Relaxed for `#INGREDIENTS-section` hits |
| Space-delimited lists | ~50 | 0.5% | Firstmate uses double-spaces | `detectAndFixSpaceDelimited()` |

### Parser Failures (v1 → v2.3 fixes)

| Issue | Count | Root cause | v2.3 fix |
|---|---|---|---|
| Variety pack ingredients fused | ~665 products | No recipe boundary splitting | `split_recipes()` pre-tokenization |
| Variety pack position collisions | ~665 products | Positions reset per recipe | Position offset: recipe N starts at N×100 |
| Truncated lists fuse tail ingredients | ~1,031 products | Unclosed brackets trap tokenizer at depth>0 | Auto-close brackets before tokenization |
| `and_biotin`, `and_folic_acid` | 30+ entries | Leading conjunction not stripped | `strip_leading_conjunction()` |
| CSS class names as ingredients | 12 entries | No token validation | `validate_token()` rejects |
| Marketing text as ingredients | 60+ entries | No length/content filter | `validate_token()` + expanded contamination markers |
| `fd&c_yellow_#6` vs `yellow_6` | ~20 entries | FD&C prefix not normalized | `_match_color()` deterministic patterns |
| `preserved_with_mixed_tocopherols` junk entry | 29/77 sample | Bare preservative clause tokenized | `fix_bare_preserved_with()` |
| Preserved-with eating past period | 5/104 sample | Regex didn't stop at `.` | Stop at periods AND commas |
| "Natural Flavor" losing allergen species | 12/77 sample | `extract_primary_name` strips parens | `extract_flavor_species()` runs first |
| Allergen species only for Natural Flavor | — | Other bases ignored | Broadened: Animal Digest, Artificial Flavor, generic Flavor |
| Missing open paren | 6/77 sample | Scrape artifact | Regex repair in `clean_ingredients_raw` |
| "Mixed Tocopherols added to preserve freshness" | 2/104 sample | Different phrasing, not caught | Stripped to just "Mixed Tocopherols" |
| "Artificial" prefix stripped → false allergen | — | `STRIP_PREFIXES` included "artificial" | Removed from prefix list; stays as own canonical |
| Multi-preservatives fused | — | "BHA And Citric Acid" as one entry | Split on `and`/`&`, insert each separately |
| Double-prefix not fully stripped | — | Single-pass prefix loop | While-loop until stable |
| Greedy paren strip losing trailing text | — | `\(.*$` greedy to end | Non-greedy `\([^)]*\)` per group |
| Fuzzy matching too loose for short words | — | beef↔bean at distance 2 | Length-scaled: ≤5=exact only, ≤10=dist 1, ≤15=dist 2, >15=dist 3 |
| Dead mineral collapsing code | — | `pass` statement did nothing | Removed; synonym table handles per-mineral |

### Dictionary Contamination (from v1 parser)

The v1 parser created 6,037 entries in `ingredients_dict`. After the M4 audit cleanup:
- 2,418 parsing artifacts removed (887 deleted, 1,235 remapped, 296 orphaned)
- 3,619 clean entries remain
- 107 artifacts still present (CSS classes, `and_*` prefixes, marketing fragments)
- These 107 will be eliminated on clean-slate reparse with v2.3

---

## 2. Scrape Results (v6 — COMPLETE)

Merged from 3 Apify runs into `dataset_kiba_v6_merged.json` (23.6 MB, 9,089 products).

| Metric | v5 | v6 | Delta |
|---|---|---|---|
| **Has ingredients** | **53.2%** | **98.6% (8,966)** | **+45.4%** |
| Null ingredients | 1,618 (17.8%) | 123 (1.4%) | −92.4% |
| Description grabs | 878 | **0** | Eliminated |
| Review grabs | 110 | **0** | Eliminated |
| CSS/JSON bleed | 97 | **0** | Eliminated |

### Strategy Distribution

| Strategy | Count | % |
|---|---|---|
| section-id | 7,907 | 87.0% |
| section-id (short) | 883 | 9.7% |
| long-comma-text | 129 | 1.4% |
| none (null ingredients) | 112 | 1.2% |
| failed (Scrape.do error) | 11 | 0.1% |
| heading-sibling | 8 | 0.1% |
| nextjs-scored (various) | 35 | 0.4% |
| heading-parent-sibling | 4 | 0.0% |

### Coverage

| Field | Count | % |
|---|---|---|
| Has ingredients | 8,966 | 98.6% |
| Has GA (protein+fat) | 6,208 | 68.3% |
| Has UPC (barcode) | 8,398 | 92.4% |
| Vet diets (high confidence) | 125 | — |
| Vet mentions (low confidence) | 144 | — |

### By Category

| Category | Total | Has Ingredients | % |
|---|---|---|---|
| daily_food | 3,498 | 3,471 | 99.2% |
| treat | 3,034 | 2,963 | 97.7% |
| supplement | 2,557 | 2,532 | 99.0% |

---

## 3. Architecture: Three Files, One Pipeline

```
ingredients_raw (text from scraper)
        │
        ▼
┌──────────────────────────────────────────────┐
│  parse_ingredients.py (v2.3, 1,122 lines)    │
│                                               │
│  Stage 1: clean_ingredients_raw()             │
│    - Strip zero-width chars, fix encoding     │
│    - Strip "Inactive Ingredients:" prefix     │
│    - Repair missing open parens               │
│    - Auto-close unclosed brackets (truncated) │
│    - Detect contamination, truncation         │
│    - Normalize accented chars (é → e)         │
│                                               │
│  Pre-tokenization:                            │
│    - fix_bare_preserved_with()                │
│      (stops at periods AND commas)            │
│      (strips "added to preserve freshness")   │
│    - detect_space_delimited()                 │
│    - split_recipes() (variety packs)          │
│      (28 guard words prevent false splits)    │
│                                               │
│  Stage 2: tokenize()                          │
│    - Bracket-depth comma splitting            │
│    - expand_packs() (vitamin/mineral packs)   │
│                                               │
│  Per-token processing:                        │
│    - extract_flavor_species()                 │
│    - extract_primary_name() (non-greedy)      │
│    - strip_leading_conjunction()              │
│    - extract_preservative()                   │
│      (splits multi-preservatives on and/&)    │
│    - validate_token()                         │
│                                               │
│  Position assignment:                         │
│    - Recipe N positions offset by N×100       │
│    - Synthetic preservatives at 900+offset    │
│                                               │
│  Stage 3-4: normalize → match                │
│    └── ingredient_matcher.py (v2.3, 324 lines)│
│        - FD&C color patterns (deterministic)  │
│        - While-loop prefix stripping          │
│        - Amino acid prefix strip              │
│        - Synonym table lookup                 │
│        - Exact → fuzzy (length-scaled) → new  │
│        - "artificial" preserved (not stripped) │
│                                               │
│  Stage 5: Insert new ingredients (neutral)    │
│  Stage 6: Insert product_ingredients rows     │
└──────────────────────────────────────────────┘
        │
        ▼
  product_ingredients table
  ingredients_dict table
```

### parse_ingredients.py — Parser v2.3 (1,122 lines)

The orchestrator. Fetches products from Supabase, runs the 6-stage pipeline, writes junction rows back. Key functions:

**Stage 1 — `clean_ingredients_raw(text)`**
Returns `(cleaned_text, status)` where status is `clean`, `truncated`, `contaminated`, or `empty`.
- Strips zero-width characters (`\u200b`, `\ufeff`)
- Strips "Inactive Ingredients:" prefix (from v5 supplement scraping)
- Normalizes accented characters (Entrée → Entree, pâté → pate)
- Repairs missing open parentheses: `"Chicken Fat preserved with mixed tocopherols)"` → `"Chicken Fat (preserved with mixed tocopherols)"`
- Detects contamination: HTML/CSS markers, "About This Item", reviews, JSON bleed, text >10KB, sentence-heavy text
- Detects truncation: unbalanced brackets from cut-off vitamin packs. **Auto-closes brackets** so the tokenizer doesn't fuse all tail-end ingredients into one chunk.

**Pre-tokenization — `fix_bare_preserved_with(text)`**
The #1 junk entry source (29 of 77 sampled products). Re-wraps bare preservative clauses:
`"Chicken Fat, preserved with Mixed Tocopherols, Salt"` → `"Chicken Fat (preserved with Mixed Tocopherols), Salt"`

Stops at periods (not just commas) to prevent eating into next recipe boundary:
`"..., preserved with Mixed Tocopherols. Beef: Beef, Salt"` — period stops the match.

Also strips "Mixed Tocopherols added to preserve freshness" → "Mixed Tocopherols" (standalone token).

**Pre-tokenization — `detect_space_delimited(text)`**
Some brands (Firstmate) use double-spaces instead of commas. If `commas < 3` and `double_spaces >= 5`, converts to comma-delimited while respecting parenthetical depth.

**Pre-tokenization — `split_recipes(text)`**
Variety packs contain multiple recipes in one `ingredients_raw`:
`"Chicken & Beef: Chicken, Broth, Salt. Turkey & Lamb: Turkey, Water, Salt"`
Splits into `[("Chicken & Beef", "Chicken, Broth, Salt"), ("Turkey & Lamb", "Turkey, Water, Salt")]`.

Guard words prevent false splits on section headers: `vitamins`, `vitamin`, `minerals`, `mineral`, `trace`, `ingredients`, `ingredient`, `essential`, `other`, `active`, `inactive`, `directions`, `guaranteed`, `calorie`, `feeding`, `nutritional`, `supplements`, `supplement`, `new`, `see`, `contains`, `club`.

Guard regex and boundary regex both support digits in recipe headers (`Formula 1:`, `Recipe x10:`).

**Stage 2 — `tokenize(text)`**
Bracket-depth comma splitting. Tracks `(` and `[` depth, only splits on commas at depth 0. This keeps `"Animal Fat (Source Of Omega 6 [Preserved With BHA])"` as one token.

**Stage 2 — `expand_packs(tokens)`**
Vitamin/mineral packs like `"VITAMINS [Vitamin E, Niacin, Folic Acid]"` are flattened into individual tokens.

**Per-token — `extract_flavor_species(token)`**
Runs BEFORE `extract_primary_name` strips parentheses. Extracts species from flavor parens so allergen info isn't lost:
`"Natural Flavor (Source Of Chicken Flavor)"` → species = `"chicken"`

Covers 28 species: chicken, beef, pork, lamb, turkey, duck, salmon, fish, tuna, crab, shrimp, venison, bison, rabbit, quail, herring, whitefish, cod, mackerel, sardine, anchovy, deer, elk, goat, pheasant.

Species injection applies to multiple base patterns (not just "Natural Flavor"):
- `"Natural Flavor (Chicken)"` → `"Natural Chicken Flavor"`
- `"Artificial Flavor (Beef)"` → `"Artificial Beef Flavor"`
- `"Animal Digest (Source Of Chicken Flavor)"` → `"Animal Digest (Chicken)"`
- `"Flavor (Salmon)"` → `"Natural Salmon Flavor"`

**Per-token — `extract_primary_name(token)`**
Strips parenthetical content using non-greedy matching:
`"Chicken Fat (Preserved With Mixed Tocopherols)"` → `"Chicken Fat"`
`"Dried Whey (from milk) Protein"` → `"Dried Whey Protein"` (text after paren preserved)

**Per-token — `strip_leading_conjunction(primary)`**
`"and Biotin"` → `"Biotin"`, `"or Citric Acid"` → `"Citric Acid"`. Eliminates `and_*` artifacts. Does NOT strip conjunctions inside names (`"Mono And Dicalcium Phosphate"` survives intact).

**Per-token — `extract_preservative(token)`**
Extracts preservative sub-ingredients from parenthetical metadata:
- `"(Preserved With Mixed Tocopherols)"` → `"Mixed Tocopherols"`
- `"(BHA Used As A Preservative)"` → `"BHA"`
- `"(A Preservative)"` / `"(Preservative)"` / `"(Used As A Preservative)"` → `"__self__"` (sentinel: parent IS the preservative)

Multi-preservatives are split: `"BHA And Citric Acid"` → inserts both `"BHA"` and `"Citric Acid"` at separate synthetic positions.

Extracted preservatives are inserted at synthetic positions (900 + recipe_offset + local_position).

**Per-token — `validate_token(primary)`**
Rejects junk before it enters `ingredients_dict`:
- Length > 80 chars or < 2 chars
- CSS/HTML artifacts (`{}`, `.flyout`, `display:`)
- URL fragments
- Review/marketing text
- Numeric-only strings
- Sentence-structured text (subject+verb pattern in long strings)
- Bare "preserved with" clauses that survived `fix_bare_preserved_with`

**Position assignment**
Recipe 0 positions: 1, 2, 3, ... Recipe 1 positions: 101, 102, 103, ... Recipe 2 positions: 201, 202, 203, ... This prevents `UNIQUE(product_id, position)` collisions in `product_ingredients` without requiring a schema migration for `recipe_name`.

### ingredient_matcher.py — Matcher v2.3 (324 lines)

Normalizes ingredient strings and matches against `ingredients_dict`.

**`normalize_ingredient(raw, synonyms)`**
Pipeline Stage 3. Transforms display text to canonical form:
1. camelCase splitting (`VitaminE` → `Vitamin E`, `CornProtein` → `Corn Protein`)
2. Lowercase, strip trailing periods
3. Strip zero-width characters
4. Strip parenthetical/bracket content (non-greedy)
5. **FD&C color detection** — runs FIRST, before anything can destroy the `FD&C` marker. Deterministic pattern matching for all dye variants: `FD&C Yellow #6 Lake` → `yellow_6`, `Allura Red AC` → `red_40`, `Tartrazine` → `yellow_5`, etc. Returns canonical name directly.
6. Synonym table lookup (checked repeatedly during stripping)
7. "Lake" suffix stripping (dye carrier form)
8. Residual `FD&C` prefix stripping
9. `#` removal
10. **While-loop prefix + amino stripping until stable**: dehydrated, dried, ground, whole, organic, natural, fresh, deboned, raw, added, concentrated, purified, plus L-/D-/DL- amino prefixes. Handles double-prefixed like `"Added Natural Flavor"` → `"Flavor"`.
11. Note: `"artificial"` is deliberately **NOT** in the prefix list. `"Artificial Beef Flavor"` stays as `artificial_beef_flavor` — stripping it would create false allergen matches.
12. "Supplement" suffix stripping
13. Chelate/proteinate collapsing: `zinc amino acid chelate` → `zinc_chelated`
14. Hyphen removal, spaces to underscores, strip non-alphanumeric

**`_match_color(s)`**
Deterministic FD&C color matching. 16 compiled regex patterns covering every variant seen in 9,000 products. Critical because these carry `caution`/`danger` severity — fuzzy matching would be too risky.

**`IngredientMatcher.match(raw)`**
Three-tier matching with length-scaled fuzzy thresholds:
- **Tier A (Exact):** Normalized key matches dictionary entry. ~85% of positions.
- **Tier B (Fuzzy):** Length-scaled Levenshtein distance. **≤5 chars = exact only** (no fuzzy — prevents beef↔bean), ≤10 chars = max dist 1, ≤15 chars = max dist 2, >15 chars = max dist 3. No ties allowed — ambiguous matches rejected. ~10%.
- **Tier C (New):** No match. Inserted as `neutral/neutral` with `review_status` unset. ~5%.

---

## 4. Known Data Quality Issues

These are problems in the scrape data that persist regardless of scraper version. The parser handles most of them, but awareness is needed.

### Issues the Parser Handles

| Pattern | Example | How parser handles it |
|---|---|---|
| Bare "preserved with" | `Chicken Fat, preserved with Mixed Tocopherols, Salt` | `fix_bare_preserved_with()` re-wraps into parens |
| Preserved-with at recipe boundary | `..., preserved with X. Beef: Beef, Salt` | Stops at periods, not just commas |
| "Added to preserve freshness" | `Mixed Tocopherols added to preserve freshness` | Stripped to `Mixed Tocopherols` |
| Variety packs | `Chicken & Beef: Chicken, Broth... Turkey: Turkey, Broth...` | `split_recipes()` splits on recipe boundaries |
| Variety pack position collisions | Positions reset per recipe | Offset by recipe_idx × 100 |
| Space-delimited lists | `Lamb Meal  Oatmeal  Brown Rice` | `detect_space_delimited()` converts to commas |
| Truncated ingredient lists | `Vitamins (Vitamin E, Niacin, Fol` | Auto-close brackets before tokenization |
| Leading conjunctions | `and Biotin`, `and Folic Acid` | `strip_leading_conjunction()` strips |
| FD&C color variants | `FD&C Yellow #6 Lake`, `Allura Red AC` | `_match_color()` deterministic patterns |
| Vitamin/mineral packs | `VITAMINS [Vitamin E, Niacin, ...]` | `expand_packs()` flattens |
| Missing open paren | `Chicken Fat preserved with mixed tocopherols)` | Regex repair in `clean_ingredients_raw` |
| "Inactive Ingredients:" prefix | `Inactive Ingredients: Coconut Glycerin, Lamb, ...` | Stripped in `clean_ingredients_raw` |
| Accented characters | `Entrée`, `pâté` | `unicodedata.normalize('NFKD')` |
| Zero-width characters | `\u200b` scattered in text | Stripped early in cleaning |
| CSS/HTML artifacts | `.flyout__help_center`, `{display:block}` | `validate_token()` rejects |
| "(A Preservative)" metadata | `Sorbic Acid (A Preservative)` | `extract_preservative()` returns `__self__` sentinel |
| "(Used As A Preservative)" | `BHA (Used As A Preservative)` | Returns `__self__` |
| Flavor species in parens | `Natural Flavor (Source Of Chicken Flavor)` | `extract_flavor_species()` → `Natural Chicken Flavor` |
| Flavor species on non-Natural base | `Animal Digest (Source Of Chicken Flavor)` | Broadened: Animal Digest, Artificial Flavor, generic Flavor |
| Multi-preservatives | `(Preserved With BHA And Citric Acid)` | Split on `and`/`&`, insert each separately |
| Greedy paren stripping | `Dried Whey (from milk) Protein` | Non-greedy `\([^)]*\)` preserves trailing text |
| Double-prefixed ingredients | `Added Natural Flavor` | While-loop strips until stable |
| False recipe splits on section headers | `Nutritional Supplements: Zinc...` | 28 guard words block |
| Numbered recipe headers | `Formula 1: Chicken...` | Digits supported in guard + boundary regex |

### Issues the Parser Does NOT Handle (Known Gaps)

**1. Named flavors without parens — allergen gap (HIGH PRIORITY)**
`"Chicken Liver Flavor"`, `"Beef Flavor"`, `"Pork Liver Flavor"` normalize correctly to `chicken_liver_flavor`, `beef_flavor`, `pork_liver_flavor` — but these entries lack `allergen_group` in the dictionary. A chicken-allergic dog gets NO warning when the product contains "Chicken Liver Flavor".

**Fix needed:** Dictionary audit. Any `*_flavor` entry containing a known protein species should get `allergen_group` assigned. Use full `allergen_group`, not `allergen_group_possible` — if it says chicken on the label, it's chicken.

**Frequency:** 12-13 per 77 sampled products. Extrapolated: ~1,500+ products affected.

**Species to map:**
```
chicken_flavor → allergen_group = 'chicken'
chicken_liver_flavor → allergen_group = 'chicken'
beef_flavor → allergen_group = 'beef'
pork_liver_flavor → allergen_group = 'pork'
salmon_flavor → allergen_group = 'fish'
fish_flavor → allergen_group = 'fish'
turkey_flavor → allergen_group = 'turkey'
lamb_flavor → allergen_group = 'lamb'
duck_flavor → allergen_group = 'duck'
natural_chicken_flavor → allergen_group = 'chicken'
natural_beef_flavor → allergen_group = 'beef'
artificial_chicken_flavor → allergen_group = NULL (artificial flavors lack allergenic proteins)
artificial_beef_flavor → allergen_group = NULL
```

**2. Conjunction inside ingredient name**
`"Mono And Dicalcium Phosphate"`, `"Egg And Chicken Flavor"`, `"Beef & Bone Meal"` — these conjunctions are part of the ingredient name, not separators. The tokenizer handles them correctly (they survive as one token), and `strip_leading_conjunction` only fires on leading conjunctions. But the normalizer produces `mono_and_dicalcium_phosphate` which needs a synonym mapping to `dicalcium_phosphate`. Currently handled by the synonym table for the most common cases.

**3. Muenster-type marketing text in #INGREDIENTS-section (~165 products)**
Some products have marketing taglines in Chewy's `#INGREDIENTS-section` instead of real ingredients:
`"Chicken And Pork Meals-Nutrient Rich, Highly Digestible Source Of Proteins, Amino Acids And Minerals."`

The scraper's validation catches most of these (rejects if no tech terms and reads like a sentence), but some slip through. No scraper fix possible — the data is wrong at Chewy's end. Needs manufacturer-site scrape or OCR from bag photos.

**4. Single-space-delimited lists (~2 products)**
Some products use single spaces with no commas at all: `"Beef Farm-Raised Pork Pork Meal Barley Oatmeal"`. The `detect_space_delimited` function requires double-spaces (≥5) to trigger. Single-space lists are indistinguishable from multi-word ingredient names. Unsalvageable without the original comma-separated source.

**5. Mid-list periods causing false recipe splits**
`"Chondroitin Sulfate. Chicken Flavor, Turmeric"` — the period before "Chicken Flavor" could trigger `split_recipes()` if combined with another colon elsewhere. Currently mitigated by requiring 2+ recipe headers, but edge cases exist.

**6. Truncated ingredient lists (~1,031 products)**
Chewy truncates long ingredient lists. The parser now auto-closes unclosed brackets so the tokenizer doesn't fuse tail ingredients. The first 10-15 ingredients (most important for scoring) are intact, but tail-end vitamins may be missing, affecting formulation completeness scoring. Products get `score_confidence: 'partial'` badge.

**7. Variety pack scoring policy (NOT YET DECIDED)**
`split_recipes()` correctly splits variety packs into per-recipe ingredient lists. But the scoring engine doesn't know what to do with them yet. Options:
- Score the worst recipe (most conservative)
- Score each recipe separately, show range
- Let user pick which flavor they're feeding
- Average across recipes

This is a product decision for Steven, not a parser fix.

**8. `recipe_name` column not in schema yet**
Parser v2.3 extracts recipe names and stores them in `ingredient_links` tuples but the column doesn't exist in `product_ingredients` yet. Positions are offset per recipe (N×100) so data is preserved without the column. When the migration is run, the insert can be updated to include `recipe_name`.

**9. `__self__` preservative metadata discarded**
When an ingredient IS the preservative (e.g., "Sorbic Acid (A Preservative)"), the `__self__` sentinel skips creating a duplicate synthetic position. But the metadata that this ingredient serves as a preservative is not stored. Would require an `is_preservative` boolean on `product_ingredients`. Queue for preservative badge feature.

---

## 5. Ingredient Dictionary State

### Current state (pre-rescrape)
- 3,619 entries total
- 205 with full content (`tldr`, `definition`, `detail_body`) — `review_status = 'manual'`
- 208 with `has_content = true`
- 107 remaining parsing artifacts (CSS classes, `and_*` prefixes, marketing text)
- 387 with `position_reduction_eligible = true`
- 13 with `is_legume = true`
- 54 with `cluster_id` set
- 291 with `allergen_group` set

### Master ingredient list: 206 curated entries (Tiers 1-4)
Stored in `Kiba_Ingredient_Master_List.xlsx`. These are the gold standard with manually verified severities, species-specific ratings, and clinical rationale. Covers the highest-impact ingredients.

### Severity distribution (post-M4 audit)
Dogs: 192 good, 3186 neutral, 237 caution, 4 danger
Cats: 160 good, 3126 neutral, 318 caution, 15 danger

### Species disagreements (35 entries — all intentional)
Key examples:
- `pea_protein`: dog=Caution, cat=Danger (obligate carnivore carb sensitivity)
- `corn`, `wheat`, `tapioca_starch`: dog=Neutral, cat=Caution (feline carb metabolism)
- `propylene_glycol`: dog=Caution, cat=Danger (feline Heinz body anemia)
- `garlic_powder`/`dried_garlic`: dog=Caution, cat=Danger (feline oxidative hemolysis)
- `vitamin_a_supplement`: dog=Neutral, cat=Caution (feline hepatic accumulation)
- `spinach`, `kale`: dog=Neutral, cat=Caution (oxalate risk)

### Known severity corrections needed
- `fish_oil`: currently Caution (Rule 11a unnamed organ/fat), should be Neutral/Neutral. Fish oil is a standardized functional supplement, not an unnamed protein source.
- `needs_severity_review.csv`: 729 neutral/neutral ingredients with 5+ occurrences awaiting manual review.

---

## 6. Scraper v6 — What It Does

### Extraction Strategy Cascade

```
A:  #INGREDIENTS-section p          ← Chewy's accordion DOM (most reliable, 96.7%)
A2: Supplement active+inactive merge ← Combines both sections for supplements
B:  Next.js state blob key search    ← Deep search in page JSON
B2: Next.js scored candidates        ← Score multiple candidates, pick best
C:  [data-testid="ingredients-text"] ← Legacy Chewy attribute
D:  Heading sibling search           ← Find "Ingredients" heading, grab next element
E:  Long comma-separated text        ← Heuristic: food keywords + comma density
F:  Regex on full page text          ← Last resort
```

### Veterinary Diet Detection (D-135)

Two tiers:
- **`veterinary`** (high confidence): Matches title against "Royal Canin Veterinary Diet", "Hill's Prescription Diet", "Purina Pro Plan Veterinary", "Hydrolyzed Protein", "Hepatic", "Renal...Diet", etc. Sets `_is_vet_diet: true`. These are stored but NOT scored.
- **`veterinary-mention`** (low confidence): "veterinary" appears in page text but not in high-confidence title patterns. Flagged for review.

### Key QA Fields on Scrape Records

| Field | Purpose |
|---|---|
| `_ing_strategy` | Which extraction strategy found ingredients (audit) |
| `_is_vet_diet` | Boolean — scoring engine bypass flag |
| `_qa_has_ingredients` | Boolean — ingredients_raw is non-null |
| `_qa_has_ga` | Boolean — protein + fat both found |
| `_qa_has_upc` | Boolean — barcode extracted |
| `notes` | Pipe-delimited QA flags: INGREDIENTS MISSING, VET DIET, SUPPLEMENT, etc. |

### Resume Capability

`startIndex` input parameter. If scrape is interrupted:
1. Check dataset for last successfully scraped product
2. Find that URL in the crawl products array
3. Set `"startIndex": N` in next run input
4. Display is 1-based (`[N+1/9089]`), array is 0-based

---

## 7. Full Workflow: Scrape to Finished Database

### Phase 1: Scrape (Apify) — ✅ COMPLETE

9,089 products scraped across 3 runs. Merged into `dataset_kiba_v6_merged.json`.

### Phase 2: Validate Scrape Output — ✅ COMPLETE

Results: 98.6% ingredient coverage, 0 garbage grabs, 125 vet diets. See Section 2 for full numbers.

### Phase 3: Database Cleanup (Clean Slate)

```sql
DELETE FROM product_ingredients;

-- Delete remaining 107 artifacts
DELETE FROM ingredients_dict
WHERE canonical_name LIKE '.flyout%'
   OR canonical_name LIKE 'and_%'
   OR length(canonical_name) > 80
   OR canonical_name ~ '[{}]';

-- Verify curated entries survived
SELECT count(*) FROM ingredients_dict WHERE review_status = 'manual';
-- Should be 205
```

### Phase 4: Re-import Products

```bash
python3 scripts/import/import_products.py
```

Input file: `dataset_kiba_v6_merged.json` (9,089 products, 23.6 MB)

### Phase 5: Reparse Ingredients

```bash
# Dry run first
python3 scripts/import/parse_ingredients.py --dry-run

# Check: match rate >95%, new ingredients look reasonable, v2.3 stats
# Then:
python3 scripts/import/parse_ingredients.py
```

**Files:** `parse_ingredients.py` v2.3 + `ingredient_matcher.py` v2.3 + `synonyms.json`

**Output reports:**
- `matched_ingredients.json` — frequency-sorted matched ingredients
- `new_ingredients.json` — new ingredients needing severity assignment + review
- `parsing_errors.json` — errors + v2.3 stats (variety packs split, tokens rejected, conjunctions stripped, preservatives extracted, space-delimited fixed)

### Phase 6: Post-parse Cleanup

```bash
python3 scripts/import/cleanup_ingredients.py --dry-run
python3 scripts/import/cleanup_ingredients.py
```

Only Phase 3 (severities) and Phase 4 (clusters) should do real work. Phases 1-2 (artifact merges/junk deletion) should find nothing if v2.3 parser worked correctly.

### Phase 7: Rescore

```bash
npx ts-node scripts/scoring/batch_score.ts
```

**Regression note:** The Pure Balance target of 69 was set against manually entered test data. The v6 rescrape + v2.3 reparse produces a full ingredient list from Chewy, which may score differently. After rescoring, check Pure Balance — the new score becomes the regression target. Update DECISIONS.md and test expectations accordingly.

### Phase 8: Ingredient Content Generation (D-134)

**Tier 1 — Already done:** 205 curated entries with `review_status = 'manual'`. Never overwritten.

**Tier 2 — Sonnet batch for next ~200 by occurrence (~$2):**
Use 5 curated entries as few-shot examples. Set `review_status = 'llm_needs_review'` for caution/danger, `'llm_generated'` for neutral/good. Steven manually reviews the ~50-80 caution/danger entries.

**Tier 3 — Haiku batch for remaining ~448 (~$0.50):**
Low-occurrence neutral/neutral ingredients. Simple content. All get `review_status = 'llm_generated'`.

**Tier 4 — Skip:** Ingredients with <5 occurrences and neutral/neutral. No content needed at launch.

Prompt, validation rules, and safety guards are detailed in the M4 Prompt Guide (Prompt 5.3, D-134).

### Phase 9: Verify

```sql
SELECT count(*) FROM products WHERE ingredients_raw IS NOT NULL;
SELECT count(*) FROM product_ingredients;
SELECT count(*) FROM ingredients_dict;

-- Zero artifacts
SELECT canonical_name FROM ingredients_dict
WHERE length(canonical_name) > 80
   OR canonical_name LIKE 'and_%'
   OR canonical_name LIKE '.%';

-- Vet diets
SELECT count(*) FROM products WHERE special_diet LIKE '%veterinary%';

-- Content coverage
SELECT
  count(*) as total,
  count(tldr) as has_content,
  count(CASE WHEN review_status = 'manual' THEN 1 END) as curated,
  count(CASE WHEN review_status = 'llm_generated' THEN 1 END) as llm_ok,
  count(CASE WHEN review_status = 'llm_needs_review' THEN 1 END) as needs_review
FROM ingredients_dict;
```

---

## 8. Key Decisions Referenced

| Decision | Summary |
|---|---|
| D-034 | No AI chatbot — permanently removed (liability) |
| D-042 | OPFF replaced by Apify scraping pipeline |
| D-044 | Formula change detection via ingredients_hash |
| D-083 | Cosmetics/grooming deferred to M16+ |
| D-091 | Database miss flow: parse-ingredients + upc-lookup Edge Functions |
| D-095 | UPVM compliance — no prescribe/treat/cure/prevent/diagnose in UI copy |
| D-096 | Supplements stored but not scored |
| D-106 | Separate nutritional quality from portion/weight management |
| D-127 | Haiku/Sonnet API key in scripts only, never in app binary |
| D-128 | Edge Function classifies category + species alongside parsing |
| D-129 | Allergen severity override: direct = danger (15pts), possible = caution (8pts) |
| D-134 | Ingredient content generation — LLM-generated, review-gated by severity |
| D-135 | Prescription/therapeutic diet bypass — store but don't score |

---

## 9. Post-Rescrape Follow-ups (Priority Order)

1. **Named flavor allergen audit** — Assign `allergen_group` to all `*_flavor` entries containing protein species. Full `allergen_group`, not `possible`. `artificial_*_flavor` entries get NULL (no allergenic proteins). HIGH PRIORITY.
2. **`fish_oil` severity** — Change from caution to neutral/neutral.
3. **`needs_severity_review.csv`** — 729 ingredients for manual/Sonnet batch review.
4. **Synonym expansion** — If match rate <95%, expand `synonyms.json` iteratively. Run parser, collect unmatched from `new_ingredients.json`, add synonyms, re-run.
5. **Variety pack scoring policy** — Product decision: worst recipe? User picks? Average?
6. **`recipe_name` column migration** — Add to `product_ingredients` schema, update insert in parser.
7. **Muenster-type products** — ~165 daily foods with marketing text in `#INGREDIENTS-section`. Manufacturer-site scrape or OCR needed.
8. **Content generation** — Tier 2 (Sonnet ~200) + Tier 3 (Haiku ~448) per Phase 8 above.
9. **`is_preservative` column** — Add to `product_ingredients` for preservative badge feature.
10. **iOS development build** — Deferred from M4, expo-av deprecated on SDK 55.

---

## 10. File Locations

```
scripts/import/
├── main.js                    ← Scraper v6 (deploy to Apify)
├── parse_ingredients.py       ← Parser v2.3 (1,122 lines)
├── ingredient_matcher.py      ← Matcher v2.3 (324 lines)
├── test_parser.py             ← Parser test suite (75 cases)
├── cleanup_ingredients.py     ← Post-import severity + cluster assignment
├── import_products.py         ← JSON → Supabase products table
├── config.py                  ← Shared: env vars, Supabase client
├── synonyms.json              ← Canonical name mappings
└── reports/
    ├── matched_ingredients.json
    ├── new_ingredients.json
    └── parsing_errors.json

scripts/content/
├── generate_ingredient_content.py  ← LLM batch content generation
└── content_generation_report.json

data/
├── Kiba_Ingredient_Master_List.xlsx    ← 206 curated ingredients (Tiers 1-4)
├── full_ingredient_audit_post_fix.csv  ← 3,619 entries post-M4 cleanup
├── needs_severity_review.csv           ← 729 entries for manual review
└── dataset_kiba_v6_merged.json         ← Scrape output (9,089 products, 23.6 MB)
```

---

## 11. Test Verification

Before running the pipeline in a new environment, verify the parser and matcher:

```bash
# Parser v2.3: 75 tests covering all fixes (1-12 + review fixes)
python3 scripts/import/test_parser.py
# Expected: 75 passed, 0 failed

# Matcher v2.3: inline verification
python3 -c "
from ingredient_matcher import normalize_ingredient
tests = [
    ('FD&C Yellow #6', 'yellow_6'),
    ('Red 40 Lake', 'red_40'),
    ('Allura Red AC', 'red_40'),
    ('L-Tryptophan', 'tryptophan'),
    ('DL-Methionine', 'methionine'),
    ('Dried Beet Pulp', 'beet_pulp'),
    ('Vitamin E Supplement', 'vitamin_e'),
    ('Artificial Beef Flavor', 'artificial_beef_flavor'),
    ('Added Natural Flavor', 'flavor'),
    ('Zinc Amino Acid Chelate', 'zinc_chelated'),
    ('Zinc Sulfate', 'zinc_sulfate'),
]
for raw, expected in tests:
    result = normalize_ingredient(raw)
    status = '✓' if result == expected else '✗'
    print(f'{status} {raw} → {result}')
"
```

---

## 12. All Fixes Applied (Complete Log)

| # | Fix | Source | Impact |
|---|---|---|---|
| 1 | Bare "preserved with" re-wrapping | Sample analysis | 29/77 products |
| 2 | Missing open paren repair | Sample analysis | 6/77 products |
| 3 | "Ingredients:" recipe split guard | Sample analysis | Prevents false splits |
| 4 | "Essential Nutrients" guard | Sample analysis | Prevents false splits |
| 5 | Section header guards (active, guaranteed, etc.) | Sample analysis | Prevents false splits |
| 6 | Flavor species extraction | Sample analysis | 12/77 products |
| 7 | "(A Preservative)" / "(Used As A Preservative)" | Sample analysis | Correct metadata |
| 8 | validate_token bare preserved-with safety net | Sample analysis | Belt-and-suspenders |
| 9 | Accented character normalization | Sample analysis | Entrée → Entree |
| 10 | Preserved-with stops at period | Batch 4 | 5/104 products |
| 11 | Expanded guard words (nutritional, new, see, etc.) | Batch 3+4 | Prevents false splits |
| 12 | "Added to preserve freshness" cleanup | Batch 3 | 2/104 products |
| 1A | Non-greedy paren stripping | External review | Preserves trailing text |
| 1B | Variety pack position offsets (N×100) | External review | ~665 variety packs |
| 2A | "Artificial" removed from STRIP_PREFIXES | External review | Prevents false allergens |
| 2B | Broader flavor species injection | External review | Animal Digest, Artificial Flavor |
| 3A | Length-scaled fuzzy thresholds | External review | Prevents beef↔bean |
| 3B | Multi-preservative split on and/& | External review | BHA And Citric Acid |
| 3C | While-loop prefix stripping | External review | Added Natural Flavor |
| 4B | Dead mineral collapsing code removed | External review | Cleanup |
| A | Digit in guard regex | Review 2 | Formula 1/2 headers |
| B | Auto-close truncated brackets | Review 2 | ~1,031 truncated products |
