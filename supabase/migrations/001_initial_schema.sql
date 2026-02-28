-- Kiba — Initial Schema Migration
-- 11 tables with RLS on all user-data tables
-- Matches ROADMAP.md schema spec exactly
-- Includes D-097, D-098, D-105, D-110 requirements

-- ─── Extensions ─────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Helper: updated_at trigger ─────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Products ────────────────────────────────────────

CREATE TABLE products (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand                   TEXT NOT NULL,
  name                    TEXT NOT NULL,
  category                TEXT NOT NULL CHECK (category IN ('daily_food', 'treat', 'supplement')),
  target_species          TEXT NOT NULL CHECK (target_species IN ('dog', 'cat')),
  source                  TEXT NOT NULL CHECK (source IN ('scraped', 'community', 'curated')),

  -- Formulation
  aafco_statement         TEXT,                -- e.g. 'All Life Stages', 'Adult Maintenance'
  life_stage_claim        TEXT,
  preservative_type       TEXT CHECK (preservative_type IN ('natural', 'synthetic', 'mixed', 'unknown')),

  -- Guaranteed Analysis — core macros
  ga_protein_pct          DECIMAL(5,2),
  ga_fat_pct              DECIMAL(5,2),
  ga_fiber_pct            DECIMAL(5,2),
  ga_moisture_pct         DECIMAL(5,2),        -- CRITICAL for DMB conversion
  ga_calcium_pct          DECIMAL(5,3),        -- D-104 ash estimation: ash ≈ (Ca + P) × 2.5
  ga_phosphorus_pct       DECIMAL(5,3),        -- D-104 ash estimation: ash ≈ (Ca + P) × 2.5

  -- Guaranteed Analysis — calorie info
  ga_kcal_per_cup         INT,
  ga_kcal_per_kg          INT,
  kcal_per_unit           INT,                 -- single-serve items (pouches, sticks, chews)
  unit_weight_g           DECIMAL,             -- weight per single unit (e.g. 85g pouch)
  default_serving_format  TEXT CHECK (default_serving_format IN ('bulk', 'unit_count', 'cans')),

  -- Guaranteed Analysis — bonus/supplemental nutrients
  ga_taurine_pct          DECIMAL(5,3),
  ga_l_carnitine_mg       DECIMAL(8,2),
  ga_dha_pct              DECIMAL(5,3),
  ga_omega3_pct           DECIMAL(5,3),
  ga_omega6_pct           DECIMAL(5,3),
  ga_zinc_mg_kg           DECIMAL(8,2),
  ga_probiotics_cfu       TEXT,                -- text because CFU notation varies

  -- Data provenance
  nutritional_data_source TEXT CHECK (nutritional_data_source IN ('manual', 'llm_extracted')),
  ingredients_raw         TEXT,                -- original scraped ingredient text
  ingredients_hash        TEXT,                -- for formula change detection

  -- Flags
  is_recalled             BOOLEAN NOT NULL DEFAULT false,
  is_grain_free           BOOLEAN NOT NULL DEFAULT false,
  score_confidence        TEXT NOT NULL DEFAULT 'high',
  needs_review            BOOLEAN NOT NULL DEFAULT false,  -- community contributions pending moderation

  -- Tracking
  last_verified_at        TIMESTAMPTZ,
  formula_change_log      JSONB,
  affiliate_links         JSONB,               -- INVISIBLE to scoring engine

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_species_category ON products (target_species, category);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Product UPCs ────────────────────────────────────
-- Junction table: UPC → product_id (NOT TEXT[] array)

CREATE TABLE product_upcs (
  upc         TEXT PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_upcs_upc ON product_upcs USING btree (upc);
CREATE INDEX idx_product_upcs_product_id ON product_upcs (product_id);

-- ─── 3. Ingredients Dictionary ──────────────────────────
-- Canonical ingredients with severity, flags, D-098 allergen columns, D-105 display columns

CREATE TABLE ingredients_dict (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name              TEXT NOT NULL UNIQUE,
  cluster_id                  TEXT,              -- for splitting detection (e.g. 'legume_pea')

  -- D-098: allergen mapping
  allergen_group              TEXT,              -- maps to protein family (e.g. 'chicken', 'beef')
  allergen_group_possible     TEXT[],            -- unnamed terms that COULD contain allergens

  -- Severity per species
  dog_base_severity           TEXT NOT NULL DEFAULT 'neutral'
                              CHECK (dog_base_severity IN ('danger', 'caution', 'neutral', 'good')),
  cat_base_severity           TEXT NOT NULL DEFAULT 'neutral'
                              CHECK (cat_base_severity IN ('danger', 'caution', 'neutral', 'good')),

  -- Scoring flags
  is_unnamed_species          BOOLEAN NOT NULL DEFAULT false,
  is_legume                   BOOLEAN NOT NULL DEFAULT false,
  position_reduction_eligible BOOLEAN NOT NULL DEFAULT false,
  cat_carb_flag               BOOLEAN NOT NULL DEFAULT false,

  -- D-105: display content columns for ingredient detail modals
  display_name                TEXT,              -- full name with chemical name, e.g. "BHA (Butylated Hydroxyanisole)"
  definition                  TEXT,              -- one sentence — what this ingredient physically is
  tldr                        TEXT,              -- 2-3 sentences, engaging summary
  detail_body                 TEXT,              -- full explanation, 1-2 paragraphs
  citations_display           TEXT,               -- plain text citations for UI footer
  position_context            TEXT,              -- explains whether concern is amount-based or presence-based

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_dict_cluster_id ON ingredients_dict (cluster_id);
CREATE INDEX idx_ingredients_dict_allergen_group ON ingredients_dict (allergen_group);

-- ─── 4. Product Ingredients ─────────────────────────────
-- Junction: links products to ingredients with label position

CREATE TABLE product_ingredients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES ingredients_dict(id) ON DELETE CASCADE,
  position        INT NOT NULL,                  -- label order (1 = first listed)
  UNIQUE (product_id, position)
);

CREATE INDEX idx_product_ingredients_product_id ON product_ingredients (product_id);

-- ─── 5. Pets ────────────────────────────────────────────
-- D-110: canonical table name is 'pets' (NOT 'pet_profiles')

CREATE TABLE pets (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  species                   TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  breed                     TEXT,
  weight_lbs                DECIMAL(5,2),        -- nullable: D-092 scan-first onboarding only captures name + species
  goal_weight_lbs           DECIMAL(5,2),        -- null = no weight management mode
  birth_date                DATE,                -- used to derive life_stage
  life_stage                TEXT,                -- derived, never user-entered
  activity_level            TEXT NOT NULL DEFAULT 'moderate'
                            CHECK (activity_level IN ('sedentary', 'moderate', 'active', 'working')),
  is_spayed_neutered        BOOLEAN NOT NULL DEFAULT true,
  is_indoor                 BOOLEAN,             -- cats only, affects DER multiplier
  allergies                 TEXT[],
  weight_loss_target_rate   DECIMAL(5,3),        -- calculated, warns if >1% for cats
  photo_url                 TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pets_user_id ON pets (user_id);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY pets_owner ON pets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 6. Pet Conditions ──────────────────────────────────
-- D-097: many-to-many (pet → condition_tag)
-- e.g. 'joint', 'ckd', 'allergy', 'obesity', 'underweight'

CREATE TABLE pet_conditions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  condition_tag   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, condition_tag)
);

ALTER TABLE pet_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_conditions_owner ON pet_conditions
  FOR ALL USING (
    pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
  );

-- ─── 7. Pet Allergens ───────────────────────────────────
-- D-097: many-to-many (pet → allergen)
-- Only populated when 'allergy' condition exists in pet_conditions

CREATE TABLE pet_allergens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  allergen        TEXT NOT NULL,                  -- e.g. 'beef', 'chicken', 'dairy', or free text for 'other'
  is_custom       BOOLEAN NOT NULL DEFAULT false, -- true for "Other" free text entries
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, allergen)
);

ALTER TABLE pet_allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_allergens_owner ON pet_allergens
  FOR ALL USING (
    pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
  );

-- ─── 8. Scan History ────────────────────────────────────

CREATE TABLE scan_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id          UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  final_score     INT,
  score_breakdown JSONB NOT NULL,                -- full Layer 1/2/3 snapshot
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_history_user_id ON scan_history (user_id);
CREATE INDEX idx_scan_history_pet_id ON scan_history (pet_id);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY scan_history_owner ON scan_history
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 9. Pantry Items ────────────────────────────────────

CREATE TABLE pantry_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id          UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role            TEXT CHECK (role IN ('daily_food', 'treat', 'supplement', 'topper')),
  serving_format  TEXT CHECK (serving_format IN ('bulk', 'unit_count', 'cans')),
  pack_size_value DECIMAL,                       -- bag weight (bulk) OR unit count (pouches/sticks/cans)
  pack_size_unit  TEXT CHECK (pack_size_unit IN ('lb', 'oz', 'kg', 'units')),
  is_active       BOOLEAN NOT NULL DEFAULT true,  -- false = removed but kept in history
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_user_id ON pantry_items (user_id);

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_items_owner ON pantry_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 10. Symptom Logs ───────────────────────────────────

CREATE TABLE symptom_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,  -- what they were eating
  symptom     TEXT NOT NULL CHECK (symptom IN ('itchy', 'vomit', 'loose', 'low_energy', 'great')),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symptom_logs_user_id ON symptom_logs (user_id);
CREATE INDEX idx_symptom_logs_pet_id ON symptom_logs (pet_id);

ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY symptom_logs_owner ON symptom_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 11. Kiba Index Votes ───────────────────────────────

CREATE TABLE kiba_index_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  taste_vote  TEXT NOT NULL CHECK (taste_vote IN ('loved', 'picky', 'refused')),
  tummy_vote  TEXT NOT NULL CHECK (tummy_vote IN ('perfect', 'soft_stool', 'upset')),
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pet_id, product_id)           -- one vote per pet per product
);

ALTER TABLE kiba_index_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY kiba_index_votes_owner ON kiba_index_votes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
