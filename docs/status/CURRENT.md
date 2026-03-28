# Project Status — Last updated 2026-03-27

## Active Milestone
**M6 — Alternatives Engine** (compare flow, safe swaps, weight management, BCS reference, vet report PDF)

## Last Completed
**M5 — Pantry + Appointments + HomeScreen v2** (March 26, 2026, branch `m5-complete`)

## What Works
- Scan-to-score pipeline: barcode → 3-layer scoring (IQ/NP/FC) → result screen
- 19,058 products (v7 reimport, Chewy + Amazon + Walmart)
- Pet profiles, pantry (auto-deplete, budget-aware servings), treat battery
- Appointments (CRUD, recurring, reminders, health records)
- Push notifications (feeding, low stock, empty, recall, appointment, weight estimate, digest)
- HomeScreen v2, Community tab, Top Matches, RevenueCat paywall
- **Health condition scoring** — 12 conditions (P0-P3), Layer 3 adjustments, cardiac+DCM zero-out
- **Health condition UI** — expanded condition picker (mutual exclusions, sub-types), ResultScreen advisories, medication tracking
- **Weight goal slider (D-160)** — 7-position discrete slider (-3 to +3), cat -3 absent, condition-blocked positions, premium-gated, auto-reset on conflict
- **Caloric accumulator (D-161)** — daily delta tracking in auto-deplete cron, weight estimate push notifications, WeightEstimateSheet (confirm/enter/dismiss), PetHubScreen banner
- **BCS reference (D-162)** — 9-point educational guide, species tabs, tappable selection saves to pet profile, cat primordial pouch callout, free for all users
- **Compare flow** — 9-rule key differences engine, two-column CompareScreen (score breakdown, nutrition table, ingredients), CompareProductPickerSheet (search, recent scans, camera), kcal/cup estimation fallback (DB → kcal/kg × 110g → Atwater), PortionCard kcal/cup display

## What's Broken / Known Issues
- Pre-existing TS errors: SharePantrySheet.tsx (Product type), feedingNotificationScheduler.ts (unit type)

## Numbers
- **Tests:** 1075 passing / 52 suites
- **Decisions:** 129 (D-001 through D-167, non-sequential, all `###` normalized)
- **Migrations:** 22 (001–022)
- **Products:** 19,058

## Regression Anchors
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9
- Pure Balance + cardiac dog = 0 (DCM zero-out)
- Pure Balance + pancreatitis dog = 57 (fat >12% DMB penalty)

## Up Next (M6)
- Safe Swap recommendations + condition filters (topMatches.ts hard filters per condition)
- Vet Report PDF, affiliate integration
- PortionCard: auto-populate feedings_per_day per condition
- Paywall gate: replace `canCompare()` stub with real premium check (M7)
- `aafco_inference` on Product type (low priority — Rule 5 uses aafco_statement only)

## Optimization Status
- **All cheatsheet sections complete:** S1–S13 (S9 N/A, S11/S14 pattern guidance only)
- **Maintenance guide complete:** scoring-details.md created, reference files audited, /audit-context + /milestone-close commands added
- **Hooks active:** protect-scoring.sh, regression-gate.sh, quality-gate.sh
- **Slash commands:** /boot, /handoff, /check-numbers, /audit-context, /milestone-close

## Last Session
- **Date:** 2026-03-28
- **Accomplished:** D-167 Allergen Score Cap + M6 CompareScreen code review.
  - **D-167: Allergen score cap at 50** — products containing a pet's declared allergens (direct or possible match) are hard-capped at 50 in `applyPersonalization()`. Ensures ResultScreen always shows "Explore alternatives" for allergen-containing foods instead of "Consider for occasional use."
    - 12-line cap block in `personalization.ts`, follows cardiac/DCM zero-out pattern
    - 5 new tests + 3 updated tests + 1 integration test updated
    - D-167 added to DECISIONS.md, scoring-rules.md sections 9 and 13 updated
  - **CompareScreen code review** (prior in session): reviewed all 11 files (4 new, 7 modified), applied 3 cleanup fixes to CompareScreen.tsx (unused import, `.length` dep proxy, `as any` on Ionicons)
- **Files changed:** src/services/scoring/personalization.ts, __tests__/services/scoring/personalization.test.ts, __tests__/services/scoring/allergenOverride.test.ts, src/screens/CompareScreen.tsx, DECISIONS.md, docs/references/scoring-rules.md, docs/status/CURRENT.md
- **Not done yet:**
  - Safe Swap recommendations + condition filters
  - Vet Report PDF, affiliate integration
  - PortionCard: auto-populate feedings_per_day per condition
  - Paywall gate: `canCompare()` currently stubbed true — needs real premium check (M7)
  - `aafco_inference` not on Product type (Rule 5 uses aafco_statement only for now)
  - Scoring reference docs: scoring-details.md still needs condition scoring + weight management sections
- **Next session should:** Run /boot. Commit + push D-167 changes. Start Safe Swap condition filters or vet report PDF.
- **Gotchas for next session:**
  - **D-167 scoring change**: scoring-details.md updated with allergen cap. Still needs condition scoring + weight management sections.
  - `canCompare()` is stubbed to return `true` — don't forget to gate behind real paywall in M7.
  - `getMaxBucket()` in CompareScreen only handles treat vs daily_food weights — supplemental products would show wrong denominator. Low risk since picker filters by category.
  - SafeSwapSection referenced in M6 prompt doesn't exist — `src/components/result/` only has HealthConditionAdvisories.tsx. Separate build needed.
  - `liver` and `seizures` tags exist in DOG_CONDITIONS but have NO scoring rules in conditionScoring.ts — display-only.
  - Bypass order docs were fixed this session (scoring-details.md was correct; CLAUDE.md + pipeline.ts comment were wrong, now fixed).
  - Auto-deplete cron `computeInlineDER()` is a simplified copy of client-side DER math — if portionCalculator.ts multiplier tables change, cron must be updated manually.
  - `pantryHelpers.ts:385` `getSystemRecommendation()` missing weight_goal_level param — function is unused but worth fixing preemptively.
- **New decision: D-167 (Allergen Score Cap). Scoring logic changed (personalization.ts Layer 3). No new migrations.**
