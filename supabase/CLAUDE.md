# Supabase

## Migrations (supabase/migrations/)
- 20 migrations (001–020), sequential numbering
- NEVER edit existing migrations — always add new ones
- NEVER rename migration files — order-sensitive
- RLS required on every user-data table

## Edge Functions (supabase/functions/)
- `batch-score/` — bulk scoring, contains VERIFIED copy of scoring engine
  → Changes to `src/services/scoring/` MUST be synced here
  → Run `scripts/verify-engine-copy.ts` after scoring changes
- `auto-deplete/` — 30-min pg_cron, pantry depletion + low stock/empty push
- `weekly-digest/` — pg_cron digest push (weekly/daily modes)
- `recall-check/` — FDA recall matching
- `parse-ingredients/` — ingredient parsing
- `upc-lookup/` — external UPC resolution

## Schema traps
- `pantry_items` has NO `pet_id` — pets link via `pantry_pet_assignments`
- `pet_appointments.pet_ids` is UUID[] (not junction table)
- `push_tokens` is UNIQUE(user_id, device_id)
- `ingredients_dict.category` doesn't exist — category is on `products`
