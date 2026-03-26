# Scoring Engine

Pure functions only — no Supabase, no side effects, no React imports.
Brand-blind (D-019). Affiliate-invisible (D-020).

## Pipeline bypass order (checked in pipeline.ts, not engine.ts)
1. Vet diet (D-135) → bypass, no score
2. Species mismatch (D-144) → bypass, no score
3. Variety pack (D-145) → bypass, no score
4. Recalled product (D-158) → bypass, warning + ingredients only
5. Supplemental → reduced weights (65/35/0)
6. Normal → full weights (55/30/15)

## Critical field gotchas
- DCM: use `is_pulse` / `is_pulse_protein` — NEVER `is_legume`
- Splitting: use `cluster_id` — NEVER string matching
- Position reduction: check `position_reduction_eligible` flag
- Wet food moisture: infer from `product_form` when `ga_moisture_pct` is null

## Regression anchors (verify after ANY change)
- Pure Balance (Dog, daily food) = 62
- Temptations (Cat, treat) = 9

## Testing
Run: `npx jest --testPathPattern=scoring`
