# CLAUDE.md — Kiba Project Context

> Read automatically by Claude Code. Single source of context for development.
> Last updated: March 17, 2026 — M4.5 Round 5 complete, 641 tests/32 suites. D-150 life stage Layer 3 restructure, D-151 nursing advisory. Ready for M5.

---

## Project Overview

Kiba (kibascan.com) — pet food scanner iOS app, "Yuka for pets." Scan barcode → ingredient-level safety score 0-100, species-specific for dogs and cats.

**Owner:** Steven (product decisions, non-coder) | **Developer:** Claude Code
**Current phase:** M5 Pantry + Recall Siren

## Tech Stack

Expo (React Native) + TypeScript strict | Zustand | Supabase (Postgres + Auth + Storage + RLS) | React Navigation | `expo-camera` (NOT `expo-barcode-scanner`) | RevenueCat | `expo-av` | Jest (641 tests) | `react-native-svg`

## Key Directories

- `DECISIONS.md` — 151 decisions (D-001–D-151), check before implementing
- `ROADMAP.md` — milestone plan, M5 is next
- `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` — 30% NP bucket: AAFCO thresholds, DMB, trapezoidal curves
- `BREED_MODIFIERS_DOGS.md` / `BREED_MODIFIERS_CATS.md` — breed data (23 dogs, 21 cats)
- `PET_PROFILE_SPEC.md` — profile fields, conditions, allergens
- `PORTION_CALCULATOR_SPEC.md` — RER/DER math, goal weight, cat safety guards
- `references/scoring-rules.md` — consolidated scoring rules
- `src/services/scoring/` — 3-layer engine (engine.ts orchestrator)
- `src/utils/constants.ts` — Colors, SCORING_WEIGHTS, SEVERITY_COLORS, getScoreColor()
- `src/utils/permissions.ts` — ONLY location for paywall checks
- `supabase/migrations/` — 001–009, full schema
- `__tests__/referenceProducts.test.ts` — regression tests

## Score Framing — Suitability Match (D-094)

All scores are pet-specific: `"[X]% match for [Pet Name]"` — NEVER naked scores. Products start at 100; deductions are compatibility adjustments. Pet name + photo always visible on result screen.

**Waterfall rows:** (1) "Ingredients" (2) "[Pet Name]'s Nutritional Fit" (3) "Formulation Quality" (4) "[Species] Safety Checks" (5) "[Pet Name]'s Breed & Age Adjustments"

**Score colors:** Two parallel scales in `getScoreColor()` — daily food uses green family, supplemental uses teal/cyan family, both converge at yellow/amber/red. Green NEVER on supplementals. Teal/cyan NEVER on daily food. 270° arc = supplemental, 360° = daily food + treats. Ring animates 900ms ease-out cubic on mount.

## Scoring Engine Architecture

**Specs:** Read `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`, `BREED_MODIFIERS_DOGS.md`, `BREED_MODIFIERS_CATS.md` before scoring changes.

### Category-Adaptive Weighting
| Category | IQ | NP | FC |
|----------|----|----|-----|
| Daily Food | 55% | 30% | 15% |
| Supplemental (`is_supplemental`) | 65% | 35% (macro-only) | 0% |
| Treats | 100% | 0% | 0% |

### Three Layers

**Layer 1 — Base Score:**
- **IQ (0-100):** Position-weighted severity. Check `position_reduction_eligible` before discounting. Proportion-based: full pos 1-5, −30% pos 6-10, −60% pos 11+. Presence-based (BHA, BHT, colorants): full penalty always. −2 per unnamed fat/protein.
- **NP (0-100):** GA vs AAFCO by life stage. Trapezoidal curves (see spec). Dog: 35/25/15/25 (P/F/Fi/C). Cat: 45/20/10/25. DMB required for wet food (moisture >12%). Supplementals: macros only.
- **FC (0-100):** AAFCO statement, preservative type, protein naming.

**Layer 2 — Species Rules:**
- Dog: DCM −8% via D-137 positional pulse load (3-rule OR: heavyweight pulse top 3, 2+ pulses top 10, pulse protein isolate top 10). No grain-free gate. +3% mitigation (taurine + L-carnitine).
- Cat: Carb overload −15% (3+ high-glycemic carbs top 5), mandatory taurine, UGT1A6 warnings.

**Layer 3 — Personalization:** Allergy cross-ref, **category-scaled life stage mismatch (D-150):** puppy/kitten+adult food −15/−10/−5 by category; adult+growth food −5 all categories; suppressed for pets under 4 weeks (D-151 nursing advisory). Breed modifiers (±10 cap). Static breed data in `src/content/breedModifiers/`. D-112 contraindications are red warning cards, NOT score modifiers. Neutral if no conflicts.

### Reference Scores (Regression)
- **Pure Balance Wild & Free Salmon & Pea (Dog):** 62 — IQ:58 NP:79 FC:63 → Base:65 → DCM ×0.92 → mitigation ×1.03 → 62
- **Temptations Classic Tuna (Cat Treat):** 44 — IQ:52 → cat carb −8 → 44

### Key Mechanics
- **Splitting detection:** `cluster_id` in `ingredients_dict`, GROUP BY HAVING count≥2. NEVER string matching.
- **Missing GA:** Reweight ~78% IQ / 22% FC. Show "Partial" badge.
- **Supplemental classification (D-136):** AAFCO feeding guide keywords + `isSupplementalByName()` product name keywords (D-146). Orthogonal to `haiku_suggested_category = 'supplement'` (D-096).

## Key Schema Gotchas

Full schema in `supabase/migrations/`. Watch for these naming issues:

- `pets` table (NOT `pet_profiles`): `weight_current_lbs` (NOT `weight_lbs`), `weight_goal_lbs`, `date_of_birth` (NOT `birth_date`), `is_neutered` (NOT `is_spayed_neutered`), `activity_level` ('low'|'moderate'|'high'|'working'), `sex` ('male'|'female'|null), `life_stage` (derived, never user-entered), `health_reviewed_at` (distinguishes "Perfectly Healthy" from "never visited")
- `product_upcs` — junction table (UPC → product_id), NOT TEXT[] array
- `ingredients_dict` — `is_pulse` + `is_pulse_protein` for DCM (NOT `is_legume`), `position_reduction_eligible`, `cluster_id` for splitting
- `products` — `is_supplemental`, `is_vet_diet`, `affiliate_links` JSONB (invisible to scoring)

**Auth:** Anonymous sign-in via `ensureAuth()` on app mount. Storage bucket `pet-photos` (public), path: `{userId}/{petId}.jpg`.

## Non-Negotiable Rules

1. **Scoring engine is brand-blind.** No brand-specific modifiers.
2. **Affiliate logic isolated from scoring.** `affiliate_links` invisible to scoring.
3. **Paywall checks ONLY in `permissions.ts`.** No scattered `if (isPremium)`.
4. **Dogs and cats only.** Refuse unsupported species.
5. **Clinical Copy Rule.** Objective, citation-backed, never editorial.
6. **Every penalty has `citation_source`.** No unattributed claims.
7. **Supabase RLS on every user-data table.**
8. **No `any` types** in TypeScript core entities.
9. **Frequency advisories are NOT score modifiers.**
10. **Suitability framing (D-094).** Always "[X]% match for [Pet Name]."
11. **UPVM compliance (D-095).** Never: "prescribe," "treat," "cure," "prevent," "diagnose."
12. **Breed modifier cap ±10** with citations + `vet_audit_status = 'cleared'`.
13. **Vet diet bypass (D-135).** `is_vet_diet = true` → NEVER scored, show ingredients only.
14. **Species mismatch bypass (D-144).** product.target_species ≠ pet.species → no scoring.
15. **Variety pack bypass (D-145).** Name keywords / >80 ingredients / 4+ duplicate canonicals → no scoring, no ingredient list.
16. **Supplemental expansion (D-146).** Name detection + AAFCO feeding guide. BenchmarkBar hidden.
17. **API keys server-side only (D-127).** All external calls via Edge Functions.
18. **Recall alerts free (D-125).** No paywall gate.

## What NOT to Build

- Ask AI / chatbot (liability — permanently removed)
- Score supplements (M16+, D-096 — store only). `haiku_suggested_category='supplement'` ≠ `is_supplemental` (D-136)
- Score grooming/cosmetics (M16+), score vet diets (D-135 bypass)
- `expo-barcode-scanner` (deprecated), star ratings (→ Kiba Index M8+)
- "Dislikes/Won't Eat" system, breed avatar silhouettes
- Compare flow (deferred M6), Vet Report PDF (deferred M5-M6)
- Score variety packs (D-145 — bypass, scan individual items)

## Commit Convention

```
M5: pantry assignment with multi-pet sharing
M5: recall RSS feed monitoring
```

## Known Issues

- **Zustand `import.meta` on Expo Web:** `sed -i 's/import\.meta\.env/process.env/g' node_modules/zustand/esm/middleware.mjs` — use `patch-package` for persistence.
- **Haptics:** `expo-haptics` no-op on web. Test on physical iOS device.
- **Copper sulfate:** Remains species-split (dog=caution, cat=neutral) — awaiting Steven's decision.

## Self-Check (Before Every Deliverable)

□ Scoring deterministic + testable? All 3 layers independent?
□ `position_reduction_eligible` checked? DMB for wet food?
□ `cluster_id` for splitting (not string matching)?
□ Score = "[X]% match for [Pet Name]" — never naked?
□ No UPVM terms in UI copy?
□ Paywall only in permissions.ts? RLS on user tables?
□ Breed modifiers ±10 cap with citations?
□ Pure Balance regression = 62 after scoring changes?
□ DCM uses `is_pulse`/`is_pulse_protein` (not `is_legume`)? No grain-free gate?
□ Supplementals: 65/35/0 weights, macro-only NP, correct color scale?
□ Vet diet / species mismatch / variety pack bypasses intact?
□ All severity colors from SEVERITY_COLORS constant?
□ API keys server-side only? Affiliate isolated from scoring?
□ Aligns with DECISIONS.md? In scope for current milestone?

## When Unsure

1. Check DECISIONS.md — follow if answered there
2. Check ROADMAP.md — flag if out of scope
3. Scoring math → `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`
4. Breed logic → `BREED_MODIFIERS_DOGS.md` / `BREED_MODIFIERS_CATS.md`
5. If ambiguous, ask ONE focused question
6. If contradicts locked decision, flag explicitly
