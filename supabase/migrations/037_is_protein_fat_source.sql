-- Migration 037: Add is_protein_fat_source flag to ingredients_dict
-- Enables Layer 1c protein naming specificity scoring (was hardcoded false since M1)
-- and condition scoring protein source count (countDistinctProteinSources)

ALTER TABLE ingredients_dict ADD COLUMN is_protein_fat_source BOOLEAN NOT NULL DEFAULT FALSE;

-- Invalidate all cached scores — protein naming sub-score changes globally
DELETE FROM pet_product_scores;
