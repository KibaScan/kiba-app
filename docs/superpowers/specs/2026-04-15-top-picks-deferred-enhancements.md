# Top Picks — Deferred Enhancements

**Date:** 2026-04-15
**Companion to:** `2026-04-15-top-picks-dedicated-screen-design.md`
**Status:** Deferred — not in V1 scope. Revisit triggers listed per item.

---

This document tracks enhancements explicitly held back from the V1 `CategoryTopPicksScreen` implementation. Each item names the trigger that should prompt a revisit.

---

## 1. Kiba Index as a Top Picks signal (display + tiebreaker, NOT a score modifier)

**What:** Incorporate community `kiba_index_votes` (D-032, migration 026) as:

1. **A new insight bullet** — `kind: 'kiba_index'`, copy `"Loved by {N}% of {species}s on Kiba"`. Taste-only for V1 (tummy brushes UPVM framing). Gated by `vote_count >= 10 AND taste_pct >= 75`.
2. **A secondary sort tiebreaker** — `ORDER BY final_score DESC, kiba_taste_pct DESC NULLS LAST`. Breaks integer-score ties by community signal.
3. **Priority slot** — between `life_stage` and `macro_fat/macro_protein`. Rationale: social proof is powerful once it exists but personalized facts (allergens, life stage) remain higher-priority for THIS pet.

**Data plumbing:**
- Extend `TopPickEntry` with `kiba_index: { taste_pct: number; tummy_pct: number | null; vote_count: number } | null`.
- After top-20 query, call `get_kiba_index_stats(product_ids, species)` RPC (migration 026) to hydrate. Confirm the RPC accepts `UUID[]` batch; if not, add a batched variant or wrap with `Promise.all` over 20 IDs.
- New helper `checkKibaIndex(entry, ctx): InsightBullet | null` alongside existing checks. Unit-tested with threshold + empty-data cases.

**Compliance guardrails:**
- Taste-only in V1 ("loved it" votes). Tummy votes imply GI outcome — defer until vet/legal review of copy.
- `"Loved by"` is factual attribution (user voted "loved it"), not a therapeutic claim. Passes UPVM regex (no blocklist terms).
- Parenthetical source attribution `(Kiba Index)` OR post-fix `on Kiba` — makes it clear this is community data, not editorial endorsement.
- **Strict separation from the scoring engine.** Kiba Index MUST NOT feed into Layer 1/2/3. D-019 brand-blind + ingredient-based scoring stays intact. This is display-and-tiebreak only.

**Why deferred:**
- "Months or years to kick in" — vote density for any given product takes time to accumulate beyond the 10-vote threshold. V1 would mostly emit empty-state fallback anyway, so building it up-front adds complexity without user-visible payoff.
- Vote-count telemetry needed first to tune threshold (currently a guess at 10).
- Tummy integration requires independent compliance review.

**Trigger to revisit:**
- Telemetry shows ≥20% of daily-food products have `vote_count >= 10`, meaning the bullet would fire on a meaningful share of picks.
- A community-growth feature (digest push encouraging voting, streak bonuses for voting) ships and needs downstream consumption points to justify user effort.
- V1 static insights feel repetitive and users want more differentiation between picks (Kiba Index provides the social-proof angle that static signals lack).

**Effort:** Small-medium. New field on `TopPickEntry` + one RPC call + one check function + ~4 unit tests + priority-order update. Biggest risk: RPC batching — need to confirm or add batched variant.

**Future extensions** (further deferred):
- Breed-filtered Kiba Index (`"Loved by 91% of {breed}s"` — requires breed tagging on votes, which isn't in migration 026 schema today).
- Tummy integration with vet-reviewed copy (`"Well-tolerated by 88% of dogs"` — needs UPVM sign-off).
- Recency weighting (last-90-day votes weighted higher to reflect current formulations).
- Low-vote-count "Be the first to rate" CTA on hero/rank rows to drive voting.

---

## 2. Migration 040 — Cache `score_breakdown JSONB` on `pet_product_scores`

**What:** Add a `score_breakdown JSONB` column to `pet_product_scores`, update the batch-score Edge Function + client scorer (`batchScoreHybrid`) to write the full `ScoredResult` shape (or a trimmed subset), and backfill for existing scored rows.

**Why deferred:** Migration 012 comment explicitly states "list view only — full breakdown computed on tap." The current cache is ~40 bytes/row; adding `score_breakdown` bumps it to ~5–10 KB/row. For a heavy user with 10 pets × ~5,000 scored products each, that's ~500 MB storage footprint. Also, much of the breakdown payload (Layer 3 personalizations like `"supports joint health"`) fails UPVM (D-095) and can't be surfaced as-is.

**Trigger to revisit:**
- Telemetry or feedback shows the V1 static-signal insights feel flat/repetitive.
- A separate feature (e.g., a compare-across-cache view, a diet-history dashboard) needs breakdown access.
- UPVM-safe rewrites of layer-3 signals become practical (e.g., `"Omega-3 enriched formulation"` instead of `"supports coat health"`).

**Effort:** Migration (trivial) + Edge Function update (medium — need to decide trimmed vs full shape) + client scorer update + backfill script (medium — batched to avoid RPC limits).

---

## 3. Cross-category "Picks for {Pet}" hub (Option B — Apple-style rails)

**What:** A separate screen that aggregates Top Daily Food + Top Topper + Top Treat + Top Supplement into horizontal rails, one per category. Entry point from HomeScreen or MeScreen ("Picks for Troy" card).

**Why deferred:** The current entry point (`TopPicksCarousel` → See All) is already category-scoped. Routing into a cross-category hub from a category-scoped entry point breaks the user's spatial mental model and feels like an up-sell distraction. A cross-category hub belongs at a different entry point (e.g., a "Diet Builder" CTA on HomeScreen or PetHub).

**Trigger to revisit:**
- Product ships a "Diet Builder" or "Complete Meal" feature that benefits from cross-category picks.
- Retention data shows users cross-shop between daily food + toppers + treats.
- MeScreen or PetHub gets a natural entry point for it.

**Effort:** New screen + new service function returning `Record<BrowseCategory, TopPickEntry[]>` + new horizontal-rail component + navigation wiring. Medium.

---

## 4. Inline "Add to Pantry" action on picks

**What:** A primary CTA on the hero card + a quick-add affordance on each rank row that adds the product directly to the active pet's pantry without routing to `Result`.

**Why deferred:** D-167 (condition-aware feeding frequency) + behavioral feeding (migration 034) make pantry adds non-trivial. Adding a daily food to a `dry_only` pet triggers `FeedingIntentSheet` (topper vs base). Adding a wet to a pet with an existing dry anchor may need rebalance logic. An inline "Add" skips these confirmations and risks overfeeding bugs.

**Trigger to revisit:**
- Telemetry shows Top Picks → Result → Add to Pantry is a high-drop funnel.
- `FeedingIntentSheet` routing stabilizes so it can be invoked directly from the pick without `AddToPantrySheet`.

**Effort:** Small component change + careful integration with `FeedingIntentSheet` + offline guards + optimistic update in `usePantryStore`. Medium.

---

## 5. Self-healing `batchScoreHybrid()` trigger on empty state

**What:** When `CategoryTopPicksScreen` mounts and the top-20 query returns 0 scored rows for the current filter, trigger `batchScoreHybrid(petId, pet, category, productForm)` with a 5–10s blocking spinner, then re-fetch. Mirror's `TopPicksCarousel`'s existing behavior.

**Why deferred:** V1 relies on the carousel's own trigger and `ensureCacheFresh` on HomeScreen focus. If the user lands on empty here, it's an edge state — the escape hatch bounces them to `CategoryBrowseScreen`, which has its own cold-cache handling. Adding a blocking spinner on the new screen would erode the "curated, finite" Buyer-intent framing.

**Trigger to revisit:**
- Telemetry shows users frequently land on the empty state and don't follow the escape hatch.
- Form-aware cache maturity (separate carry-over in CURRENT.md) gets fixed — then this becomes nearly-impossible and isn't worth adding.

**Effort:** Small — copy the trigger + reload pattern from `TopPicksCarousel.loadPicks:80-96`.

---

## 6. Screen-level integration test for `CategoryTopPicksScreen`

**What:** `__tests__/screens/CategoryTopPicksScreen.test.tsx` covering state transitions (loading → healthy / partial / empty), paywall gate, tab bar hide/restore on focus/blur, escape-hatch routing.

**Why deferred:** The screen's state machine is light (4 states, one fetch, one helper call per pick). Data and insight logic are fully covered by unit tests on the service + helper. A screen-level test adds `@testing-library/react-native` render ceremony for minimal additional coverage.

**Trigger to revisit:**
- A state-transition regression lands in the wild.
- The screen grows logic (e.g., retry button, pull-to-refresh, inline filter chips).

**Effort:** Small — render + mock the service + fire-press events on escape hatch / back button.

---

## 7. Additional entry points (deep links, notifications, Safe Swap outcomes)

**What:** Open `CategoryTopPicksScreen` from:
- Weekly digest push (`"See Troy's top 20 for this week →"`)
- Safe Swap completion card (`"Explore more top picks →"`)
- Deep link: `kiba://top-picks?category=daily_food&petId=...&subFilter=dry`

**Why deferred:** V1 scope is carousel-only. Multiple entry points require thinking about route params shape, pet-active-but-filter-unknown fallbacks, and analytics attribution.

**Trigger to revisit:**
- New feature (digest, notification type) naturally benefits from the entry.
- Deep linking becomes a product priority.

**Effort:** Small per entry point — all reuse the same route + params.

---

## 8. Condition-driven bullets

**What:** Expand the insight generator to emit bullets like:
- `"Grain-free"` when the pet has wheat allergy (beyond just the ingredient match)
- `"Moderate phosphorus"` for kidney-aware pets
- `"Limited-ingredient formula"` for GI-sensitive pets
- `"Taurine supplemented"` for cats / DCM-aware dogs (D-137)

**Why deferred:** Several of these cross the line into implied medical claims under UPVM (D-095). `"Moderate phosphorus"` is factual; `"supports renal health"` is not — but the former without the latter is almost useless to the user. Needs vet + legal sign-off on which condition-linked property callouts are safe to surface as bare facts.

**Trigger to revisit:**
- Vet panel review completes with an approved list of factual property callouts.
- A specific condition feature (e.g., "Renal diet picker") ships and needs property filtering.

**Effort:** Small per bullet, but requires a design-level review for compliance, not just engineering.

---

## 9. Compare hook on hero

**What:** Secondary CTA on the hero: `"Compare with last scanned"` → routes to `CompareScreen` with the Top Pick as the "new" side and the user's last scanned product as the "current" side.

**Why deferred:** V1 keeps the hero single-purpose (tap → Result). Compare is a discovery feature for post-scan decision-making; the Top Picks flow is discovery-from-scratch — different funnel.

**Trigger to revisit:**
- `CompareScreen` telemetry shows low discovery (users don't know it exists).
- Post-scan flow ships an inline "Compare vs top pick" CTA on ResultScreen — Top Picks hero would want symmetry.

**Effort:** Small — `CompareScreen` already accepts two products via params.

---

## 10. Feline carb bullet (D-014)

**What:** Emit `"Low carb ({X}% DMB)"` for cats when the product has low estimated carbs. Uses the same Atwater-based `carbEstimate` logic that powers `PortionCard`'s "Est. X% carbs" display.

**Why deferred:** `carbEstimate` is a computed field on `ScoredResult`, not on `products` or `pet_product_scores`. Computing it client-side for 20 picks requires hydrating protein/fat/fiber/moisture/ash and running the estimator — fine, but adds logic. Folds naturally into migration 040 (Deferred Enhancement #1) since the breakdown would include it.

**Trigger to revisit:**
- Migration 040 ships.
- A product decision explicitly wants carb-aware messaging for cats.

**Effort:** Small once migration 040 lands; medium if done standalone (need to extract `carbEstimate` into a stateless helper).

---

## 11. Same-brand disambiguation for rank-row display names

**What:** When two rank-row picks share the same brand + identical first-two descriptor words, the short display name (`getConversationalName` output) can collide. Fall back to a longer disambiguation (add product size, flavor, or recipe identifier) when a collision is detected within the visible list.

**Why deferred:** Already tracked as a carry-over in `docs/status/CURRENT.md` ("Same-brand disambiguation for `getConversationalName`"). Flagged for when users hit it in the wild.

**Trigger to revisit:**
- User report / screenshot of two collided rows.
- Telemetry showing rank-row taps on the same brand within the same screen landing on different products but looking identical.

**Effort:** Small — add a collision detector + fallback-to-longer-name path in `getConversationalName` or at the `TopPickRankRow` level.

---

## Cross-cutting note: Analytics

V1 ships without instrumented analytics for the new screen. Once telemetry is wired in, the following events would be valuable:

- Screen open (category, subFilter, pet species) — baseline funnel
- Hero tap — conversion signal
- Rank row tap (with rank) — rank-distribution curve (does #1 dominate, or is it flat?)
- Escape hatch tap — reverse signal (the curated list didn't serve the user)
- Empty state reached — cold-cache regression indicator

All events respect existing analytics config (no external SDK today). Wire in once an analytics stack lands.
