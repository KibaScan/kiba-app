# M4 Session 3 — AafcoProgressBars, BonusNutrientGrid

## Commit
`c8d0331` — M4: Session 3 — AafcoProgressBars, BonusNutrientGrid

## Files Created

| File | Purpose |
|------|---------|
| `src/components/AafcoProgressBars.tsx` | Visual GA vs AAFCO threshold progress bars |
| `src/components/BonusNutrientGrid.tsx` | 2-column grid of 8 supplemental nutrient indicators |
| `src/utils/bonusNutrients.ts` | `deriveBonusNutrientFlags()` — ingredient-list scan for L-Carnitine, zinc, probiotics, glucosamine |

## Files Modified

| File | Changes |
|------|---------|
| `src/screens/ResultScreen.tsx` | Integrated AafcoProgressBars (after GATable) and BonusNutrientGrid (after AafcoProgressBars) |

## Component: AafcoProgressBars

**Props:**
```typescript
interface AafcoProgressBarsProps {
  gaValues: { protein_pct, fat_pct, fiber_pct, moisture_pct };
  dmbValues?: { protein_pct, fat_pct, fiber_pct };
  species: 'dog' | 'cat';
  lifeStage: LifeStage | null;
  category: 'daily_food' | 'treat';
  petName: string;
  nutritionalDataSource?: 'manual' | 'llm_extracted' | null;
}
```

**Key behaviors:**
- Returns null for treats (no nutritional scoring) and when all GA values are null
- AAFCO thresholds by species and life stage (from `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` §2a/§2b):
  - Dog adult: protein ≥18%, fat ≥5.5%, fiber ≤5%
  - Dog growth: protein ≥22.5%, fat ≥8.5%, fiber ≤5%
  - Cat adult: protein ≥26%, fat ≥9%, fiber ≤5%
  - Cat growth: protein ≥30%, fat ≥9%, fiber ≤5%
- DMB toggle for wet food (moisture >12%) — shows both as-fed and DMB values
- Color-coded bars: green (meets threshold), amber (close), red (fails)
- LLM disclaimer when `nutritionalDataSource === 'llm_extracted'`
- D-094: section header includes pet name
- Import fix: uses `import type { LifeStage } from '../types/pet'` (not `../types` which exports an enum)

## Component: BonusNutrientGrid

**Props:**
```typescript
interface BonusNutrientGridProps {
  nutrients: {
    dha_pct: number | null;
    omega3_pct: number | null;
    omega6_pct: number | null;
    taurine_pct: number | null;
    lcarnitine: boolean;
    zinc: boolean;
    probiotics: boolean;
    glucosamine: boolean;
  };
  species: 'dog' | 'cat';
  petName: string;
}
```

**Key behaviors:**
- 8 nutrient cards in 2-column flex-wrap layout
- Green dot for present, gray dot for absent
- GA-sourced: DHA, Omega-3, Omega-6, Taurine (from product GA values)
- Ingredient-derived: L-Carnitine, Zinc, Probiotics, Glucosamine (via `deriveBonusNutrientFlags()`)
- Species-specific notes:
  - Taurine + cats: "Essential for cats"
  - L-Carnitine + dogs: "Associated with heart health in veterinary research"

## Utility: deriveBonusNutrientFlags

```typescript
function deriveBonusNutrientFlags(ingredients: ProductIngredient[]): BonusNutrientFlags
```

- **L-Carnitine:** exact match for `l-carnitine` or `carnitine`
- **Zinc:** prefix match for `zinc` (covers zinc proteinate, zinc sulfate, etc.)
- **Probiotics:** substring match for lactobacillus, bifidobacterium, enterococcus, bacillus, probiotic
- **Glucosamine:** exact match for `glucosamine`, `glucosamine hydrochloride`, `glucosamine sulfate`

## ResultScreen Integration

Below-fold order after Session 3:
1. ScoreWaterfall → PortionCard/TreatBattery → GATable → **AafcoProgressBars** → **BonusNutrientGrid** → IngredientList

## Tests
- **465 tests passing** (no new test files this session — components are read-only UI)
- All pre-existing scoring tests unaffected

## Session 4 Pickup
- Ingredient Experience Cards: PositionMap, SplittingDetectionCard, FlavorDeceptionCard
- DCM Advisory Card, Formula Change Timeline
- D-133 flavor deception detection (3-layer treatment)
