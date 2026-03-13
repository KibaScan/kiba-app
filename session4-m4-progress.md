# M4 Session 4 — Ingredient Experience Cards

## Commits
- `5386df7` — M4: Session 4 (partial) — PositionMap, SplittingDetection, FlavorDeception, ConcernTags update
- `5c0feb4` — M4: Session 4 — DcmAdvisoryCard, FormulaChangeTimeline (473 tests, Session 3-4 complete)

## Files Created

| File | Purpose |
|------|---------|
| `src/components/PositionMap.tsx` | Horizontal colored strip showing ingredient composition by position |
| `src/components/SplittingDetectionCard.tsx` | Amber education card for ingredient splitting (cluster_id-based) |
| `src/utils/flavorDeception.ts` | `detectFlavorDeception()` — compares product name protein vs actual primary |
| `src/components/FlavorDeceptionCard.tsx` | Education card for protein name vs ingredient list mismatch (D-133) |
| `__tests__/utils/flavorDeception.test.ts` | 8 tests for flavor deception detection |
| `src/components/DcmAdvisoryCard.tsx` | Heart health education card for DCM advisory (D-013, dog-only) |
| `src/components/FormulaChangeTimeline.tsx` | Expandable timeline of product reformulations (formula_change_log) |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ConcernTags.tsx` | Added "Label Mismatch" tag with `swap-horizontal-outline` icon (D-133 layer 1) |
| `src/components/IngredientList.tsx` | Added `flavorAnnotation` prop — italic annotation on primary protein row (D-133 layer 3) |
| `src/screens/ResultScreen.tsx` | Integrated all 6 new components, removed old splitting chip (Alert-based) |
| `src/types/index.ts` | Updated `formula_change_log` type from `Record<string, unknown>` to typed array |

## Component Details

### PositionMap
- Position-weighted widths: pos 1=15%, pos 2=12%, 3-5=10%, 6-10=5%, 11+=2% (normalized to 100%)
- Severity colors from D-113: good=#34C759, neutral=#8E8E93, caution=#FF9500, danger=#FF3B30
- Allergen override segments get orange border
- Tappable segments via `onSegmentPress` callback

### SplittingDetectionCard
- `buildSplittingClusters(ingredients)` exported utility — groups by `cluster_id` (HAVING count ≥ 2)
- Uses cluster_id only, never string matching (per CLAUDE.md rule)
- D-095 compliant copy: "may represent," "can make"
- Amber left border, `copy-outline` icon

### FlavorDeceptionCard (D-133 — 3 Layers)
**Layer 1 — ConcernTag:** "Label Mismatch" badge in ConcernTags (fires when deception detected)
**Layer 2 — Card:** Education card with two variants:
- `buried`: Named protein found at position 3+, different protein at position 1
- `absent`: Named protein not in ingredient list at all
**Layer 3 — IngredientList annotation:** Italic text on primary protein row: "Primary protein (product named as [namedProtein])"

**Detection logic (`detectFlavorDeception`):**
- 18 known protein keywords: chicken, turkey, beef, salmon, tuna, duck, lamb, venison, rabbit, bison, cod, whitefish, herring, mackerel, sardine, trout, pork, quail
- Scans product name for protein keyword match
- Finds named protein in ingredient list by position
- Returns false when: no keyword in name, named protein at pos 1-2, empty ingredients
- D-095 ceiling: "tells a different story" — never "misleading" or "deceptive"

### DcmAdvisoryCard
**Props:** `legumesFound`, `isGrainFree`, `hasTaurine`, `hasLCarnitine`, `dcmPenalty`, `petName`
**Trigger:** Dog-only, `is_grain_free === true`, 3+ legumes in positions 1-7 (from `scoredResult.layer2.appliedRules` DCM_ADVISORY fired)
- Red left border + `heart-outline` icon (high severity visual)
- Lists each legume found with position
- D-095: "potential association," "no causal link established"
- Green left-bordered mitigation subsection when taurine + L-carnitine both present
- Score impact line with pet name (D-094): "Score impact: −[X] points for [petName]"

### FormulaChangeTimeline
**Props:** `changes` (typed array from `formula_change_log`), `currentScore`
**Trigger:** `formula_change_log` is non-null and non-empty
- Collapsed by default: "Reformulated X times" — tap to expand
- Timeline dots + connector lines on left margin
- Entries sorted newest-first with formatted dates
- Neutral card (no colored border) — informational, not warning
- Returns null gracefully when no changes exist

## ResultScreen Below-Fold Order (Final)

1. ScoreWaterfall
2. PortionCard / TreatBatteryGauge
3. GATable
4. AafcoProgressBars
5. BonusNutrientGrid
6. PositionMap
7. SplittingDetectionCard
8. FlavorDeceptionCard (D-133)
9. DcmAdvisoryCard (D-013, dog-only)
10. FormulaChangeTimeline (D-044)
11. IngredientList (with flavor annotation)
12. Compare button
13. Track this food (M5 placeholder)
14. AAFCO statement

## D-Number Compliance

| Decision | Applied In |
|----------|-----------|
| D-013 | DcmAdvisoryCard — DCM advisory conditions, mitigation display |
| D-031 | IngredientList — full list sorted worst-to-best |
| D-044 | FormulaChangeTimeline — append-only formula_change_log |
| D-084 | All components — Ionicons only, zero emoji |
| D-094 | DcmAdvisoryCard — pet name in score impact line |
| D-095 | All cards — factual language, no editorial terms |
| D-107 | ConcernTags — Label Mismatch tag added |
| D-108 | All components below fold |
| D-132 | BenchmarkBar — excludes partial-score products |
| D-133 | FlavorDeceptionCard + ConcernTag + IngredientList annotation |

## Type Update

`formula_change_log` in `src/types/index.ts` updated from `Record<string, unknown> | null` to:
```typescript
Array<{
  detected_at: string;
  old_ingredients_preview: string;
  new_ingredients_preview: string;
}> | null
```

## Tests
- **473 total tests passing** (465 existing + 8 new flavorDeception tests)
- No scoring engine files modified
- Pure Balance regression: 69 (unchanged)

## Session 5 Pickup
- Share card (Kiba branding + kibascan.com CTA)
- Recall detail view (currently banner-only)
- Consider: ingredient search/filter within result screen
- All read-only UI — scoring engine remains LOCKED
