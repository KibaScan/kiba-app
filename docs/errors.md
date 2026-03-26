# Common Errors & Fixes

> Lookup table for recurring issues. Add new entries after fixing bugs.
> Format: symptom → root cause → fix.

---

## DOB picker loses state when opening Edit/Create pet screens
**Cause:** useEffect only populated one DOB mode (exact OR approximate), not both. WheelPicker scroll-sync had empty deps so it never re-scrolled after parent hydrated real DOB.
**Fix:** Populate both exact (month/year) and approximate (years/months) from saved DOB. handleDobModeToggle syncs values when switching modes. WheelPicker depends on `selectedIndex`. (commit `0797bbd`)

## Batch-score Edge Function crash kills Search/TopMatches tab
**Cause:** `triggerBatchScore()` threw on non-2xx response with no try/catch, preventing the screen from rendering.
**Fix:** Wrap `triggerBatchScore` in try/catch so the tab renders even when the Edge Function fails. (commit `953b727`)

## Wet food scores catastrophically low (false AAFCO penalties)
**Cause:** DMB conversion not applied — `ga_moisture_pct` is null for many wet food products, so nutrients aren't converted to dry matter basis.
**Fix:** Infer moisture from `product_form` when `ga_moisture_pct` is null: wet=78%, raw=70%, freeze_dried=7%, dehydrated=8%, dry=10%. (commit `953b727`)

## Pantry sort by score shows wrong order
**Cause:** Sort was using a field that didn't reflect the actual resolved score for the active pet.
**Fix:** Use `resolved_score` for pantry sort. (commit `45e73af`)

## Digest push notification type error
**Cause:** Weekly digest function sent wrong notification type value.
**Fix:** Corrected digest type enum in weekly-digest Edge Function. (commit `23367e4`)

## Pantry `is_active` filter missing — deleted items reappear
**Cause:** Pantry queries didn't filter on `is_active = true`, so soft-deleted items showed in list.
**Fix:** Add `.eq('is_active', true)` to all pantry read queries. (commit `23367e4`)

## Duplicate appointments created on rapid tap
**Cause:** No debounce/guard on appointment creation — multiple taps fire multiple inserts.
**Fix:** Add creation guard (disable button after first tap until response). (commit `23367e4`)

## Restock action missing when duplicate UPC detected
**Cause:** `checkDuplicateUpc()` returned boolean but the restock flow needed the existing item's ID.
**Fix:** `checkDuplicateUpc` now returns the item ID. ResultScreen calls `restockPantryItem` with the returned ID. (commit `e4b8703`)

## Treats-only pantry shows silent empty state instead of warning
**Cause:** Diet completeness banner only checked for daily food items. A pantry with only treats appeared "complete."
**Fix:** Show red diet warning when pantry has treats but no daily food. (commit `e4b8703`)

## EditPantryItemScreen crash on delete
**Cause:** Early return guard (`if (!item)`) was placed between hooks — React rules of hooks violation.
**Fix:** Move guard after all hooks. Add null safety to hook bodies. (ROADMAP.md M5 bugfix note)

## "Log a Treat" from PetHub opens stale Result screen
**Cause:** Navigation went to existing Result screen in the Scan stack instead of resetting to camera.
**Fix:** Navigate to `Scan` → `ScanMain` to reset the stack. (ROADMAP.md M5 bugfix note)

## AddToPantrySheet shows generic "Failed to add" error
**Cause:** Supabase error was swallowed — user saw "Failed to add to pantry" with no detail.
**Fix:** Surface actual Supabase error message in the alert. (ROADMAP.md M5 bugfix note)

## Python import scripts fail on Python 3.9 (type annotations)
**Cause:** Scripts used `str | None` syntax (Python 3.10+). Server runs Python 3.9.
**Fix:** Replace `str | None` with `Optional[str]` across ingredient_matcher, parse_ingredients, and hash_utils. (commit `3775efd`)

## Severity alignment off — 862 ingredients with wrong severity
**Cause:** Ingredient dictionary had severity values that drifted from the scoring engine's calculated severity.
**Fix:** Batch re-alignment script, re-scored 4,620 products. (commit `d890aaf`)

## "Perfectly Healthy" chip shows stale data
**Cause:** Stale closure in the chip's onPress handler — captured old pet state.
**Fix:** Use fresh state reference in handler. (commit `1e599fa`)
