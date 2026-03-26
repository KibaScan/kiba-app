# Services

Supabase CRUD + business logic. No React/UI imports.

## Offline patterns
- Write functions throw `PantryOfflineError` (pantryService, appointmentService)
- Read functions return `[]` gracefully on offline
- Network check: `src/utils/network.ts` → `isOnline()`

## Auth
- Anonymous sign-in via `ensureAuth()` in auth.ts
- Storage bucket `pet-photos` (public), path: `{userId}/{petId}.jpg`

## Key relationships
- `pantryService.ts` → depends on `pantryHelpers.ts` (pure math)
- `scoring/pipeline.ts` → bridge between Supabase and pure `scoring/engine.ts`
- `portionCalculator.ts` → RER/DER math, used by pantry + PortionCard
- `topMatches.ts` → triggers `batch-score` Edge Function
- `treatBattery.ts` → per-pet daily kcal/count, midnight auto-reset

## Schema traps
- Table is `pets` NOT `pet_profiles`
- Table is `scan_history` NOT `scans` (but permissions.ts uses `scans` for rate limiting)
- `product_upcs` is junction table, NOT TEXT[] array
- `pantry_items` has NO `pet_id` — pets link via `pantry_pet_assignments`
