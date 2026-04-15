-- Migration 036: Synthesize AAFCO statement text from life_stage_claim
--
-- Problem: Scrapers captured "yes", "likely", "unknown" instead of actual
-- AAFCO statement text. 100% of products have bad data, causing the
-- Formulation Quality bucket to penalize every product incorrectly.
--
-- Fix: Derive proper AAFCO text from life_stage_claim (99.9% populated).
-- Only updates non-descriptive values; leaves real text untouched.

UPDATE products
SET
  aafco_statement = CASE life_stage_claim
    WHEN 'all life stages' THEN 'All Life Stages'
    WHEN 'puppy/kitten'    THEN 'Growth and Reproduction'
    WHEN 'adult'           THEN 'Adult Maintenance'
    WHEN 'senior'          THEN 'Adult Maintenance'
  END,
  aafco_inference = 'life_stage_derived'
WHERE life_stage_claim IS NOT NULL
  AND life_stage_claim IN ('all life stages', 'puppy/kitten', 'adult', 'senior')
  AND (aafco_statement IS NULL
       OR aafco_statement IN ('yes', 'likely', 'unknown', ''));

-- Invalidate all cached scores — formulation scores changed globally
DELETE FROM pet_product_scores;
