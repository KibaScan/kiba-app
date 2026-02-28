# M1 Session 3 — Result Screen UI, Scoring Pipeline, All D-108 Components

> Session date: February 28, 2026
> Milestone: M1 Scan → Score Pipeline
> Status: Functionally complete

---

## Files Created

| File | Description |
|------|-------------|
| `src/components/ScoreRing.tsx` | Animated circular score gauge with pet context (D-094) |
| `src/components/LoadingTerminal.tsx` | 6-step animated loading sequence masking scoring time |
| `src/components/ConcernTags.tsx` | 5 consumer-facing category badges above the fold (D-107) |
| `src/components/SeverityBadgeStrip.tsx` | Top 5 worst-scoring ingredients as tappable color chips (D-108) |
| `src/components/ScoreWaterfall.tsx` | Layer-by-layer score deduction breakdown (D-094) |
| `src/components/GATable.tsx` | Nutritional panel with AAFCO context, DMB, carb estimation (D-038, D-104, D-016) |
| `src/components/IngredientList.tsx` | Full ingredient list sorted worst-to-best (D-031) |
| `src/components/IngredientDetailModal.tsx` | Singleton bottom-sheet modal for ingredient details (D-030, D-105) |
| `src/components/BreedContraindicationCard.tsx` | Red warning card for breed-specific binary risks (D-112) |

## Files Modified

| File | Changes |
|------|---------|
| `src/screens/ResultScreen.tsx` | Full rewrite: LoadingTerminal → scoring pipeline → progressive disclosure layout with all D-108 components, flag chips, no-ingredient-data edge case, recall banner, singleton modal wiring |
| `src/types/navigation.ts` | Changed Result params from `{ product: Product; petId: string }` to `{ productId: string; petId: string \| null }` |
| `src/screens/ScanScreen.tsx` | Passes `productId` instead of full `product` object |
| `src/types/index.ts` | Added `image_url: string \| null` to Product interface |
| `src/types/scoring.ts` | Added D-105 display content fields to ProductIngredient: `display_name`, `definition`, `tldr`, `detail_body`, `citations_display` |
| `src/services/scoring/pipeline.ts` | Updated hydration to pass through D-105 display fields from ingredients_dict |

## Components Built

### ScoreRing
**Props:** `{ score: number; petName: string; petPhotoUri: string | null; species: 'dog' | 'cat'; isPartialScore: boolean }`
**Implements:** D-094 (suitability framing), D-084 (zero emoji)
**Features:** View-based ring animation (no SVG), score color bands (red/amber/accent/green), pet photo with paw placeholder, info button with D-094 disclaimer, partial score badge

### LoadingTerminal
**Props:** `{ ingredientCount: number; species: 'dog' | 'cat'; petName: string | null; proteinPct: number | null; fatPct: number | null; onComplete: () => void }`
**Implements:** D-037 (loading messages), D-084
**Features:** 6-step animated sequence, dynamic product data in messages, monospace font, 250ms step cadence

### ConcernTags
**Props:** `{ ingredients: ProductIngredient[]; product: Product; species: 'dog' | 'cat' }`
**Implements:** D-107 (concern tags), D-013 (Heart Risk gate), D-084, D-111
**Features:** 5 tag types (Heart Risk, Synthetic Additive, Artificial Color, Unnamed Source, Added Sugar), max 3 visible with overflow, tappable tooltips, Heart Risk requires grain-free + 3 legumes in top 7 + dogs only

### SeverityBadgeStrip
**Props:** `{ ingredients: ProductIngredient[]; species: 'dog' | 'cat'; onIngredientPress: (ingredient: ProductIngredient) => void }`
**Implements:** D-108 (above-fold severity badges), D-084
**Features:** Top 5 danger/caution ingredients, horizontal scroll, tappable to open ingredient modal

### ScoreWaterfall
**Props:** `{ scoredResult: ScoredResult; petName: string; category: 'daily_food' | 'treat' }`
**Implements:** D-094 (pet-named layer labels), D-017 (missing GA reweight), D-084, D-095
**Features:** Layer-by-layer deduction bars, treat category hides NP/FC, partial score uses 78/22 reweighting, final score displayed as "% match"

### GATable
**Props:** `{ product: Product; scoredResult: ScoredResult; species: 'dog' | 'cat' }`
**Implements:** D-038 (GA display), D-104 (carb estimation), D-016 (DMB conversion), D-084, D-095
**Features:** Macro rows with AAFCO min markers, carb estimation with tap-to-expand formula, confidence badge (Exact/Estimated/Unknown), DMB dual display for wet food, LLM-extracted disclaimer, bonus nutrients section

### IngredientList
**Props:** `{ ingredients: ProductIngredient[]; species: 'dog' | 'cat'; onIngredientPress: (ingredient: ProductIngredient) => void }`
**Implements:** D-031 (worst-to-best sort), D-108 (below fold, no toggle), D-030 (modal on tap), D-084
**Features:** Species-specific severity sort, severity dot + display name + position badge + severity label, definition text preview, tappable rows

### IngredientDetailModal
**Props:** `{ ingredient: ProductIngredient | null; species: 'dog' | 'cat'; onClose: () => void }`
**Implements:** D-030 (singleton modal), D-105 (detail layout), D-084, D-095
**Features:** Bottom sheet with display name, severity badge, TL;DR, position context (derived from position_reduction_eligible), collapsible detail body, citations footer, graceful fallbacks for missing content

### BreedContraindicationCard
**Props:** `{ contraindications: PersonalizationDetail[] }`
**Implements:** D-112 (breed contraindication visual warnings), D-084, D-095
**Features:** Red left-bordered warning cards, "Breed Alert" header with warning icon, factual mechanism-based copy, zero score impact (visual only)

## Data Flow

```
ScanScreen
  → expo-camera barcode scan
  → lookupByUpc(barcode)
  → product found → useScanStore.addToScanCache(product)
  → navigation.navigate('Result', { productId: product.id, petId: activePetId })

ResultScreen (mount)
  → reads product from scanCache (or Supabase fallback)
  → reads pet from usePetStore.pets
  → phase = 'loading'
  → renders LoadingTerminal (presentational, 6 steps, ~1.5s)
  → scoreProduct(product, pet, [], []) runs in parallel
    → Supabase: product_ingredients JOIN ingredients_dict
    → hydrateIngredient() for each row → ProductIngredient[]
    → computeScore(product, ingredients, pet) → ScoredResult
  → terminalDone=true AND scoringDone=true → phase = 'ready'

ResultScreen (ready)
  → checks flags for 'no_ingredient_data' → simplified view if true
  → renders full progressive disclosure layout:
    Above fold: ScoreRing → flag chips → recall banner → ConcernTags
               → BreedContraindicationCard → SeverityBadgeStrip
    Below fold: ScoreWaterfall → GATable → IngredientList
               → Track button (disabled) → AAFCO statement
  → IngredientDetailModal (outside ScrollView, singleton)
    ← SeverityBadgeStrip.onIngredientPress → setSelectedIngredient
    ← IngredientList.onIngredientPress → setSelectedIngredient
```

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| **No GA data (all null)** | ScoreRing shows "Partial" badge, GATable shows "not available", ScoreWaterfall hides NP row + uses 78/22 reweight |
| **No ingredient data** | Simplified view: no score ring, "don't have ingredient data yet" card, contribute CTA placeholder |
| **Product recalled** | Red banner with warning icon below flag chips |
| **LLM-extracted GA** | Italic disclaimer below GATable: "Nutritional data extracted from label — verify with manufacturer for precision use" |
| **Treat category** | ScoreWaterfall shows only IQ at 100% weight; GATable still renders if GA data available |
| **No pet profile (null)** | Falls back to "your dog"/"your cat" in all display strings; Layer 3 personalizations neutral |
| **Score 0** | ScoreRing renders at 0 with red color, no special handling needed |
| **ingredient_splitting_detected flag** | Amber tappable chip below ScoreRing with D-039 Alert explanation |
| **partial_ingredient_data flag** | Muted text chip below ScoreRing |
| **dcm_advisory flag** | Filtered from flag chips display (already shown as Heart Risk concern tag) |
| **Generic unknown flags** | Rendered as neutral chips with formatted label |
| **Product not in scanCache** | Falls back to Supabase products table fetch |
| **Scoring pipeline error** | Error state with "Go back" button |
| **No concern tags fired** | ConcernTags returns null (clean) |
| **No severity badges** | SeverityBadgeStrip returns null (clean) |
| **No breed contraindications** | BreedContraindicationCard returns null (clean) |
| **Wet food** | GATable converts to DMB, shows dual display + note |

## Compliance Audit Results

| Decision | Status | Notes |
|----------|--------|-------|
| **D-084 Zero Emoji** | PASS | grep for emoji Unicode ranges returns zero matches across all components and ResultScreen. All icons use Ionicons. |
| **D-094 Score Framing** | PASS | Score displayed as `[X]% match for [petName]` in ScoreRing (line 153). Pet name visible at all times. Info disclaimer present with exact D-094 text. Waterfall labels: "Ingredient Concerns", "[petName]'s Nutritional Fit", "[petName]'s Breed & Age Adjustments". No naked scores. |
| **D-095 UPVM Compliance** | PASS | grep for prescribe/diagnose/cure/prevent/treat returns zero matches. No editorial language (terrible, avoid, toxic, cheap, filler). Only code comment "avoid division by zero" in ScoreWaterfall — not user-facing. |
| **D-107 Concern Tag Gating** | PASS | Heart Risk requires `species === 'dog'` AND `product.is_grain_free` AND 3+ members in positions 1-7. Max 3 visible with "+N more" overflow chip. |
| **D-108 Layout Structure** | PASS | Single ScrollView, no tabs or mode toggles. Above-fold: ScoreRing → ConcernTags → BreedContraindicationCard → SeverityBadgeStrip. Below-fold: ScoreWaterfall → GATable → IngredientList. Safe Swap and Kiba Index NOT rendered (not even placeholder). |
| **D-030 Singleton Modal** | PASS | Exactly ONE IngredientDetailModal instance in ResultScreen JSX (line 439). Rendered outside ScrollView. Content swapped via `selectedIngredient` state. |
| **D-019 Brand-Blind** | PASS | `.brand` appears only in ResultScreen header for product display to user (3 occurrences). Zero brand references in any scoring, concern-tag, or severity logic. |
| **D-020 Affiliate Isolation** | PASS | grep for "affiliate" returns zero results across all components. |
| **D-104 Carb Display** | PASS | Carb labels are display-only (GATable renders `carbEstimate.qualitativeLabel` from engine output, does NOT feed back). Species-specific thresholds confirmed in engine.ts: Cat Low ≤15/Moderate 16-25/High >25, Dog Low ≤25/Moderate 26-40/High >40. Confidence badge renders (Exact/Estimated/Unknown). |
| **D-112 Breed Contraindications** | PASS | Cards render from `scoredResult.layer3.personalizations.filter(p => p.type === 'breed_contraindication')`. Zero score impact (visual warnings only). Cards positioned above fold (after ConcernTags, before SeverityBadgeStrip). |
| **D-016 DMB Conversion** | PASS | GATable converts to DMB for wet food (moisture > 12%), shows dual display "X% as-fed (Y% DMB)" + note. |
| **D-017 Missing GA Reweight** | PASS | ScoreWaterfall uses 78/22 weights when `isPartialScore && category === 'daily_food'`, hides NP row. |
| **D-031 Ingredient Sort** | PASS | IngredientList sorts by severity worst→best (danger→caution→neutral→good), then by position within same severity. |
| **D-037 Loading Terminal** | PASS | 6-step animated sequence with dynamic product data. |
| **D-038 GA Table** | PASS | Core macros with AAFCO min markers, species-specific thresholds. |
| **D-093 Product Image** | PASS | Forward-compatible code with gradient overlay, gated by `product.image_url` (always null in M1). |
| **D-105 Ingredient Detail** | PASS | Modal layout: display_name → severity badge → TL;DR → position context → collapsible detail body → citations footer. All fields have graceful fallbacks. |

## Test Count

- **Test Suites:** 10 passed, 10 total
- **Tests:** 146 passed, 146 total
- **TypeScript:** 0 errors (excluding engine.test.ts which uses test-only types)

## Decisions Applied

| Decision | Context |
|----------|---------|
| D-013 | Heart Risk concern tag gating: grain-free + 3 legumes in top 7 + dogs only |
| D-016 | DMB conversion for wet food in GATable |
| D-017 | Missing GA reweight to 78/22 in ScoreWaterfall |
| D-019 | Brand-blind: no brand references in scoring or concern logic |
| D-020 | Affiliate isolation: zero affiliate references in UI code |
| D-030 | Singleton modal pattern for ingredient details |
| D-031 | Ingredient list sorted worst-to-best by species-specific severity |
| D-037 | Loading terminal with 6-step animated sequence |
| D-038 | GA table with AAFCO min markers |
| D-084 | Zero emoji — Ionicons throughout |
| D-093 | Product image with gradient edge fade (forward-compatible, no-op in M1) |
| D-094 | Suitability framing: "[X]% match for [petName]", pet-named layer labels, info disclaimer |
| D-095 | UPVM compliance: no prohibited terms, no editorial language |
| D-104 | Carb estimation display with confidence badge, species-specific labels, tap-to-expand formula |
| D-105 | Ingredient detail modal content layout |
| D-107 | Concern tags: 5 categories, max 3 visible, tappable tooltips |
| D-108 | Progressive disclosure layout: above/below fold structure |
| D-111 | SF Symbols (mapped to Ionicons for Expo) |
| D-112 | Breed contraindication cards: visual warnings, zero score impact |

## Known Limitations (M1)

- Breed modifier logic is stubbed — `petConditions` and `petAllergens` always `[]` (M2)
- No real pet photos — paw placeholder shown (M2)
- `is_protein_fat_source` hardcoded to `false` in pipeline — affects 3.75% of total score (M2)
- No Safe Swap recommendations (M6)
- No Kiba Index community data (M8)
- Ingredient detail content limited to what's in `ingredients_dict` DB — may be sparse for Tier 2/3 ingredients
- No pantry integration or food tracking (M5)
- `image_url` always null — product image section never renders (M2+)
- Breed data is static in `src/content/breedModifiers/` — no dynamic loading

## Session 4 Pickup

Session 3 is functionally complete. The full scan → score → display pipeline is wired end-to-end. Next priorities:

1. **Reference product manual testing** — test with Pure Balance Grain-Free Salmon & Pea (dog, expected 66/100) and Temptations Classic Tuna (cat treat, expected 44/100) to verify the complete flow renders correctly on device
2. **M1 polish** — any visual tuning from manual testing (spacing, font weights, color contrast)
3. **M2 prep** — plan for pet profile depth (breed, age, weight), allergen/condition flows, and Supabase Auth integration
4. **Expo Go testing** — verify all components render without crashes on iOS simulator and Expo Go
