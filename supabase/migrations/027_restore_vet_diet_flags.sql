-- Migration 027: Restore is_vet_diet flags lost during v7 reimport
-- The v7 import script (import_products.py) mapped is_supplemental but NOT
-- is_vet_diet, so all 472 vet diet products defaulted to false.
-- D-135 vet diet bypass has been silently broken since the v7 reimport.
-- Source: dataset_kiba_v7_master.json _is_vet_diet field.

-- ─── Step 1: Brand-pattern match (~444 products) ─────────────
-- Covers Hill's Prescription Diet, Royal Canin Veterinary Diet,
-- Purina Pro Plan Veterinary Diets, Blue Buffalo Natural Veterinary Diet,
-- Tiki Cat Veterinary Solutions, Farmina Vet Life, and Amazon
-- locale-prefixed variants (Visita la tienda de..., Besuche den...).

UPDATE products SET is_vet_diet = true
WHERE needs_review = false
  AND is_vet_diet = false
  AND (
    brand ILIKE '%Prescription Diet%'
    OR brand ILIKE '%Veterinary Diet%'
    OR brand ILIKE '%Veterinary Diets%'
    OR brand ILIKE '%Veterinary Formula%'
    OR brand ILIKE '%Veterinary Sciences%'
    OR brand ILIKE '%Veterinary Solutions%'
    OR brand ILIKE '%Natural Veterinary%'
    OR brand ILIKE '%Vet Life%'
  );

-- ─── Step 2: ROYAL CANIN (all-caps brand, vet products) ─────
-- These Amazon listings use "ROYAL CANIN" as brand but product names
-- contain "Veterinary Diet" or are known prescription formulas.
-- ILIKE catches "ROYAL CANIN" and "Visita la tienda de ROYAL CANIN".

UPDATE products SET is_vet_diet = true
WHERE needs_review = false
  AND is_vet_diet = false
  AND brand ILIKE '%ROYAL CANIN%'
  AND brand NOT ILIKE '%Veterinary Diet%'  -- already caught by Step 1
  AND (
    name ILIKE '%Veterinary Diet%'
    OR name ILIKE '%Renal Support%'
    OR name ILIKE '%Hydrolyzed Protein%'
    OR name ILIKE '%Hypoallergenic%'
    OR name ILIKE '%Urinary SO%'
    OR name ILIKE '%Hepatic%'
    OR name ILIKE '%Gastrointestinal%'
    OR name ILIKE '%Cardiac%'
    OR name ILIKE '%Dental%Dry%'
    OR name ILIKE '%Mobility Support%'
    OR name ILIKE '%Skintopic%'
    OR name ILIKE '%Dieta veterinaria%'
  );

-- ─── Step 3: Remaining one-off products ──────────────────────
-- From brands that aren't exclusively vet (Blue Buffalo, JustFoodForDogs, etc.)

UPDATE products SET is_vet_diet = true
WHERE needs_review = false
  AND is_vet_diet = false
  AND (
    -- JustFoodForDogs veterinary diet products
    (brand = 'JustFoodForDogs' AND name ILIKE '%Veterinary Diet%')
    -- Blue Buffalo vet products listed under generic "Blue Buffalo" brand
    OR (brand = 'Blue Buffalo' AND name ILIKE '%Natural Veterinary Diet%')
    -- Diamond Care renal formula
    OR (brand = 'DIAMOND CARE' AND name ILIKE '%Renal%')
    -- Coco and Luna hepatic support
    OR (brand = 'Coco and Luna' AND name ILIKE '%Hepatic Support%')
    -- Forza10 renal/kidney formula
    OR (brand ILIKE 'Forza10' AND name ILIKE '%Renal%')
  );

-- ─── Step 4: Invalidate stale pet_product_scores cache ───────
-- Vet diet products should not have scores (D-135 bypass).

DELETE FROM pet_product_scores
WHERE product_id IN (
  SELECT id FROM products WHERE is_vet_diet = true
);
