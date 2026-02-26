-- Kiba — Initial Schema
-- 11 tables with RLS on all user-data tables

-- ─── Extensions ─────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Products ────────────────────────────────────────

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand         TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('daily_food', 'treat', 'supplement')),
  species       TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  life_stages   TEXT[] NOT NULL DEFAULT '{}',
  image_url     TEXT,

  -- Guaranteed Analysis
  ga_protein_min    NUMERIC,
  ga_fat_min        NUMERIC,
  ga_fiber_max      NUMERIC,
  ga_moisture_max   NUMERIC,
  ga_ash_max        NUMERIC,
  ga_calcium_min    NUMERIC,
  ga_calcium_max    NUMERIC,
  ga_phosphorus_min NUMERIC,
  ga_phosphorus_max NUMERIC,
  ga_omega3         NUMERIC,
  ga_omega6         NUMERIC,
  ga_dha            NUMERIC,
  ga_epa            NUMERIC,
  ga_taurine        NUMERIC,
  ga_glucosamine    NUMERIC,
  ga_chondroitin    NUMERIC,
  ga_l_carnitine    NUMERIC,
  ga_zinc           NUMERIC,
  ga_probiotics     BOOLEAN,

  -- Formulation
  aafco_statement   TEXT NOT NULL DEFAULT 'none' CHECK (aafco_statement IN ('complete', 'supplemental', 'treat', 'none')),
  preservative_type TEXT NOT NULL DEFAULT 'unknown' CHECK (preservative_type IN ('natural', 'artificial', 'none', 'unknown')),
  has_named_protein BOOLEAN NOT NULL DEFAULT FALSE,

  -- Tracking
  ingredients_hash  TEXT,
  affiliate_links   JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_species_category ON products (species, category);

-- ─── 2. Product UPCs ────────────────────────────────────

CREATE TABLE product_upcs (
  upc         TEXT PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_upcs_product_id ON product_upcs (product_id);

-- ─── 3. Ingredients Dictionary ──────────────────────────

CREATE TABLE ingredients_dict (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name              TEXT NOT NULL UNIQUE,
  cluster_id                  TEXT,
  allergen_group              TEXT,
  severity_dog                TEXT NOT NULL DEFAULT 'none' CHECK (severity_dog IN ('none', 'low', 'moderate', 'high', 'critical')),
  severity_cat                TEXT NOT NULL DEFAULT 'none' CHECK (severity_cat IN ('none', 'low', 'moderate', 'high', 'critical')),
  concern_type                TEXT,
  position_reduction_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  citation_source             TEXT NOT NULL,
  notes                       TEXT
);

CREATE INDEX idx_ingredients_dict_cluster_id ON ingredients_dict (cluster_id);

-- ─── 4. Product Ingredients ─────────────────────────────

CREATE TABLE product_ingredients (
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients_dict(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE INDEX idx_product_ingredients_product_id ON product_ingredients (product_id);

-- ─── 5. Pet Profiles ────────────────────────────────────

CREATE TABLE pet_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  species     TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
  breed       TEXT,
  age_years   INTEGER,
  age_months  INTEGER,
  weight_kg   NUMERIC,
  goal_weight NUMERIC,
  life_stage  TEXT NOT NULL DEFAULT 'adult' CHECK (life_stage IN ('puppy', 'kitten', 'adult', 'senior')),
  photo_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pet_profiles_user_id ON pet_profiles (user_id);

ALTER TABLE pet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_profiles_owner ON pet_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. Pet Conditions ──────────────────────────────────

CREATE TABLE pet_conditions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id         UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  condition_tag  TEXT NOT NULL,
  UNIQUE (pet_id, condition_tag)
);

ALTER TABLE pet_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_conditions_owner ON pet_conditions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pet_profiles WHERE pet_profiles.id = pet_conditions.pet_id AND pet_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pet_profiles WHERE pet_profiles.id = pet_conditions.pet_id AND pet_profiles.user_id = auth.uid())
  );

-- ─── 7. Pet Allergens ───────────────────────────────────

CREATE TABLE pet_allergens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  allergen_group  TEXT NOT NULL,
  UNIQUE (pet_id, allergen_group)
);

ALTER TABLE pet_allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_allergens_owner ON pet_allergens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pet_profiles WHERE pet_profiles.id = pet_allergens.pet_id AND pet_profiles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pet_profiles WHERE pet_profiles.id = pet_allergens.pet_id AND pet_profiles.user_id = auth.uid())
  );

-- ─── 8. Scan History ────────────────────────────────────

CREATE TABLE scan_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  pet_id           UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score_breakdown  JSONB NOT NULL,
  scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  user_id         UUID NOT NULL,
  pet_id          UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serving_format  TEXT,
  pack_size       TEXT,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_user_id ON pantry_items (user_id);

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_items_owner ON pantry_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 10. Symptom Logs ───────────────────────────────────

CREATE TABLE symptom_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  pet_id        UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  symptom_type  TEXT NOT NULL CHECK (symptom_type IN ('vomiting', 'diarrhea', 'itching', 'lethargy', 'refusal')),
  severity      TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('none', 'low', 'moderate', 'high', 'critical')),
  notes         TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symptom_logs_user_id ON symptom_logs (user_id);

ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY symptom_logs_owner ON symptom_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 11. Kiba Index Votes ───────────────────────────────

CREATE TABLE kiba_index_votes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  pet_id       UUID NOT NULL REFERENCES pet_profiles(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  taste_score  INTEGER NOT NULL CHECK (taste_score BETWEEN 1 AND 5),
  tummy_score  INTEGER NOT NULL CHECK (tummy_score BETWEEN 1 AND 5),
  voted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pet_id, product_id)
);

ALTER TABLE kiba_index_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY kiba_index_votes_owner ON kiba_index_votes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
