# Session 1 Context — Batch Scoring + Category Averages

## Goal
Score all products that have sufficient data, compute category averages for benchmark bar.

## Product Segments (D-132)
8 segments, each gets a separate average:
1. daily_food x dog x grain_free
2. daily_food x dog x not_grain_free
3. daily_food x cat x grain_free
4. daily_food x cat x not_grain_free
5. treat x dog x grain_free
6. treat x dog x not_grain_free
7. treat x cat x grain_free
8. treat x cat x not_grain_free

## Scoring Rules for Batch
- Layer 1 (Base Score): ingredient quality + nutritional + formulation
- Layer 2 (Species Rules): DCM advisory, cat carb overload, etc.
- NO Layer 3 (Personalization): no pet to personalize against -- these are generic averages
- Products with score_confidence = 'partial' (no GA): EXCLUDE from averages
  (their 78/22 reweight would skew averages downward)
- Supplements: SKIP entirely (D-096 -- not scored)
- Products with ingredients_raw IS NULL: SKIP (can't score without ingredients)

## Expected Counts
- Full-score-ready products (ingredients + GA): ~4,500+ (after M3 refinery)
- Treats use 100/0/0 weighting (ingredient quality only) -- no GA needed for treat averages
- For treats: include all products with parsed ingredients, even without GA

## Output: category_averages Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| category | TEXT | 'daily_food' or 'treat' |
| target_species | TEXT | 'dog' or 'cat' |
| is_grain_free | BOOLEAN | true or false |
| avg_score | DECIMAL(5,1) | Average base score (Layer 1 + 2) |
| median_score | DECIMAL(5,1) | Median base score |
| min_score | DECIMAL(5,1) | Lowest score in segment |
| max_score | DECIMAL(5,1) | Highest score in segment |
| product_count | INTEGER | Number of products in this segment |
| computed_at | TIMESTAMPTZ | When averages were last computed |

## Score Ring Color Breakpoints (D-113)
Benchmark bar gradient uses same palette:
- 80+: Green (#34C759)
- 70-79: Cyan (#00B4D8)
- 50-69: Amber (#FF9500)
- <50: Red (#FF3B30)

## Files Created
- `supabase/migrations/005_category_averages.sql` -- table migration
- `scripts/scoring/batch_score.ts` -- batch scoring + average computation
- `src/components/BenchmarkBar.tsx` -- React Native benchmark bar component
