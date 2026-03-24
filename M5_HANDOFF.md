# M5 Handoff — Continuing Polish in New Chat

> Generated March 21, 2026. Provide this + M5_POLISH.md + DECISIONS.md to the new chat.

---

## Current State

**M5 core is complete.** 11 sessions done. 905 tests, 43 suites, 0 TS errors. Pure Balance = 62, Temptations = 9. Migrations 011–019 applied. 5 bugs from code review fixed (862 → 905 tests). Now in polish phase — fixing UX issues found during on-device testing.

**Branch:** `m4.5-cleanup` (rename to `m5-complete` before merging to main)

**Decision count:** D-001 through D-166, plus D-124 revised. Key new decisions from this session: D-160 (weight goal slider, M6), D-161 (caloric accumulator, M6), D-162 (BCS reference, M6+), D-163 (health records via appointment completion, done), D-164 (unit label simplification, done), D-165 (calorie-budget-aware recommendations, done), D-166 (weight conversion + cups/servings helper text, in progress).

---

## Blocker — Fix First

**kcal/kg data quality issue.** 67% of dry food products (613 of 915) have wrong `ga_kcal_per_kg` values. The scraper pulled inconsistent numbers from different Chewy page layouts — some kcal/kg, some kcal/lb, some unknown. **This is NOT a uniform ×10 fix.**

However, `ga_kcal_per_cup` appears reliable (300-450 range, consistent). Verified products average **10.1 cups per kg** (kcal_per_kg / kcal_per_cup ratio).

**Fix for 536 products** (bad kcal/kg, good kcal/cup):
```sql
UPDATE products
SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 10.1)
WHERE product_form = 'dry'
  AND ga_kcal_per_kg IS NOT NULL
  AND ga_kcal_per_kg < 1000
  AND ga_kcal_per_cup IS NOT NULL
  AND ga_kcal_per_cup BETWEEN 200 AND 600;
```

**77 products are unfixable** — bad kcal/kg AND no kcal/cup. Need rescrape or D-149 Atwater estimation.

**Wet food needs separate investigation.** Legitimate wet food is 800-1200 kcal/kg. Values like 40, 51, 75 in the CSV are likely kcal/100g or kcal/can. Different fix threshold.

**Validation after fix:** Blue Buffalo Small Breed should show ~3,800-4,000 kcal/kg (398 kcal/cup × 10.1 = ~4,020). Pantry should then show ~61 cups for a 15 lb bag, not 12.

---

## Polish Items Remaining (see M5_POLISH.md for full list)

**High confidence:**
- D-159: Low-score feeding context line (one conditional Text)
- Time picker: replace 31-button grid with native DateTimePicker
- D-166: cups/servings helper text (move from inline chip to muted text below bag size)
- PantryCard: treat vs as_needed confusion (check `product.category`, not `feeding_frequency`)
- D-124 revised: Treat quick picker sheet (one-tap logging from pantry treats, scanner as fallback)
- HomeScreen dashboard cards (recall, pantry summary, upcoming appointment)

**Medium confidence:**
- Feeding stepper expansion (1-5 instead of 1-3)
- PetHubScreen upcoming appointment widget
- Recent scans on HomeScreen

---

## Key Architecture Decisions the New Chat Must Know

1. **Pantry score source (D-156):** Live read, not snapshot. Resolution: pet_product_scores → scans.final_score → products.base_score. Scan persistence was just fixed — ResultScreen now writes to scans table.

2. **Auto/Manual serving (D-165):** Auto mode = feedings stepper is the ONLY input, serving size is calculated read-only from remaining calorie budget. Manual = both editable. Budget subtracts existing pantry calories before recommending.

3. **Budget warnings anchor to maintenance DER (D-165):** Recommendations use adjusted DER (from D-160 slider). Warnings use maintenance DER × 1.20 as ceiling. +3 slider = already at ceiling.

4. **Unit labels (D-164):** "servings" everywhere. No cans/pouches picker. Schema CHECK updated in migration 019.

5. **Share gating:** No `canSharePantryItem()`. Naturally gated by D-052 pet limit (free = 1 pet). Share picker shows per-pet scores next to names.

6. **Bypass chain:** vet diet → species mismatch → recalled → variety pack → supplemental → normal.

7. **Treat detection:** Use `product.category === 'treat'`, NEVER `feeding_frequency === 'as_needed'`. As-needed daily food is not a treat.

8. **Smart default feedings:** If active pet has active daily food in pantry → default 1 feeding. No active daily food → default 2 feedings. Per-pet check, not household.

9. **D-158 recalled items in edit screen:** Feeding/schedule disabled at 40% opacity, restock/share hidden, "View Recall Details" link, Remove only.

10. **D-155 empty items in edit screen:** Feeding/schedule muted at 60% (still editable, preserved for restock), restock is primary action.

11. **Health records (D-163):** `pet_health_records` table with `record_type` column (vaccination/deworming). Logged via appointment completion sheet. Booster auto-scheduling is one-shot, not recurring. Expandable to flea/heartworm/dental via CHECK constraint update.

12. **DEV premium override:** `__DEV__` flag in `isPremium()` in permissions.ts returns true in dev builds. Don't commit as true.

---

## Migration History

| # | What |
|---|---|
| 011 | Pantry tables (pantry_items + pantry_pet_assignments) with D-164 merged |
| 012 | pet_product_scores cache (Top Matches) |
| 013 | push_tokens |
| 014 | user_settings (notification preferences) |
| 015 | pg_cron schedule for auto-deplete (30 min) |
| 016 | Recall tables (recall_log, recall_review_queue, recall_notifications) + daily cron |
| 017 | pet_appointments + pet_health_records (D-163) |
| 018 | Weekly digest cron |
| 019 | unit_label CHECK → 'servings' only (merged into 011 for fresh installs) |

---

## Edge Functions (3 server-side cron)

- `auto-deplete` — 30-min, daily-total depletion model, low stock + empty push notifications
- `recall-check` — daily 6 AM UTC, FDA RSS matching, 5-step algorithm, 10 test fixtures
- `weekly-digest` — Sunday 9 AM UTC, adaptive content, frequency preference

## Local Notification Schedulers (2 client-side)

- `feedingNotificationScheduler.ts` — daily repeating, multi-pet grouped
- `appointmentNotificationScheduler.ts` — one-shot per reminder interval

---

## Test Count Trajectory

641 (M4.5) → 752 (Session 5) → 761 (Session 6) → 797 (Session 8) → 862 (Session 11) → 905 (post-polish fixes)

---

## Files Most Likely to Be Edited During Polish

- `src/components/pantry/AddToPantrySheet.tsx` — D-166 helper text, D-124 quick picker wiring
- `src/screens/EditPantryItemScreen.tsx` — time picker, already fragile from hooks fix
- `src/screens/PetHubScreen.tsx` — D-124 quick picker, appointment widget
- `src/screens/HomeScreen.tsx` — dashboard cards
- `src/screens/ResultScreen.tsx` — D-159 context line
- `src/components/pantry/PantryCard.tsx` — treat vs as_needed fix
- `src/utils/pantryHelpers.ts` — shared helper functions, cups conversion

---

## Gotchas for Claude Code

- **EditPantryItemScreen is fragile.** It was rewritten during hooks fix and lost the Auto/Manual toggle. Tell Claude Code "surgical additions only, do NOT rewrite the component" when editing it.
- **Jest crashes at 905 tests** when running all suites together. Use `node --max-old-space-size=4096` or run shards. All 4 shards pass independently.
- **Migrations must be applied via Supabase SQL Editor** — `supabase db push` had uuid_generate_v4() search path issues. Combined scripts work fine in the SQL Editor.
- **Recall testing:** Flip `is_recalled = true` on a product in Supabase dashboard to test recall flows. Flip back when done.
