-- Migration 006: Add content columns for curated ingredient data
-- Supports Tier 3 (vitamins/minerals) species-specific context and
-- primary concern basis across all tiers.

ALTER TABLE ingredients_dict ADD COLUMN IF NOT EXISTS primary_concern_basis TEXT;
ALTER TABLE ingredients_dict ADD COLUMN IF NOT EXISTS base_description TEXT;
ALTER TABLE ingredients_dict ADD COLUMN IF NOT EXISTS dog_context TEXT;
ALTER TABLE ingredients_dict ADD COLUMN IF NOT EXISTS cat_context TEXT;
