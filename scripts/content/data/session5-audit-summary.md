# M4 Session 5 — Ingredient Dictionary Audit Summary

Date: 2026-03-08

## Phase 1: Full DB Export

Exported all 6,037 ingredients with occurrence counts to `full_ingredient_audit.csv`.
Identified 2,418 parsing artifacts and 648 uncovered ingredients (NULL tldr, 5+ occurrences).

## Phase 3: Artifact Cleanup

Removed 2,418 parsing artifacts from `ingredients_dict`:

| Action | Ingredients | PI Rows Affected |
|--------|-------------|-----------------|
| Delete only (0 occurrences) | 887 | 0 |
| Remap + delete (target found) | 1,235 | 1,607 remapped |
| Orphan delete (no target) | 296 | 495 deleted |
| **Total** | **2,418** | **2,102** |

Artifact categories: colon separators (recipe sub-headers parsed as ingredients),
sentence boundaries (disclaimers fused with last ingredient), lot numbers,
fused words (e.g., `potas.sium_sorbate`), overly long strings (marketing text, GA data).

Post-cleanup: 3,619 clean ingredients remain. Zero artifacts.

## Phase 2: Severity + Flag Audit (Rules 1-12)

Applied 611 changes across 451 ingredient rows:

| Rule | Changes | Description |
|------|---------|-------------|
| R1 colorant | 82 | FD&C dyes, iron oxide, caramel color → caution |
| R2 unnamed meat | 24 | poultry_by_products, fish_meal, animal_digest → caution |
| R3 named protein | 12 | cod, tuna, mackerel, sardine, egg variants → good |
| R5 legume flag | 7 | chickpea, pea_fiber, pea_starch, etc. → is_legume=true |
| R8 sugar | 4 | cane_molasses, cane_sugar → caution |
| R9 unnamed oil | 2 | vegetable_oil → caution |
| R10 inheritance | 145 | soy(38), sugar(30), salt(17), corn(16), garlic(8), wheat(8), etc. |
| R11a-c unnamed | 22 | liver, fish_oil, natural_flavors → caution |
| R12a position flags | 319 | 316 FALSE→TRUE (named proteins/grains/fibers), 3 corrections |
| R12b curated override | — | 187 curated entries verified against tier files |

Severity changes: 285 ingredients. Position flag changes: 319 ingredients. is_legume: 7 ingredients.

## Phase 4: Review Exports

- `severity_changes_log.csv` — 144 ingredients with severity changes (audit trail)
- `needs_severity_review.csv` — 729 neutral/neutral ingredients with 5+ occurrences for manual review
- `needs_position_review.csv` — 0 ingredients (all resolved by rules)

## Phase 5: Re-score and Compare

Re-ran `batch_score.ts` on 4,620 products.

| Metric | Value |
|--------|-------|
| Products unchanged | 2,721 (59%) |
| Products changed | 1,899 (41%) |
| Average score change | -7.0 |
| Score drops | 1,751 |
| Score gains | 148 |
| Range | -59 to +25 |

### Category Average Deltas

| Segment | Old | New | Delta |
|---------|-----|-----|-------|
| daily_food dog GI | 72.7 | 70.7 | -2.0 |
| daily_food dog GF | 74.9 | 74.0 | -0.9 |
| daily_food cat GI | 63.4 | 60.2 | -3.2 |
| daily_food cat GF | 73.9 | 73.0 | -0.9 |
| treat dog GI | 79.4 | 72.2 | -7.2 |
| treat dog GF | 86.4 | 82.0 | -4.4 |
| treat cat GI | 69.2 | 65.2 | -4.0 |
| treat cat GF | 71.6 | 71.4 | -0.2 |

Treats took the biggest hits — expected since treats are 100% ingredient quality
weighted and many contain artificial colorants, sugars, and unnamed sources that
were previously scored as neutral.

### Regression

- Pure Balance Grain-Free Salmon & Pea (Dog): **69** (unchanged)
- Tests: **473 passing** (PetHubScreen mock fixed for react-native-view-shot)

## Known Follow-ups

- `needs_severity_review.csv`: 729 ingredients for Steven/Sonnet batch review
- fish_oil severity: currently caution (Rule 11a unnamed organ/fat), but named
  fish oils (salmon_oil, menhaden_fish_oil) are correctly neutral
- Uncovered ingredients: 648 with NULL tldr appearing in products (vitamins are top gap)
- Pre-existing: PetHubScreen test mock was missing react-native-view-shot — fixed this session
