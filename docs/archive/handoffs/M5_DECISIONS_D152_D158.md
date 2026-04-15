# Kiba — M5 Pantry Decisions (D-152 through D-158)

> **Append these to DECISIONS.md before starting M5 Session 1.**
> Copy the content below directly into DECISIONS.md after the existing D-151 entry.

---

### D-152: Pantry Depletion Model — System-Recommended, User-Adjustable
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-065 (Bag Countdown), D-101 (Feeding Schedule), D-149 (Atwater Estimation)
**Milestone:** M5 (Pantry)

**Decision:** Pantry depletion runs on user-set serving amounts, not raw caloric calculation. The system recommends a serving size at add-to-pantry time based on the pet's DER and the product's calorie data, but the user can adjust to any amount. Depletion countdown tracks whatever the user actually set.

**System recommendation source:**
- Free users: current weight DER via `calculateDER(pet)`
- Premium users with goal weight: goal weight DER via `calculateDER(pet, goalWeight)`
- No calorie data (after D-149 Atwater attempt): no recommendation shown — user enters amounts manually

**Two serving formats:**
- **Weight-based** (dry food, freeze-dried, dehydrated, raw): user enters bag size (lbs/oz/kg/g), cups per feeding, feedings per day. Days remaining computed via calorie-derived conversion when data exists (`total_cups = bag_weight_kg × kcal_per_kg / kcal_per_cup`), omitted when calorie data missing.
- **Unit-based** (wet food cans/pouches, treats): user enters total count, fractional amount per feeding (¼, ⅓, ½, ⅔, ¾, 1, 1½, 2, or custom), feedings per day. Days remaining always computable (units in, units out). Unit label is dynamic — "cans" or "pouches" based on user selection, never hardcoded.

**Depletion math breakdown line:** Displayed on add-to-pantry sheet, updates live as user adjusts inputs:
- Unit mode: "½ can × 2 feedings = 1 can/day · ~24 days of food"
- Weight mode with calorie data: "1.5 cups × 2 feedings = 3 cups/day · ~42 days of food"
- Weight mode without calorie data: "1.5 cups × 2 feedings = 3 cups/day" (no days estimate)
- Treats: not shown (Treat Battery owns treat budgeting — Phase 2, Session 10)

**Rationale:** Pet owners know their routine better than a formula. DER is an estimate; serving amounts are ground truth. The recommendation pre-fills as a helpful starting point, but the user's actual feeding behavior drives the countdown. This eliminates the mixed-feeding caloric doubling bug where two daily foods each compute 100% of DER.

**Rejected:**
- ❌ Pure DER-computed depletion — ignores real-world feeding behavior, produces misleading countdowns when owners feed more or less than calculated
- ❌ No system recommendation — cold-starting with blank serving fields creates friction and removes the "smart" feel
- ❌ Caloric proportion slider (D-065 mixed feeding) — redundant when user enters actual amounts per food

### D-153: Pantry Paywall Scope — Goal Weight DER Only
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-052 (Multi-Pet Premium Gate), D-125 (Recalls Free)
**Milestone:** M5 (Pantry)

**Decision:** The **only** premium gate in the entire pantry feature is goal weight DER. Everything else is free.

| Feature | Free | Premium |
|---|---|---|
| Add to pantry | ✅ | ✅ |
| View pantry | ✅ | ✅ |
| Bag/pack countdown | ✅ | ✅ |
| Feeding schedule + notifications | ✅ | ✅ |
| Diet completeness warnings | ✅ | ✅ |
| Recall alerts in pantry | ✅ (D-125) | ✅ |
| System recommendation (current weight DER) | ✅ | ✅ |
| System recommendation (goal weight DER) | ❌ | ✅ |
| Share pantry item across pets | N/A (1 pet) | ✅ |

Multi-pet sharing is technically premium because free users can only have 1 pet (D-052). It's not a separate pantry gate — it falls out of the existing pet limit.

**Implementation:** `canUseGoalWeight()` in `permissions.ts`. No other `if (isPremium)` checks in pantry code.

**Rationale:** Pantry is the #1 retention feature. Gatekeeping basic pantry functionality would destroy the retention loop that drives premium conversion. Let users build the habit of tracking food, then upsell goal weight management for pets with obesity/underweight conditions.

### D-154: Pantry Sharing Rules — Active Pet Default, Same-Species, Premium
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-052 (Multi-Pet Premium Gate), D-144 (Species Mismatch Bypass)
**Milestone:** M5 (Pantry)

**Decision:** Pantry items default to the **active pet** when added. Multi-pet sharing is an optional premium action with same-species enforcement.

**Rules:**
1. Add-to-pantry defaults to active pet — follows the "match for [Pet Name]" mental model
2. "Share" action on pantry card opens picker showing only **same-species pets** owned by the user
3. Cross-species sharing blocked — dog food cannot be shared with a cat (species mismatch D-144). A chicken-allergic senior dog and a puppy sharing the same kibble entry would produce contradictory dietary signals.
4. Each assigned pet gets their own `pantry_pet_assignments` row with independent serving size, feedings per day, and schedule
5. Depletion sums all assigned pets' consumption rates from `quantity_remaining`
6. Sharing gated by `canSharePantryItem()` in `permissions.ts` (premium check)
7. Free users with 1 pet have no sharing option (no other pets to share with)

**Display:** "Shared by Buster & Milo · ~13 days remaining"

**Rationale:** The core principle is "what is the match for THIS pet." Defaulting to all pets would break that mental model and create confusion when pets have different dietary needs. Sharing is an intentional second step for households where multiple pets genuinely eat from the same bag.

### D-155: Empty Item Behavior — Gray Out, Sink, Restock/Remove Actions
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-065 (Bag Countdown), D-101 (Auto-Depletion)
**Milestone:** M5 (Pantry)

**Decision:** When a pantry item's `quantity_remaining` hits 0:

1. **Visual:** Card renders at 40% opacity, "Empty" label replaces the remaining count
2. **Sort:** Sinks to bottom of pantry list (below active, low stock)
3. **Notification:** Push notification sent: "[Pet Name]'s [Product Name] is empty"
4. **Actions surface on the card:**
   - **Restock** — resets `quantity_remaining` to `quantity_original`, reactivates the item
   - **Edit** — allows manual quantity adjustment (maybe user has a partial bag left)
   - **Remove** — soft-deletes the pantry item. For shared items: "Remove for all pets" or "Remove for [Pet Name] only"
5. **Data:** `is_active` stays `true` until explicitly removed. Empty items are visible so users can restock.
6. **Auto-depletion stops** — no further deductions once quantity hits 0. `quantity_remaining` floors at 0 (never goes negative).

**Rationale:** Empty ≠ removed. Most users restock the same food. Making restock a single tap from the empty state reduces friction. Graying out + sinking ensures empty items don't crowd active items but remain accessible.

### D-156: Pantry Score Source — Live Read, Not Snapshot
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-129 (Allergen Override)
**Milestone:** M5 (Pantry)

**Decision:** Pantry reads the latest available score on every render. No score snapshot stored on the pantry item itself.

**Score resolution order:**
1. `pet_product_scores` cache (from Top Matches batch scoring) — preferred, per-pet score including allergen overrides
2. `scans.final_score` from most recent scan of this product for this pet — fallback
3. `products.base_score` — last resort, not personalized
4. No score available — show bypass badge or "Score unavailable"

**Why no snapshot:** Product scores can change when the scoring engine updates (`scoring_version` bump), when ingredient data is corrected, or when pet profile changes (new allergen → D-129 override changes the score). A snapshot would show stale data. Reading live ensures the pantry always reflects current state.

**Per-pet scoring in shared items:** If a product is shared between an allergic pet and a non-allergic pet, each pet sees their own score (from their own `pet_product_scores` row or scan). The pantry view switches when the active pet switches.

### D-157: Mixed Feeding Removal — No Auto-Rebalance, Contextual Nudge
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-152 (Pantry Depletion Model)
**Milestone:** M5 (Pantry)

**Decision:** When a daily food is removed from a pet's pantry and at least one other daily food remains, the remaining food's serving amounts are **not automatically adjusted**. Instead, show a contextual nudge.

**Behavior:**
1. User removes Food B from pet's pantry
2. Food A's serving amount stays exactly as the user set it (e.g., 1.5 cups × 2 feedings)
3. If ≥1 other daily food remains → show a one-time banner/toast: "[Pet Name]'s daily intake from pantry items has changed"
4. The calorie context line on remaining cards shows "~X kcal/day of [Pet Name]'s Y kcal target" — the gap is self-evident
5. If the **last** daily food is removed entirely → diet completeness red warning fires (already handled by D-136 Part 5)

**Rationale:** Users enter real-world serving amounts (D-152). Auto-increasing Food A from 1.5 cups to 2.5 cups means the app is telling the user to change how much they physically scoop — without being asked. That's a feeding directive, borderline D-095 territory. The user set the amounts; the user adjusts the amounts. The calorie context line gives them the information to act without the system overriding their choices.

**Rejected:**
- ❌ Auto-rebalance to fill caloric gap — overrides user-set amounts, feels like a feeding directive
- ❌ Proportion slider that auto-adjusts — redundant when user enters actual amounts (D-152)
- ❌ No indication at all — user might not notice the caloric impact of removing a food

### D-158: Recalled Product Bypass — No Score, Warning + Ingredients
**Status:** LOCKED
**Date:** March 19, 2026
**Depends on:** D-135 (Vet Diet Bypass), D-144 (Species Mismatch Bypass), D-125 (Recalls Free)
**Milestone:** M5 (Recall Siren)

**Decision:** Recalled products are a pipeline bypass — same pattern as vet diets (D-135) and species mismatches (D-144). No score is computed. The scoring engine never runs for recalled products.

**Bypass chain order (updated):**
```
vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental (D-146, scored) → normal scoring
```

**Implementation:**
- `'recalled'` added to `BypassReason` type union
- In `pipeline.ts`: `if (product.is_recalled) return makeBypassResult('recalled')`
- Check placed after species mismatch, before variety pack
- Batch-score Edge Function: `WHERE is_recalled = false` (excluded from Top Matches)

**ResultScreen recalled bypass view:**
- Red recall badge (more prominent than vet diet's medkit)
- "This product has been recalled by the FDA"
- "Tap for recall details" → RecallDetailScreen
- NO score ring, NO waterfall, NO benchmark bar
- Ingredient list with severity dots (same as vet diet view)
- Allergen warnings still shown (safety-critical)
- "Remove from Pantry" action if product is in active pantry

**Pantry card for recalled items:**
- Red badge, no score number
- Pushed to top of list regardless of other sorting
- Tap → RecallDetailScreen (not EditPantryItemScreen)

**Why bypass instead of score → 0:** A recalled product's ingredient quality is irrelevant — the product shouldn't be fed regardless of how good the ingredients are. Showing a score (even 0) implies the product is being evaluated on merit. The bypass communicates: "this product is outside the scoring framework entirely." Same logic as vet diets — we don't score them because scoring would be misleading, not because they're bad.

**Why bypass instead of banner over scored result:** A score ring showing "82% match" with a recall banner creates cognitive dissonance. The user sees a good score and a danger warning simultaneously. The bypass eliminates this — there's no score to conflict with the safety signal.

**Overrides ROADMAP:** The ROADMAP (M5 section) says "Product score → 0 with recall banner on scan result." D-158 replaces this with the bypass pattern. The bypass is architecturally cleaner (follows D-135/D-144 precedent) and avoids the score=0 confusion (a 0 looks like terrible ingredients, not "recalled by the FDA").

**Compliance:** D-125 — recall features are never paywalled. D-084 — no emoji in recall UI. D-095 — factual tone: "has been recalled by the FDA" not "DANGER: recalled product."
