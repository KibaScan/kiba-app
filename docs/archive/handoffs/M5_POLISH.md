# M5 Polish Items

> Post-Phase 2, pre-launch. Tracked separately from core M5 sessions.
> Updated: March 21, 2026 — post-testing session findings added.

---

## Blockers (fix before any more testing)

- **kcal/kg data quality (67% of dry food wrong)** — scraper pulled inconsistent values from different Chewy page layouts. NOT a uniform ×10 fix. `kcal_per_cup` is reliable (300-450 range). Verified products average 10.1 cups/kg ratio. Fix: `UPDATE SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 10.1) WHERE product_form = 'dry' AND ga_kcal_per_kg < 1000 AND ga_kcal_per_cup BETWEEN 200 AND 600` — fixes 536 products. 77 products have bad kcal/kg AND no kcal/cup (need rescrape). Wet food needs separate investigation (different thresholds).

## High Confidence (will do)

- **D-159: Low-score feeding context line** — one conditional `<Text>` on ResultScreen. ≤50 → "Explore higher-scoring alternatives for [Pet Name]". 51–64 → "Consider for occasional use..." Zero engine changes, natural premium conversion bridge.
- **Time picker redesign** — replace 31-button grid on EditPantryItemScreen with native DateTimePicker (mode="time") or hour/minute/AM-PM scroll wheels. Data format unchanged (feeding_times JSONB stores '07:00' strings).
- **D-166 cups/servings helper text** — move cups display from inline chip to muted helper text below bag size input. Add "≈ X cups · ~Y servings at Z cups each" + "Enter as servings instead" link. Per updated D-166 spec. Formula is correct — the 12-cup display was caused by bad kcal/kg data (see blocker above). After data fix, verify helper text shows correct values.
- **PantryCard treat vs as_needed confusion** — card checks `feeding_frequency === 'as_needed'` to show treat UI. Should check `product.category === 'treat'`. Daily food set to "as needed" is not a treat. Show "Log a serving" for as_needed daily food, "Gave a treat" only for treats.
- **D-124 (Revised): Treat quick picker** — "Log a Treat" on PetHubScreen should open a bottom sheet listing the pet's existing pantry treats. One tap to log (deduct 1 serving + kcal). "Scan a new treat" link at bottom for treats not yet in pantry. 90% of treat logs are for products already tracked — opening the camera every time is unnecessary friction.
- **HomeScreen dashboard cards** — currently just a giant scan button. Session 10 Prompt 2 adds: recall alert card (top), pantry summary card, upcoming appointment row. Scan button stays but shrinks to CTA, not the whole screen.

## Medium Confidence (likely)

- **Feeding stepper expansion** — current stepper is 1/2/3. Some owners feed 4× daily (small breeds, puppies). Consider allowing custom integer input or extending to 4–5.
- **PetHubScreen upcoming appointment widget** — ROADMAP says "visible on pet profile and home screen" but PetHubScreen only has a nav link, not the actual upcoming appointment row. Small add.
- **Recent scans on HomeScreen** — currently absent. May be intentional since Scan tab owns that flow. Decide after seeing dashboard with real data.

## Undecided

- **Per-product density data** — replace cups-to-lbs standard approximation (1 cup ≈ 0.25 lbs) with actual density per product. Improves depletion accuracy for weight-mode items. Requires data source — Chewy/Amazon don't consistently list density.
- **Timezone-aware notifications** — weekly digest and auto-depletion cron run UTC. Local timezone scheduling for cron functions. Feeding/appointment reminders are already local (client-side), so this only affects the 3 server-side Edge Functions.

## Completed (done, remove from tracking)

- ~~D-165: Calorie-budget-aware recommendations~~ — implemented, 905 tests passing
- ~~D-164: Unit label simplification~~ — "servings" replaces cans/pouches/units, migration 019 applied
- ~~Auto/Manual toggle on EditPantryItemScreen~~ — D-165 parity restored after hooks fix
- ~~Scan history persistence~~ — ResultScreen now inserts into scans table after scoring
- ~~Duplicate UPC restock no-op~~ — onPress handler wired
- ~~Treats-only pantry red banner~~ — evaluateDietCompleteness() fixed
- ~~Decimal input on cups~~ — keyboard type changed to decimal-pad
- ~~Score mismatch (pantry vs scan)~~ — fixed by scan persistence + D-156 cascade now finds per-pet score
- ~~Notification infrastructure~~ — registerPushToken() wired to app launch, permissions requested, schedulers invoked
- ~~Log a Treat reopens last scan~~ — scanner now starts fresh (clear scan state before navigating)

## Deferred (not M5)

- **Loading screen polish** — data-driven terminal sequence instead of canned messages. Nice-to-have, no functional impact.
- **Top Matches pagination** — currently loads all ~1,700 cached scores client-side. FlatList virtualizes rendering. Revisit if product DB exceeds 5k+.
- **Staleness badge for products unverified >90 days** — blocked on monthly re-scrape pipeline (M3 formula change detection infrastructure still unchecked). Can't show "score may be outdated" until there's a mechanism to re-verify. Unblocked when re-scrape automation ships.

## Moved to M6 (features, not polish)

- **D-160: Weight goal slider** — replaces D-061 raw goal weight. 7 detents, cat -3 hidden, live calorie context, premium-gated. Schema change + new UI + DER math change. Too large for polish.
- **D-161: Caloric accumulator** — estimated weight tracking from feeding data, notify-and-confirm. Schema change + cron logic + notification flow. Too large for polish.
- **D-162: BCS reference tool** — educational panel on pet profiles. Needs visual assets (illustrations per BCS score). M6+.
- **D-164 (renumbered): External device data protocol** — OPEN, M10+. Architecture defined, no implementation.
