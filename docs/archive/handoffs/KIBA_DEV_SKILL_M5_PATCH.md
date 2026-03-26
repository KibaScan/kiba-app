# Kiba Dev Skill — M5 Update Patch

> **Apply these changes to /mnt/skills/user/kiba-dev/SKILL.md**
> This is a patch — surgical edits to the existing skill file.

---

## Changes to Apply

### 1. Quick Context — Current Phase
```
OLD: Current phase: M5 Pantry + Recall Siren (M0–M4.5 + UI polish pass complete). 558 tests passing, 28 suites. 9,089 products. Pure Balance regression = 62.
NEW: Current phase: M5 Pantry + Recall Siren (M0–M4.5 + UI polish + 5 cleanup rounds complete). 641 tests passing, 32 suites. 9,090 products. Pure Balance regression = 62, Temptations = 9.
```

### 2. CRITICAL Section — Update Decision Count
```
OLD: 147 decisions (D-001 through D-147, D-013 superseded by D-137, D-113 superseded by D-136)
NEW: 158 decisions (D-001 through D-158, D-013 superseded by D-137, D-113 superseded by D-136). D-150–D-151 = life stage/nursing. D-152–D-157 = pantry. D-158 = recalled product bypass.
```

### 3. Non-Negotiable Rules — Add
```
17. **Recalled product bypass (D-158)** — `is_recalled = true` → pipeline bypass, no score. Bypass chain: vet diet → species mismatch → recalled → variety pack → supplemental → normal.
18. **Pantry paywall = goal weight DER only (D-153)** — everything else free. Via `permissions.ts`.
19. **Pantry sharing: same-species only, naturally gated (D-154)** — cross-species blocked. No explicit premium check — sharing requires 2+ same-species pets, free users limited to 1 pet (D-052).
20. **Diet completeness ≠ score modifier (D-136 Part 5)** — pantry warnings are informational banners, never product scores.
21. **Treats excluded from depletion display** — no progress bar, calorie context, or depletion breakdown on treat cards. Treat Battery integration wires up in Phase 2 Session 10.
22. **Notifications: 3 server + 2 local** — auto-deplete, recall-check, weekly-digest are server-side cron Edge Functions. Feeding reminders and appointment reminders are LOCAL notifications via expo-notifications on device.
```

### 4. Pipeline Bypass Order — Update
```
OLD: Pipeline bypass order: vet diet → species mismatch → variety pack → supplemental (65/35/0, scored) → normal scoring
NEW: Pipeline bypass order: vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental (D-146, scored, NOT bypassed) → normal scoring
```

### 5. Schema Gotchas — Add
```
| `pantry_items.pet_id` | Does NOT exist — pet assignment is via `pantry_pet_assignments` junction table |
| `pantry_pet_assignments` RLS | Scopes through `pantry_items.user_id`, NOT directly through `pets.user_id` |
| `pantry_items.unit_label` | User-selected 'cans' or 'pouches' — never hardcoded to 'units'. Carries through to cards, breakdown, notifications. |
| `pet_appointments.pet_ids` | UUID[] array, NOT a junction table |
| `recall_log` / `recall_review_queue` | NO RLS — system/admin tables |
| `user_settings` | Separate table from `push_tokens` (migration 014). Per-category notification toggles. |
| Recalled product score | No score — D-158 bypass. Never compute or display a score for recalled products. |
```

### 6. What NOT to Build — Add
```
❌ Score recalled products (D-158 bypass) · ❌ Auto-rebalance mixed feeding (D-157 — nudge instead) · ❌ Caloric proportion slider (D-152 replaced with user-set amounts) · ❌ Score = 0 for recalled products (D-158 uses bypass, not zero) · ❌ canSharePantryItem() permission check (sharing naturally gated by pet limit D-052) · ❌ Premium badge on share sheet (natural gating, no explicit paywall)
```

### 7. Common Pitfalls — Add
```
- **Recalled products:** D-158 bypass — same pattern as vet diet. Never score. Never show score ring. Check `is_recalled` in pipeline before variety pack check.
- **Recalled edit screen:** Feeding + Schedule sections disabled (40% opacity). Restock hidden. Only Quantity (return/refund tracking) + "View Recall Details" + Remove shown.
- **Empty edit screen:** Feeding + Schedule sections muted (60% opacity, still editable — settings preserved for restock). Restock is primary action (accent fill). Depletion shows "Empty."
- **Pantry depletion for treats:** Returns null. Treats don't show depletion breakdown, progress bar, or calorie context. Treat Battery wires up in Phase 2 Session 10.
- **Pantry sharing gate:** NO canSharePantryItem() check. NO premium badge. Sharing requires 2+ same-species pets — free users have 1 pet (D-052), so sharing is naturally unreachable. When no eligible pets exist, sheet shows: "No other [dogs/cats] to share with. Sharing requires 2 or more pets of the same species."
- **Share picker per-pet scores:** Each pet row in SharePantrySheet shows their per-pet score for the product (colored badge via getScoreColor). Helps user decide whether sharing makes sense.
- **Unit labels in pantry:** "cans" vs "pouches" is user-selected, not hardcoded. Dynamic throughout — add sheet, pantry card, depletion breakdown, notifications.
- **Diet completeness is read-time:** Computed on render from active pantry items, not stored. Never modifies scores.
- **Notification architecture:** Feeding reminders and appointment reminders are LOCAL notifications (expo-notifications scheduled on device, work offline). Only auto-deplete, recall-check, and weekly-digest are server-side cron Edge Functions. Don't build server cron for feeding or appointment reminders.
- **Offline pantry:** Writes blocked with toast ("Connect to the internet to update your pantry"). Reads cached from Zustand. No sync queue — v1 simplification.
- **Pantry paywall creep:** Only gate is `canUseGoalWeight()` in permissions.ts. No other premium checks anywhere in pantry code. Not on sharing, not on pantry access, not on diet completeness.
```

### 8. Self-Check — Add
```
□ D-158 recalled bypass in correct position? 'recalled' in BypassReason type?
□ Pantry paywall only canUseGoalWeight() in permissions.ts?
□ No canSharePantryItem() or premium badge on share flow?
□ Diet completeness NOT a score modifier?
□ Treats excluded from depletion/progress bar/calorie context?
□ Pantry sharing same-species only? Empty state message correct?
□ Share picker shows per-pet scores next to pet names?
□ Recalled edit screen: feeding/schedule disabled, restock hidden?
□ Empty edit screen: feeding/schedule muted, restock primary?
□ Push notification copy D-084 + D-095 compliant?
□ Recall features free everywhere (D-125)?
□ Feeding + appointment reminders are LOCAL (not server cron)?
□ Pantry writes blocked offline? Reads cached?
□ Unit labels dynamic ("cans"/"pouches") throughout?
```

### 9. Reference Files — Add
```
- **`PANTRY_SPEC.md`** — Read before ANY pantry work. Schema, CRUD, depletion model, diet completeness, multi-pet sharing, paywall, edge cases.
- **`TOP_MATCHES_PLAN.md`** — Read before Top Matches / SearchScreen work. Batch scoring architecture, cache table, lazy invalidation, UI spec.
```
