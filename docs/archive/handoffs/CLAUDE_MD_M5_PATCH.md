# CLAUDE.md — M5 Update Patch

> **Apply these changes to the existing CLAUDE.md before starting M5 Session 1.**
> This is a patch document — not a full replacement. Edit the existing file surgically.

---

## Changes to Apply

### 1. Current Phase
```
OLD: Current phase: M5 Pantry + Recall Siren (or whatever it says)
NEW: Current phase: M5 Pantry + Recall Siren
```

### 2. Test Count
```
OLD: 641 tests/32 suites
NEW: [update to actual count after Session 1 Prompt 1 TS fixes]
```

### 3. Decisions Count
```
OLD: D-001–D-151
NEW: D-001–D-158
```

### 4. Add to Spec Files Table

| File | What it covers |
|------|---------------|
| `PANTRY_SPEC.md` | Full pantry spec — schema, CRUD, diet completeness, depletion, multi-pet sharing, paywall, edge cases |
| `TOP_MATCHES_PLAN.md` | Top Matches architecture — batch scoring, cache table, lazy invalidation, SearchScreen rewrite |

### 5. Add to Migrations List
```
011_pantry_tables.sql          ← pantry_items + pantry_pet_assignments with RLS
012_pet_product_scores.sql     ← Top Matches cache table with lazy invalidation
013_push_tokens.sql            ← Expo push token storage + notification preferences
014_recall_tables.sql          ← recall_log + recall_review_queue + recall_notifications
015_appointments.sql           ← pet_appointments with recurring support
```

### 6. Add to Key Code Paths
```
src/services/pantryService.ts     ← pantry CRUD + diet completeness
src/services/topMatches.ts        ← cache freshness + Top Matches queries
src/services/appointmentService.ts ← appointment CRUD + recurring logic
src/services/pushService.ts       ← Expo push token registration
src/utils/pantryHelpers.ts        ← depletion math, calorie context, serving defaults
src/stores/usePantryStore.ts      ← pantry state management
src/stores/useTopMatchesStore.ts  ← Top Matches state management
src/components/pantry/            ← PantryCard, AddToPantrySheet, SharePantrySheet
src/screens/PantryScreen.tsx      ← Pantry tab
src/screens/RecallDetailScreen.tsx ← FDA recall detail
src/screens/AppointmentsListScreen.tsx ← Appointment management
supabase/functions/batch-score/   ← server-side batch scoring (copied engine)
supabase/functions/auto-deplete/  ← pantry depletion cron
supabase/functions/feeding-reminders/ ← feeding notification cron
supabase/functions/recall-check/  ← FDA RSS monitoring cron
supabase/functions/appointment-reminders/ ← appointment reminder cron
supabase/functions/weekly-digest/ ← weekly summary notification cron
```

### 7. Add to Non-Negotiable Rules
```
14. **Recalled product bypass (D-158)** — `is_recalled = true` → pipeline bypass, no score, same pattern as vet diet (D-135). Bypass chain: vet diet → species mismatch → recalled → variety pack → supplemental → normal.
15. **Pantry paywall: goal weight DER only (D-153)** — no other premium checks in pantry code. All via `permissions.ts`.
16. **Pantry sharing: same-species only (D-154)** — cross-species sharing blocked.
```

### 8. Add to Do NOT Build
```
- Score recalled products (D-158 — bypass, not score=0)
- Auto-rebalance mixed feeding on removal (D-157 — nudge instead)
- Treat Battery pantry integration (M5 polish — deferred from core sessions)
- Caloric proportion slider (D-152 — user enters actual amounts instead)
```

### 9. Update Regression Anchors
```
Pure Balance (Dog) = 62
Temptations (Cat Treat) = 9
```

### 10. Add to Self-Check
```
□ D-158 recalled bypass intact? Bypass chain order correct?
□ Pantry paywall only in permissions.ts (canUseGoalWeight)?
□ Pantry sharing same-species only?
□ Diet completeness is NOT a score modifier?
□ Depletion math treats excluded?
□ Push notification copy D-084 + D-095 compliant?
□ Recall features free (D-125)? No premium checks?
```

### 11. Update Schema Traps (add)
```
- `pantry_items` — user_id scoped, NOT pet_id (pet assignment is in junction table)
- `pantry_pet_assignments` — many-to-many, RLS scopes through pantry_items.user_id
- `pet_appointments.pet_ids` — UUID[] array, NOT junction table (appointments are simple enough)
- `push_tokens` — UNIQUE(user_id, device_id), upsert on app launch
- `recall_log` / `recall_review_queue` — NO RLS (system/admin tables)
```
