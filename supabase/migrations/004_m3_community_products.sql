-- M3 Session 4: Community product contributions (D-128)
-- New columns on products table for Haiku classification + community attribution

ALTER TABLE products ADD COLUMN IF NOT EXISTS contributed_by UUID REFERENCES auth.users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS haiku_suggested_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS haiku_suggested_species TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_corrected_category BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_corrected_species BOOLEAN DEFAULT false;

-- ga_calcium_pct and ga_phosphorus_pct (referenced in types but missing from DB)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_calcium_pct DECIMAL(5,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_phosphorus_pct DECIMAL(5,3);
