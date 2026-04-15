# Kiba — M3 Ingredient Parsing Pipeline

> Transforms `ingredients_raw` free text into structured `product_ingredients` rows linked to `ingredients_dict`.
> This is the critical path item for M3. Without it, the scoring engine has no ingredients to score.

> **Implementation:** Python 3.10+ in `scripts/import/` (per M3 Prompt Guide, Session 1).
> TypeScript interfaces and code samples below are reference implementations showing data shapes
> and algorithms — the actual build is Python using `supabase-py`. The pipeline runs as a
> one-time batch job, NOT inside the mobile app.

---

## The Numbers

| Metric | Count |
|---|---|
| Products with `ingredients_raw` | 5,855 |
| Unique formulas (deduplicated) | 4,917 |
| Estimated ingredient-position rows | ~221,000 |
| Raw unique ingredient strings | ~10,200 |
| Top 62 ingredients cover | 50% of all positions |
| Top 358 ingredients cover | 80% of all positions |
| Top 944 ingredients cover | 90% of all positions |
| Top 2,140 ingredients cover | 95% of all positions |
| Contaminated products (HTML/font leak) | 26 |
| Possibly truncated ingredient lists | 1,031 |
| Products sharing identical formulas (size variants) | 938 |

**Key insight:** A dictionary of ~1,000 canonical ingredients covers 90% of every ingredient-position row across all 5,855 products. The remaining 10% is a long tail of rare ingredients, supplement actives, and parsing artifacts.

---

## Pipeline Architecture — 6 Stages

```
Stage 1: Clean          Raw text → sanitized text
Stage 2: Tokenize       Sanitized text → ordered token array
Stage 3: Normalize      Tokens → canonical name candidates
Stage 4: Match          Candidates → ingredients_dict IDs
Stage 5: Expand         Unmatched → new ingredients_dict entries
Stage 6: Load           Matched pairs → product_ingredients rows
```

Each stage is independently testable. Each stage writes output that the next stage reads. If any stage fails for a product, that product is flagged for manual review rather than silently dropped.

---

## Stage 1: Clean Raw Text

**Input:** `products.ingredients_raw` (free text, 5,855 rows)
**Output:** `products.ingredients_cleaned` (sanitized text, same rows)

### Problems to handle:

**1a. HTML/JSON contamination (26 products)**
Some Chewy scrapes captured page metadata instead of ingredients. These contain CSS font names (`verdana`, `arial`, `roboto`), HTML entities, or JSON-LD fragments.

Detection: `ingredients_raw` contains any of: `verdana`, `arial`, `roboto`, `schema.org`, `<script`, `</div`, `priceCurrency`

Action: Flag as `_ingredient_status: 'contaminated'`. These 26 products need re-scraping from manufacturer sites (Scrape.do task, ~5 minutes of credits).

**1b. Trailing product codes (common)**
Many Chewy ingredient lists end with internal codes like `M444922`, `A415423`, `A445523`.

Detection: regex `/\.\s*[A-Z]?\d{4,}$/`

Action: Strip the trailing code. Preserve the period as end-of-list marker.

**1c. Truncation (1,031 products)**
Chewy truncates long ingredient lists at ~500 characters. These cut off mid-word or mid-vitamin-pack.

Detection: `ingredients_raw` doesn't end with `.`, `)`, or `]` AND length > 100 AND last token appears incomplete (no matching close paren/bracket).

Action: Flag as `_ingredient_status: 'truncated'`. Parse what's available — the first 10-15 ingredients (which matter most for scoring) are intact. Add `score_confidence: 'partial'` to the product. Do NOT attempt to complete the list — partial data beats fabricated data.

**1d. Normalization basics**
- Trim whitespace
- Collapse multiple spaces to single space
- Strip leading/trailing periods
- Normalize curly quotes to straight quotes
- Remove non-printable characters

### Stage 1 output:
```typescript
interface CleanedProduct {
  product_id: string;
  ingredients_cleaned: string;
  ingredient_status: 'clean' | 'truncated' | 'contaminated' | 'empty';
  trailing_code_stripped: string | null;  // preserved for audit
}
```

### Test cases:
- Pedigree Complete Nutrition → strips trailing code, status: clean
- Product with `verdana` in text → status: contaminated
- Product cut off mid-word → status: truncated
- Product with null/empty ingredients_raw → status: empty

---

## Stage 2: Tokenize Into Ordered Ingredients

**Input:** `ingredients_cleaned` (sanitized text)
**Output:** Ordered array of ingredient tokens with metadata

### The core challenge: parenthetical groups

Pet food ingredient lists use commas to separate ingredients, BUT also use commas inside parenthetical groups:

```
Animal Fat (Source Of Omega 6 Fatty Acids [Preserved With Bha & Citric Acid])
```

This is ONE ingredient ("Animal Fat") with nested metadata, not six separate ingredients.

### Tokenization rules:

**2a. Parenthetical handling — the bracket-depth parser**

Track bracket depth. Only split on commas at depth 0.

```
depth 0: "Animal Fat " → split here on comma
depth 1: "(Source Of Omega 6 Fatty Acids " → inside parens, don't split
depth 2: "[Preserved With Bha & Citric Acid]" → inside brackets inside parens
depth 1: ")" → back to depth 1
depth 0: → back to top level, ready for next comma split
```

Implementation:
```typescript
function tokenize(cleaned: string): RawToken[] {
  const tokens: RawToken[] = [];
  let depth = 0;
  let current = '';
  let position = 1;

  for (const char of cleaned) {
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);  // guard against unbalanced
      current += char;
    } else if (char === ',' && depth === 0) {
      // Split point
      if (current.trim().length > 0) {
        tokens.push({ raw: current.trim(), position });
        position++;
      }
      current = '';
    } else {
      current += char;
    }
  }
  // Don't forget the last token
  if (current.trim().length > 0) {
    tokens.push({ raw: current.trim(), position });
  }
  return tokens;
}
```

**2b. Vitamin/mineral pack flattening**

Some products use grouped packs:
```
Vitamins (Vitamin E Supplement, Niacin, Vitamin A Supplement, Folic Acid, Biotin)
```

These need to be flattened: the pack header ("Vitamins") is discarded, and each sub-ingredient gets its own position — BUT they share a single logical position for scoring purposes (they're all at the same approximate proportion).

Detection: Token starts with `Vitamins` or `Minerals` followed by `(` containing comma-separated items.

Action: Expand into individual tokens. All expanded tokens share the parent's position number with sub-positions: `position: 15, sub_position: 1`, `position: 15, sub_position: 2`, etc.

**Why this matters for scoring:** Vitamin/mineral pack ingredients are all Tier 3-4 (beneficial supplements). Their position in the list is irrelevant — they're present in tiny quantities regardless. But they MUST be in the ingredient list for formulation completeness scoring (Layer 1, Bucket 3) and for breed modifier triggers (e.g., taurine supplementation for DCM mitigation).

**2c. Colon-delimited packs**

Some products use colons instead of parentheses:
```
Minerals: (Zinc Proteinate, Iron Proteinate, Copper Proteinate)
```

Detection: Token contains `:` followed by `(` or directly followed by comma-separated items.

Action: Same flattening logic as 2b.

**2d. Sub-ingredient extraction**

Parenthetical content after an ingredient name contains sub-ingredients or metadata:
```
Chicken Fat (Preserved With Mixed Tocopherols)
```

This yields:
- Primary ingredient: `Chicken Fat` at position N
- Metadata: `preserved_with: 'Mixed Tocopherols'`
- The preservative is ALSO added to the ingredient list at a synthetic position (after all explicit ingredients) because it matters for scoring — "Preserved With Mixed Tocopherols" is a positive signal; "Preserved With BHA" is negative.

Extraction patterns:
| Pattern | Example | Action |
|---|---|---|
| `Preserved With X` | `(Preserved With Mixed Tocopherols)` | Add X as ingredient at synthetic position, flag as preservative |
| `X Used As A Preservative` | `(Mixed Tocopherols Used As A Preservative)` | Same as above |
| `Source Of X` | `(Source Of Omega 6 Fatty Acids)` | Metadata tag, not a separate ingredient |
| `For Color` / `Added Color` | `(For Color)` | Flag parent as cosmetic additive |
| `A Source Of Y` | `(A Source Of Vitamin E)` | Metadata tag |

### Stage 2 output:
```typescript
interface ParsedToken {
  raw: string;              // original text including parens
  primary: string;          // ingredient name without parens (e.g., "Chicken Fat")
  position: number;         // label order (1 = first listed)
  sub_position?: number;    // for vitamin pack expansion
  metadata: {
    preserved_with?: string;
    source_of?: string;
    is_cosmetic_color?: boolean;
    is_vitamin_pack_member?: boolean;
  };
}
```

### Test cases:
- `"Animal Fat (Source Of Omega 6 Fatty Acids [Preserved With Bha & Citric Acid])"` → primary: "Animal Fat", metadata: { source_of: "Omega 6 Fatty Acids", preserved_with: "Bha & Citric Acid" }
- `"Vitamins (Vitamin E Supplement, Niacin, Folic Acid)"` → 3 tokens, each with is_vitamin_pack_member: true
- `"Red 40"` → primary: "Red 40", no metadata
- `"Carmine (Color)"` → primary: "Carmine", metadata: { is_cosmetic_color: true }

---

## Stage 3: Normalize to Canonical Candidates

**Input:** `ParsedToken.primary` strings
**Output:** Canonical name candidates (lowercase, standardized format)

### Normalization rules (applied in order):

```typescript
function normalize(primary: string): string {
  let s = primary.toLowerCase().trim();

  // 1. Strip trailing periods
  s = s.replace(/\.+$/, '');

  // 2. Remove "dehydrated", "dried", "ground", "whole" — keep for display, strip for matching
  //    BUT preserve "dried plain beet pulp" → "beet pulp" and "ground whole grain corn" → "corn"
  s = s.replace(/^(dehydrated|dried|ground|whole grain|whole)\s+/i, '');
  s = s.replace(/^(plain|organic|natural|fresh|deboned|raw)\s+/i, '');

  // 3. Collapse supplement suffixes
  s = s.replace(/\s+supplement$/i, '');

  // 4. Normalize common synonyms
  const synonyms: Record<string, string> = {
    'dl-methionine': 'methionine',
    'dl-alpha tocopheryl acetate': 'vitamin_e',
    'd-calcium pantothenate': 'pantothenic_acid',
    'calcium pantothenate': 'pantothenic_acid',
    'pyridoxine hydrochloride': 'vitamin_b6',
    'thiamine mononitrate': 'vitamin_b1',
    'riboflavin': 'vitamin_b2',
    'riboflavin supplement': 'vitamin_b2',
    'niacin': 'vitamin_b3',
    'niacin supplement': 'vitamin_b3',
    'folic acid': 'folate',
    'biotin': 'vitamin_b7',
    'ascorbic acid': 'vitamin_c',
    'cholecalciferol': 'vitamin_d3',
    'menadione sodium bisulfite complex': 'vitamin_k3',
    'l-ascorbyl-2-polyphosphate': 'vitamin_c',
    'alpha-tocopherol acetate': 'vitamin_e',
    'ferrous sulfate': 'iron_sulfate',
    'zinc oxide': 'zinc',
    'manganous oxide': 'manganese',
    'sodium selenite': 'selenium',
    'calcium iodate': 'iodine',
    'potassium iodide': 'iodine',
    'cobalt carbonate': 'cobalt',
    'ethylenediamine dihydriodide': 'iodine',
    'fd&c red #40': 'red_40',
    'fd&c yellow #6': 'yellow_6',
    'fd&c yellow #5': 'yellow_5',
    'fd&c blue #1': 'blue_1',
    'allura red ac': 'red_40',
    'tartrazine': 'yellow_5',
    'brewers rice': 'brewers_rice',
    'brewers dried yeast': 'brewers_yeast',
    'chicken by-product meal': 'chicken_byproduct_meal',
    'chicken byproduct meal': 'chicken_byproduct_meal',
    'poultry by-product meal': 'poultry_byproduct_meal',
    'turkey by-product meal': 'turkey_byproduct_meal',
    'soybean oil': 'soy_oil',
    'soy protein concentrate': 'soy_protein',
    'powdered cellulose': 'cellulose',
    'microcrystalline cellulose': 'cellulose',
    'guar gum': 'guar_gum',
    'xanthan gum': 'xanthan_gum',
    'carrageenan': 'carrageenan',
    'sodium tripolyphosphate': 'sodium_tripolyphosphate',
  };

  if (synonyms[s]) return synonyms[s];

  // 5. Collapse amino acid chelates to parent mineral
  // "zinc amino acid chelate" → "zinc_chelated"
  // "iron amino acid chelate" → "iron_chelated"
  const chelateMatch = s.match(/^(zinc|iron|copper|manganese|cobalt)\s+(amino acid |protein|proteinate|polysaccharide)?(chelate|complex)/);
  if (chelateMatch) return chelateMatch[1] + '_chelated';

  // 6. Final cleanup
  s = s.replace(/\s+/g, '_');    // spaces to underscores
  s = s.replace(/[^a-z0-9_-]/g, '');  // strip non-alphanumeric

  return s;
}
```

### Important: preserve the raw display name

The `ParsedToken.primary` ("Chicken By-Product Meal") is preserved for the UI display name. The normalized canonical name (`chicken_byproduct_meal`) is only for dictionary matching. Users never see canonical names.

### Synonym table scale

The inline synonym map above handles ~50 common cases. The full synonym table for production should cover ~300-400 mappings built iteratively:

1. Start with the top 358 ingredients (covers 80% of positions)
2. Run Stage 3 on all 5,855 products
3. Collect unmatched strings
4. Build synonym mappings for the top unmatched by frequency
5. Repeat until match rate > 95%

### Stage 3 output:
```typescript
interface NormalizedToken {
  raw: string;                    // original text
  primary_display: string;        // cleaned display name ("Chicken By-Product Meal")
  canonical_candidate: string;    // normalized key ("chicken_byproduct_meal")
  position: number;
  sub_position?: number;
  metadata: { ... };              // preserved from Stage 2
  normalization_applied: string[];  // audit trail: ["lowercased", "synonym:chicken by-product meal→chicken_byproduct_meal"]
}
```

---

## Stage 4: Match to `ingredients_dict`

**Input:** `NormalizedToken.canonical_candidate` strings
**Output:** Matched `ingredients_dict.id` or `unmatched` flag

### Matching strategy (3 tiers):

**Tier A — Exact match (expected: ~85% of positions)**
```sql
SELECT id FROM ingredients_dict
WHERE canonical_name = $canonical_candidate;
```

This works for all ingredients already in the dictionary. With our 119 seeded entries (Tiers 1/1.5/2 already in Supabase) plus the remaining top ~381 ingredients pre-seeded via Haiku, this catches the vast majority.

**Tier B — Fuzzy match (expected: ~10% of positions)**

For tokens that don't exact-match, apply Levenshtein distance with a threshold of 2 edits for short names, 3 for long names:

```typescript
function fuzzyMatch(candidate: string, dictionary: string[]): string | null {
  const maxDist = candidate.length > 15 ? 3 : 2;
  let best: { name: string; dist: number } | null = null;

  for (const dictName of dictionary) {
    const dist = levenshtein(candidate, dictName);
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { name: dictName, dist };
    }
  }

  // Only accept if unambiguous (no ties at same distance)
  return best ? best.name : null;
}
```

Common fuzzy catches:
- `chicken_meal` vs `chickenmeal` (missing underscore)
- `vitamin_e` vs `vitamine` (typo)
- `brewers_rice` vs `brewer_rice` (missing s)

**Tier C — Claude Haiku batch (expected: ~5% of positions, ~500 unique unknowns)**

Remaining unmatched tokens are batched and sent to Claude Haiku for classification:

```
Prompt: You are a pet food ingredient classifier.
For each ingredient below, provide:
1. canonical_name: the standardized ingredient name (lowercase, underscores)
2. category: one of [protein, fat, carb, fiber, vitamin, mineral, amino_acid, preservative, colorant, flavor, binder, probiotic, enzyme, other]
3. dog_severity: one of [beneficial, neutral, caution, danger]
4. cat_severity: one of [beneficial, neutral, caution, danger]
5. is_unnamed_species: boolean
6. position_reduction_eligible: boolean
7. brief_reason: one sentence

Respond ONLY in JSON array format, no markdown.

Ingredients to classify:
1. "suncured alfalfa meal"
2. "dried bacillus coagulans fermentation product"
3. "sodium acid pyrophosphate"
...
```

Batch size: 20 ingredients per API call (keeps token count manageable, allows Haiku to focus).

Model: `claude-haiku-4-5-20251001` (cheapest, fast, sufficient for structured classification).
API key: from `.env` file — this script runs server-side in `scripts/`, never in the app (D-127).

**Critical: human review gate.** Claude Haiku classifications are inserted into `ingredients_dict` with `review_status: 'llm_generated'`. They are immediately usable for scoring (Layer 1 needs severity ratings) but flagged for Steven's review before the vet audit. No `danger` rating from Haiku goes live without human confirmation.

### Match results tracking:
```typescript
interface MatchResult {
  token: NormalizedToken;
  ingredient_dict_id: string | null;
  match_tier: 'exact' | 'fuzzy' | 'llm' | 'unresolved';
  fuzzy_distance?: number;
  llm_confidence?: 'high' | 'medium' | 'low';
}
```

---

## Stage 5: Expand `ingredients_dict`

**Input:** Unmatched tokens from Stage 4 Tier C
**Output:** New `ingredients_dict` rows

### What gets added:

Every ingredient that appears in a real product needs a `ingredients_dict` entry, even if it's a boring vitamin supplement. The entry needs at minimum:

```sql
INSERT INTO ingredients_dict (
  canonical_name,           -- 'suncured_alfalfa_meal'
  display_name,             -- 'Sun-Cured Alfalfa Meal' (from original label text)
  dog_base_severity,        -- from Claude Haiku classification
  cat_base_severity,        -- from Claude Haiku classification
  position_reduction_eligible,  -- from Claude Haiku classification
  is_unnamed_species,       -- from Claude Haiku classification
  review_status             -- 'llm_generated' (not 'verified')
) VALUES (...);
```

**WARNING: cluster_id will be NULL for all new entries.** Ingredient splitting detection
(`GROUP BY cluster_id HAVING count >= 2`) will NOT work for new ingredients until Steven
manually assigns cluster_id values for related ingredient groups (e.g., "peas", "pea protein",
"pea starch" → same cluster). The 119 seeded ingredients already have cluster_id assigned
for key groups (corn, pea, rice, potato, chicken). New entries from Haiku classification
need manual cluster assignment for the high-frequency ones — track these in the
`new_ingredients.json` report.

### Expansion priority:

**Batch 1 — High frequency unknowns (do first)**
Any unmatched ingredient appearing 10+ times across products. Estimated: ~200-300 ingredients. These affect hundreds of product scores.

**Batch 2 — Medium frequency (do second)**
Appearing 3-9 times. Estimated: ~500 ingredients. Important for score completeness.

**Batch 3 — Long tail (do last, or skip)**
Appearing 1-2 times. Estimated: ~2,000+ strings. Many are parsing artifacts, typos, or product-code contamination. Cost/benefit of classifying each one is low. Assign `severity: neutral` by default with `review_status: 'auto_neutral'`.

### Cost estimate for Claude Haiku batch:

| Batch | Unique ingredients | API calls (20/batch) | Haiku cost |
|---|---|---|---|
| Batch 1 | ~250 | 13 | ~$0.05 |
| Batch 2 | ~500 | 25 | ~$0.10 |
| Batch 3 | ~2,000 | 100 | ~$0.40 |
| **Total** | **~2,750** | **138** | **~$0.55** |

Haiku is essentially free for this workload.

---

## Stage 6: Load into `product_ingredients`

**Input:** Matched token-to-ingredient pairs from Stage 4
**Output:** `product_ingredients` junction table rows

### Deduplication: size variants

938 products share identical formulas (size variants of the same product — 5lb bag, 15lb bag, 30lb bag). Parse the formula ONCE, then clone the `product_ingredients` rows for all size variants sharing that formula.

Detection: group products by `ingredients_raw` hash. If multiple products share the same hash, parse once and fan out.

This reduces actual parsing work from 5,855 → ~4,917 unique formulas.

### Batch insert:

```sql
INSERT INTO product_ingredients (product_id, ingredient_id, position)
VALUES
  ($product_id_1, $ingredient_id_chicken_meal, 1),
  ($product_id_1, $ingredient_id_brown_rice, 2),
  ($product_id_1, $ingredient_id_peas, 3),
  ...
ON CONFLICT (product_id, position) DO NOTHING;
```

Batch size: 500 rows per INSERT (Supabase handles this comfortably).

### Estimated total rows: ~221,000

At 500 rows per batch = ~442 insert operations. With Supabase free tier rate limits, this takes ~15 minutes.

---

## Stage 0 (Pre-Pipeline): Seed `ingredients_dict`

Before running the pipeline, pre-populate `ingredients_dict` with known ingredients:

### Seed sources:

**Source A — Tiers 1, 1.5, and 2 content (119 ingredients, ALREADY IN SUPABASE)**
Seeded during M1/M2 builds via SQL. Includes severity ratings, clinical justifications,
D-105 display content (display_name, tldr, detail_body, citations), cluster_id assignments
for key splitting groups, and allergen_group mappings. All have `review_status: 'verified'`.
Do NOT re-import or overwrite these — the import pipeline must INSERT only, never UPSERT
existing entries.

**Source B — Frequency analysis remaining top 500 (NEW WORK)**
The top 500 ingredients by frequency minus the ~119 already seeded = ~381 new entries needed.
These need:
- `canonical_name` (from normalization)
- `dog_base_severity` / `cat_base_severity` (from Claude Haiku batch classification)
- `position_reduction_eligible` (from Claude Haiku)
- `is_unnamed_species`, `is_legume`, `cat_carb_flag` (from Claude Haiku)
- `cluster_id` (manual assignment for splitting detection — corn, pea, rice, potato clusters)
- `allergen_group` (manual assignment for D-098 cross-reactivity)
- `review_status: 'llm_generated'`

This is one Claude Haiku batch call (~19 API calls for ~381 ingredients at 20/batch) plus manual work on cluster_id and allergen_group for the ~50 ingredients where splitting/allergen matters.

**Source C — Synonym table (NEW WORK)**
~300-400 synonym mappings. This is a CSV/JSON file, not a database table:

```json
{
  "chicken by-product meal": "chicken_byproduct_meal",
  "fd&c red #40": "red_40",
  "dl-methionine": "methionine",
  ...
}
```

Built iteratively: run pipeline on 100 products, collect unmatched, add synonyms, repeat until match rate > 95%.

---

## Execution Order (Maps to M3 Prompt Guide)

```
Pre-Session 1:
├── Verify 119 seeded ingredients already in Supabase (Tiers 1/1.5/2)
├── Do NOT re-import — pipeline inserts only new ingredients

M3 Session 1 (~2 hrs):
├── Build import_products.py: JSON → Supabase products table (8,868 records)
├── Build parse_ingredients.py: Stages 1-6 (clean → tokenize → normalize → match → expand → load)
├── Build ingredient_matcher.py: exact + fuzzy matching (reused by Session 4 OCR flow)
├── Seed remaining ~381 ingredients via Haiku batch (Source B)
├── Build synonym table v1 (top 100 synonyms)
├── Run full pipeline on all products, iterate synonyms until match rate > 95%
├── Load ~221K product_ingredients rows into Supabase
├── Steven reviews new_ingredients.json: assign cluster_id for splitting groups

M3 Session 2 (~1.5 hrs):
├── LLM Nutritional Refinery (separate pipeline — scripts/refinery/extract_ga.py)
├── Haiku GA extraction for ~514 products missing GA values

M3 Session 3 (~1.5 hrs):
├── Formula change detection (hash normalization, diff engine)
├── Re-scrape handling for contaminated products

M3 Session 6 (integration):
├── Validate loaded data — spot-check 20 products across categories
├── Verify scoring engine reads product_ingredients correctly
├── Regression test: Pure Balance = 69
```

---

## Where This Code Lives

```
scripts/
├── import/
│   ├── import_products.py      ← M3 Session 1: JSON → Supabase products table
│   ├── parse_ingredients.py    ← Stages 1-4, 6: clean → tokenize → normalize → match → load
│   ├── ingredient_matcher.py   ← Stage 4: exact + fuzzy + Haiku matching (reused by OCR flow)
│   ├── config.py               ← Shared: env vars, Supabase client setup
│   ├── validators.py           ← Record validation functions
│   ├── synonyms.json           ← Canonical name mappings (~300-400 entries)
│   ├── SESSION1_CONTEXT.md     ← Dataset analysis, field mapping, import rules
│   └── README.md
├── refinery/
│   ├── extract_ga.py           ← M3 Session 2: Haiku GA extraction (separate pipeline)
│   └── validator.py
└── pipeline/
    ├── detect_changes.py       ← M3 Session 3: formula change detection
    └── hash_utils.py           ← Shared normalization + hashing (used by import + detect)
```

**Important:** This pipeline runs as a one-time batch job locally via Python, NOT inside the mobile app. It populates the database. The app only reads from the populated tables. Uses `supabase-py` with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS — this is a data pipeline, not user code).

For the database miss flow (M3 Session 4, D-091), Stages 2-4 run in a lightweight on-demand version via the `parse-ingredients` Supabase Edge Function: tokenize the OCR'd ingredient list, match against the already-populated dictionary, and score immediately. No Stage 5 expansion needed in real-time — unknown ingredients get `severity: neutral` as a safe default. The Edge Function also classifies the product's category (daily_food/treat/supplement/grooming) and target species (dog/cat/all) per D-128 — Haiku has the product name + OCR text and returns classification alongside parsed ingredients. Supplement and grooming products are stored but not scored (D-096, D-083).

---

## Quality Gates

**Gate 1: Match rate > 95%**
After Stage 4, at least 95% of ingredient-position rows must match to an `ingredients_dict` entry (exact or fuzzy). If below 95%, expand synonym table and re-run before proceeding.

**Gate 2: Zero products with 0 matched ingredients**
Every product with `ingredient_status: 'clean'` must have at least 3 matched ingredients. If any product has 0, it's a parser bug.

**Gate 3: Position ordering preserved**
For every product, `position` values in `product_ingredients` must be monotonically increasing (1, 2, 3, ...). No gaps, no duplicates at the same position (sub_positions allowed for vitamin packs).

**Gate 4: Splitting detection smoke test**
Products known to split (e.g., Royal Canin Kitten with corn + corn gluten meal) must have both ingredients linked to the same `cluster_id`. Run against 10 known splitting products.

**Gate 5: Severity sanity check**
No `ingredients_dict` entry should have `danger` for dogs but `beneficial` for cats (or vice versa) without a documented species-specific reason. Flag and review any such entries from Haiku.

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Haiku misclassifies a danger ingredient as neutral | Product scored too high, safety issue | Human review gate on all Haiku-generated entries. Batch 1 (high-frequency) reviewed before launch. |
| Truncated ingredient lists miss critical ingredients (e.g., BHA at position 25) | Score misses a real concern | Truncated products get `score_confidence: 'partial'` badge. Users see "Some ingredients may not be shown." |
| Synonym table misses a common variant | 5% of positions unmatched, scoring gaps | Iterative expansion: run pipeline, collect unmatched, add synonyms, re-run. Target 3 iterations. |
| Parenthetical parser fails on novel nesting patterns | Ingredients merged or split incorrectly | Test against 50 diverse products before full run. Dump position counts — any product with <5 or >80 ingredients is suspect. |
| Supabase free tier rate limits on 221K inserts | Load takes hours instead of minutes | Batch inserts (500 rows/batch). If needed, use Supabase CLI bulk import instead of API. |

---

## Post-Pipeline: What It Enables

Once `product_ingredients` is populated:

1. **Scoring engine goes live.** Layer 1 reads `product_ingredients` + `ingredients_dict` for position-weighted severity scoring.
2. **Ingredient splitting detection works.** `GROUP BY cluster_id HAVING count >= 2` runs against real data.
3. **DCM advisory fires.** Count legumes in top 7 positions for dog food.
4. **Feline carb overload fires.** Count high-glycemic carbs in top 5 for cat food.
5. **Allergen cross-reference works.** Match pet's allergens against `allergen_group` on product ingredients.
6. **D-105 ingredient modals work.** Tap any ingredient → pull `display_name`, `tldr`, `detail_body`, `citations` from `ingredients_dict`.
7. **Concern tags render.** Scan product ingredients for artificial color, synthetic preservative, unnamed source → generate D-107 tags.

Without this pipeline, the app is an empty scanner that can't score anything. This is M3's critical path.
