-- Kiba — Category Averages for Benchmark Bar (D-132)
-- 8 segments: category × species × grain-free
-- Populated by batch scoring script, consumed by BenchmarkBar.tsx

CREATE TABLE category_averages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        TEXT NOT NULL CHECK (category IN ('daily_food', 'treat')),
  target_species  TEXT NOT NULL CHECK (target_species IN ('dog', 'cat')),
  is_grain_free   BOOLEAN NOT NULL,
  avg_score       DECIMAL(5,1) NOT NULL,
  median_score    DECIMAL(5,1) NOT NULL,
  min_score       DECIMAL(5,1) NOT NULL,
  max_score       DECIMAL(5,1) NOT NULL,
  product_count   INTEGER NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (category, target_species, is_grain_free)
);

-- No RLS needed — this is public aggregate data, not user-specific

-- ─── Product base_score columns (batch scoring writes back per-product) ──

ALTER TABLE products ADD COLUMN IF NOT EXISTS base_score DECIMAL(5,1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_score_computed_at TIMESTAMPTZ;

-- ─── Ingredient review provenance ───────────────────────────────────────

ALTER TABLE ingredients_dict ADD COLUMN IF NOT EXISTS review_status TEXT
  CHECK (review_status IN ('manual', 'llm_generated', 'llm_needs_review'));
