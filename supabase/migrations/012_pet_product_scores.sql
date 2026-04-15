-- Migration 012: pet_product_scores cache table (M5 Top Matches)
-- Caches per-pet product scores for the Top Matches feature.
-- Lazy invalidation via anchors (life stage, profile edit, health update, engine version).
-- See TOP_MATCHES_PLAN.md Phase 1.

BEGIN;

CREATE TABLE pet_product_scores (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id                 UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id             UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Cached score data (list view only — full breakdown computed on tap)
  final_score            SMALLINT NOT NULL,
  is_partial_score       BOOLEAN NOT NULL DEFAULT false,
  is_supplemental        BOOLEAN NOT NULL DEFAULT false,
  category               TEXT NOT NULL CHECK (category IN ('daily_food', 'treat')),

  -- Invalidation anchors (snapshot at scoring time)
  life_stage_at_scoring  TEXT,
  pet_updated_at         TIMESTAMPTZ NOT NULL,
  pet_health_reviewed_at TIMESTAMPTZ,
  product_updated_at     TIMESTAMPTZ NOT NULL,

  -- Metadata
  scored_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scoring_version        TEXT NOT NULL DEFAULT '1',

  UNIQUE (pet_id, product_id)
);

-- Top matches query: sorted by score within category
CREATE INDEX idx_pps_pet_category_score
  ON pet_product_scores (pet_id, category, final_score DESC);

-- RLS: users see only their own pets' scores
ALTER TABLE pet_product_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY pps_owner ON pet_product_scores
  FOR ALL USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()))
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));

COMMIT;
