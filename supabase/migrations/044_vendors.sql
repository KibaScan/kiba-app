-- Migration 044: Vendors (brand contact directory, admin-curated via Studio)
-- Public read for published vendors; all writes via service role only.
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  contact_email TEXT,
  website_url TEXT,
  parent_company TEXT,
  headquarters_country TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX vendors_published_idx ON vendors (brand_slug) WHERE is_published = true;

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published vendors" ON vendors
  FOR SELECT TO anon, authenticated USING (is_published = true);
-- Writes: service role only.
