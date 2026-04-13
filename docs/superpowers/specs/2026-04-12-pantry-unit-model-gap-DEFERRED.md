# Pantry Unit Model Gap — Mixed Dry + Wet Custom Splits (DEFERRED)

**Date surfaced:** 2026-04-12 (during on-device QA of PR #4)
**Status:** DEFERRED — not in scope for PR #4 / M9 polish. Captured for future work.
**Relationship to current work:** PR #4 landed UI polish + role-aware rendering + decimal formatting + the honest Auto-Deplete hide. It did **not** touch the kcal → serving_size back-calc path, the wet reserve engine, or the unit-label routing logic. Those are the surface this deferred issue lives on.

## Observation (what was seen on-device)

Two related symptoms during Custom Splits use on a mixed dry + wet pet (Buster):

### Symptom 1 — "Logging dry food is by lbs" despite an expected cup-forced display

The owner expected a forced cup conversion for serving display on dry food. On-device, a dry-food interaction surfaced `lbs` where `cups` was expected. **Exact screen + field unclear — needs reproduction detail.** Candidates to check:

- PantryCard `feedingSummary` — already handles `serving_size_unit === 'units'` → `'cups'` fallback at `src/components/pantry/PantryCard.tsx:131-134`. Should render cups for dry with `ga_kcal_per_cup`. If it renders lbs, a data path is incorrectly writing `lbs` into `serving_size_unit` (schema only allows `'cups' | 'scoops' | 'units'` — lbs shouldn't be possible unless another code path bypasses the CHECK constraint).
- EditPantryItem Quantity card — inventory unit display (`lbs`) is correct for bag weight. Not a bug, but could be confusing if user expects a separate "how much per feeding" display somewhere and sees only the bag unit.
- A "Log a feeding" flow — if one exists for dry foods and expresses per-feeding in lbs, that's the likely culprit.
- The Fed This Today bottom sheet — reads `serving_size` + `serving_size_unit`. If assignment was saved with a weight-based unit, it'd render that.

**Action item for follow-up:** reproduce on-device with a specific screen screenshot + the `pantry_pet_assignments` row state (dump `serving_size_unit`, `serving_size`, `feeding_role`) for the affected item.

### Symptom 2 — Wet food as BASE in Custom Splits shows 0 servings

Concrete case reported: Buster allocated **1251 kcal** to a wet food as a BASE item in Custom Splits. Post-save, the item shows **0 servings**. When the same wet food is toggled to ROTATIONAL, the "Fed This Today" flow shows **~374 kcal per serving** (half that at 0.5 serving). The owner does not recall where 374 came from.

This is the primary architectural gap.

## Root cause analysis

### Why base wet food shows 0 servings

The kcal → serving_size back-calc in `updateCalorieShares` (`src/services/pantryService.ts:~600-640`) delegates to `computeAutoServingSize(target_kcal, feedings_per_day, product)`.

- For DRY: computes `target_kcal / (ga_kcal_per_cup × feedings_per_day)` → cups. Works.
- For WET with **no** `ga_kcal_per_cup`: `computeAutoServingSize` returns `null`.
- Session 45 fallback (`src/services/pantryService.ts:548-549` comment): "Fallback when target_kcal is absent OR computeAutoServingSize returns null … proportionally scale the existing serving."
- If this is the item's **first** custom-split assignment (no prior `serving_size`), proportional scaling has nothing to scale from.
- Net: `serving_size` stays at 0 (or its original null/zero value). Display renders "0 servings".

So a wet base in custom silently swallows the allocated kcal without back-calculating pouches/cups. The kcal share is persisted; the user-visible serving count is wrong.

### Where 374 kcal/serving came from (rotational path)

When the wet food is toggled to rotational, `refreshWetReserve` (`src/services/pantryService.ts:863-950`) runs. It computes `wet_reserve_kcal` — a **blended average kcal per configured serving** across all rotational wet items:

- For each rotational assignment, calls `computePerServingKcal(product, serving_size, serving_size_unit)` to get kcal-per-serving based on the item's configured serving.
- If that returns null, falls back to raw per-unit kcal capped at 500 (`MAX_SERVING_KCAL` at `:895`; EC-2 guard against bulk bags).
- Weighted by remaining inventory when stocked; unweighted average when all depleted.

So `374 kcal/serving` is almost certainly the pet's current `wet_reserve_kcal` value — the blended-average per-serving kcal of Buster's rotational wet items. `0.5 serving` × 374 = 187 kcal, consistent with reported behavior.

The source of the average (which wet product actually defines the 374) is stored in `wet_reserve_source` (`blended` when multiple, a specific source key when single). Not surfaced to the UI today.

## The architectural gap

Two code paths handle wet kcal, with different rules:

1. **Base custom split:** `target_kcal → ga_kcal_per_cup back-calc → serving_size`. Designed for dry. Silently returns 0 for wet.
2. **Rotational wet:** `serving_size (pouch count or cups) + serving_size_unit → per-serving kcal via wet reserve engine`. Works for wet by design.

**Why it matters:**
- Users feeding mixed dry + wet where wet is a non-rotational BASE (e.g., "one can of wet at breakfast, kibble throughout the day") cannot represent that meaningfully in Custom Splits. The kcal share is recorded, but the `serving_size` that the pantry depletion math and the PantryCard display rely on is 0.
- The system implicitly forces "wet must be rotational to work correctly." That conflicts with Custom Splits' promise of "allocate calories however you want."
- The "374 kcal/serving" number for rotational is opaque to the user — they see a result without understanding the math or its stability (it drifts as rotational items are added/removed).

## Open questions

Before designing a fix, these need answering:

1. **Product intent:** should wet food be a first-class BASE option in Custom Splits? Or is the behavioral model ("dry anchors; wet rotates") intentional and users should never set wet as base?
2. **Unit model for wet base:** if wet base is supported, what's the correct display unit? Pouches / cans / grams / cups-equivalent? Does `serving_size_unit` need an extension beyond the current `'cups' | 'scoops' | 'units'`?
3. **Back-calc for wet base:** what's the right math when `ga_kcal_per_cup` is null?
   - Use `kcal_per_unit` (per-pouch) if present → `target_kcal / (kcal_per_unit × feedings_per_day)` → serving_size in units/pouches
   - Use `ga_kcal_per_kg × unit_weight_g` fallback if only per-kg data exists
   - Refuse to back-calc and show a clear "this product needs a per-feeding size" input instead
4. **Mixing dry + wet as base:** if both are allowed as base with different units, how does the Custom Splits total kcal bar aggregate them? Already does; but does it surface the unit heterogeneity (e.g., "3.5 cups kibble + 2 pouches wet = 1251 kcal")?
5. **Reserve transparency for rotational:** should `wet_reserve_kcal` and its source be visible somewhere in the UI so users understand where the per-serving kcal number comes from? Today it's a black box.
6. **Symptom 1 (lbs display):** is this a data bug (bad `serving_size_unit` stored somewhere), a UI routing bug (wrong column surfaced in a feed-log flow), or a copy issue (inventory lbs shown where serving cups was expected)? Needs on-device repro to classify.

## Proposed directions (non-prescriptive — pick after the questions above are resolved)

**Direction A — wet base uses `kcal_per_unit` back-calc.** Extend `computeAutoServingSize` to fall through to `kcal_per_unit` when `ga_kcal_per_cup` is null. Require products in that path to have `kcal_per_unit` populated (backfill from `ga_kcal_per_kg × unit_weight_g` if only per-kg data). `serving_size_unit` = `'units'` for that assignment. PantryCard display logic already handles `'units'` with unit_label.

**Direction B — refuse wet as base (enforce rotational-only for wet).** Guard `updateCalorieShares` and the Custom Splits screen role toggle: if `product_form === 'wet'` → disable Base chip + add tooltip "Wet foods track via rotation — toggle to Rotational". Simpler but restrictive; closes the door on mixed feeding patterns users actually have.

**Direction C — explicit per-feeding-size input for wet base.** Instead of kcal → serving back-calc, Custom Splits for wet BASE items shows "how much per feeding?" input (pouches or grams), then computes kcal from that. Inverts the control flow. More work but more honest for data-sparse products.

**Direction D — status quo with honest UI.** Keep the current behavior but make the 0-serving visible: show "Needs per-serving size — tap to set" inline on PantryCard or EditPantryItem when a base assignment has serving_size = 0 but target_kcal > 0. Caps the blast radius without re-architecting.

**Direction E — surface reserve math.** Regardless of A/B/C/D: add a "Learn more" disclosure on the rotational "Fed This Today" sheet that shows current `wet_reserve_kcal`, source, and "this averages across [n] wet foods in rotation." One-time education to demystify the 374 number.

My lean: **D + A + E** shipped sequentially. D closes the immediate data-integrity gap quickly. A enables wet-as-base properly after validation. E is orthogonal UX polish that pairs with either.

## Related files

- `src/services/pantryService.ts` — `updateCalorieShares` (`:~580-640`), `refreshWetReserve` (`:863-950`)
- `src/utils/pantryHelpers.ts` — `computeAutoServingSize`, weight conversion helpers
- `src/services/calorieEstimation.ts` — `resolveCalories` fallback chain
- `src/screens/CustomFeedingStyleScreen.tsx` — Custom Splits UI, role toggle, kcal inputs
- `src/components/pantry/PantryCard.tsx:131-134` — feedingSummary unit routing (prime suspect for Symptom 1)
- `src/components/pantry/AddToPantrySheet.tsx` — where initial `serving_size_unit` is written on add
- `supabase/functions/auto-deplete/index.ts` — consumes `serving_size` for cron deduction; any back-calc miss propagates here

## Related DECISIONS

- D-152 — weight-based vs unit-based serving modes
- D-164 — unit label simplification (cans/pouches/units → `'servings'`)
- D-165 — budget-aware serving recommendations
- D-167 — condition-aware feeding frequency
- Behavioral Feeding architecture (migration 034) — feeding_style + feeding_role, Wet Reserve Engine

## Traceback to this session

- PR #4 (`m9-pantry-polish`) — pantry polish. Did not touch this area.
- Session 45 commit `cc00f67` — `updateCalorieShares` was rewritten with proportional-scaling fallback; that's the layer where the wet-null-kcal case silently no-ops.
- CURRENT.md session 45 "Gotchas" notes: "Proportional-scaling fallback path only warns when `target_kcal` was explicitly set but both paths failed." — that covers the warn path but does NOT cover the first-assignment-no-prior-serving case, which is what Symptom 2 hits.

## Next steps when picking this back up

1. Reproduce Symptom 1 on-device with a specific screen + assignment row dump. Classify (data / UI / copy).
2. Answer the six open questions above with the product owner.
3. Pick a direction (A-E or combination).
4. Write a proper design spec for the chosen direction, following the brainstorming → writing-plans → subagent-driven-development flow this repo now uses.
5. Land on a dedicated feature branch off `m5-complete` per the session workflow.

## Do NOT fix this in-flight

This spec exists so the next session can load context without re-deriving it. It is intentionally NOT prescriptive about a fix. The code paths touched (`updateCalorieShares`, `refreshWetReserve`, the Custom Splits role-toggle logic) are load-bearing for the Behavioral Feeding architecture and deserve a proper design cycle.
