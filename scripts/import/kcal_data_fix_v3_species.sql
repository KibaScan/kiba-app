-- ================================================================
-- KIBA kcal/kg DATA FIX — March 2026 (v3 — species-specific)
-- Source: 7,380 products across 2 Chewy scraper datasets
--   Dataset 1: mostly dog food (87% dog, 13% cat)
--   Dataset 2: 100% cat food
-- Run in Supabase SQL Editor. Run each step separately.
-- ================================================================


-- ============================================================
-- STEP 0: DIAGNOSTIC — current state
-- ============================================================

SELECT target_species, product_form,
  CASE 
    WHEN ga_kcal_per_kg IS NULL THEN 'NULL'
    WHEN product_form = 'dry' AND ga_kcal_per_kg < 2500 THEN 'BAD'
    WHEN product_form = 'wet' AND ga_kcal_per_kg < 200 THEN 'BAD'
    ELSE 'OK'
  END AS status,
  COUNT(*) AS cnt
FROM products
WHERE category = 'daily_food' AND product_form IN ('dry', 'wet')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;


-- ============================================================
-- STEP 1: DRY DOG FOOD
-- ============================================================
-- Ratio: 9.37 cups/kg (median from 227 verified dog products)
-- 1 cup dog kibble ≈ 107g
-- Accuracy: median 6.7% error, 67% within 10%

-- 1a: Fix bad values
UPDATE products
SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 9.37)
WHERE product_form = 'dry'
  AND target_species = 'dog'
  AND ga_kcal_per_kg IS NOT NULL
  AND ga_kcal_per_kg < 2500
  AND ga_kcal_per_cup IS NOT NULL
  AND ga_kcal_per_cup BETWEEN 250 AND 550;

-- 1b: Fill NULLs
UPDATE products
SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 9.37)
WHERE product_form = 'dry'
  AND target_species = 'dog'
  AND ga_kcal_per_kg IS NULL
  AND ga_kcal_per_cup IS NOT NULL
  AND ga_kcal_per_cup BETWEEN 250 AND 550;


-- ============================================================
-- STEP 2: DRY CAT FOOD
-- ============================================================
-- Ratio: 8.79 cups/kg (median from 76 verified cat products)
-- 1 cup cat kibble ≈ 114g (denser than dog kibble)
-- Accuracy: median 7.8% error, 68% within 10%

-- 2a: Fix bad values
UPDATE products
SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 8.79)
WHERE product_form = 'dry'
  AND target_species = 'cat'
  AND ga_kcal_per_kg IS NOT NULL
  AND ga_kcal_per_kg < 2500
  AND ga_kcal_per_cup IS NOT NULL
  AND ga_kcal_per_cup BETWEEN 250 AND 550;

-- 2b: Fill NULLs
UPDATE products
SET ga_kcal_per_kg = ROUND(ga_kcal_per_cup * 8.79)
WHERE product_form = 'dry'
  AND target_species = 'cat'
  AND ga_kcal_per_kg IS NULL
  AND ga_kcal_per_cup IS NOT NULL
  AND ga_kcal_per_cup BETWEEN 250 AND 550;


-- ============================================================
-- STEP 3: WET DOG FOOD
-- ============================================================
-- Dry-matter calorie density: 4415 kcal/kg (from 293 verified)
-- Formula: kcal_per_kg = 4415 × (100 - moisture) / 90
-- Only fixes products failing plausibility check

UPDATE products
SET ga_kcal_per_kg = ROUND(4415.0 * (100 - ga_moisture_pct) / 90)
WHERE product_form = 'wet'
  AND target_species = 'dog'
  AND ga_kcal_per_kg IS NOT NULL
  AND ga_moisture_pct IS NOT NULL
  AND ga_moisture_pct > 12
  AND ga_moisture_pct < 99
  AND (
    (ga_kcal_per_kg * 0.90 / ((100 - ga_moisture_pct) / 100.0)) < 2500
    OR
    (ga_kcal_per_kg * 0.90 / ((100 - ga_moisture_pct) / 100.0)) > 6000
  );


-- ============================================================
-- STEP 4: WET CAT FOOD
-- ============================================================
-- Dry-matter calorie density: 4200 kcal/kg (from 683 verified)
-- Cat wet food runs ~5% less calorie-dense on dry matter basis

UPDATE products
SET ga_kcal_per_kg = ROUND(4200.0 * (100 - ga_moisture_pct) / 90)
WHERE product_form = 'wet'
  AND target_species = 'cat'
  AND ga_kcal_per_kg IS NOT NULL
  AND ga_moisture_pct IS NOT NULL
  AND ga_moisture_pct > 12
  AND ga_moisture_pct < 99
  AND (
    (ga_kcal_per_kg * 0.90 / ((100 - ga_moisture_pct) / 100.0)) < 2500
    OR
    (ga_kcal_per_kg * 0.90 / ((100 - ga_moisture_pct) / 100.0)) > 6000
  );


-- ============================================================  
-- STEP 5: VALIDATION
-- ============================================================

-- 5a: Blue Buffalo Small Breed (dog) → should be ~3730
--     398 cup × 9.37 = 3729. Manufacturer says 3819. Error: 2.4%
SELECT name, target_species, ga_kcal_per_kg, ga_kcal_per_cup
FROM products
WHERE name ILIKE '%Blue Buffalo%Life Protection%Small Breed%'
  AND product_form = 'dry'
LIMIT 3;

-- 5b: Distribution post-fix by species
SELECT target_species, product_form,
  CASE 
    WHEN ga_kcal_per_kg IS NULL THEN 'NULL'
    WHEN product_form = 'dry' AND ga_kcal_per_kg < 2500 THEN 'STILL BAD'
    WHEN product_form = 'dry' AND ga_kcal_per_kg BETWEEN 2500 AND 3499 THEN '2500-3499'
    WHEN product_form = 'dry' AND ga_kcal_per_kg BETWEEN 3500 AND 4499 THEN '3500-4499'
    WHEN product_form = 'dry' AND ga_kcal_per_kg >= 4500 THEN '4500+'
    WHEN product_form = 'wet' AND ga_kcal_per_kg < 200 THEN 'STILL BAD'
    WHEN product_form = 'wet' AND ga_kcal_per_kg BETWEEN 200 AND 799 THEN '200-799'
    WHEN product_form = 'wet' AND ga_kcal_per_kg BETWEEN 800 AND 1199 THEN '800-1199'
    WHEN product_form = 'wet' AND ga_kcal_per_kg >= 1200 THEN '1200+'
  END AS bucket,
  COUNT(*) AS cnt
FROM products
WHERE category = 'daily_food' AND product_form IN ('dry', 'wet')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- 5c: Pantry sanity — cups in 15lb bag
SELECT name, ga_kcal_per_kg, ga_kcal_per_cup,
       ROUND((6.804 * ga_kcal_per_kg) / NULLIF(ga_kcal_per_cup, 0), 1) AS cups_per_15lb
FROM products
WHERE name ILIKE '%Blue Buffalo%Life Protection%Small Breed%'
  AND product_form = 'dry'
LIMIT 1;

-- 5d: Remaining unfixable
SELECT target_species, product_form, COUNT(*) AS unfixable
FROM products
WHERE category = 'daily_food' 
  AND product_form IN ('dry', 'wet')
  AND (ga_kcal_per_kg IS NULL OR 
       (product_form = 'dry' AND ga_kcal_per_kg < 2500) OR
       (product_form = 'wet' AND ga_kcal_per_kg < 200))
GROUP BY 1, 2
ORDER BY 1, 2;
