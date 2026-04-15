-- Migration 024: Fix supplemental product data
-- 124 products missing is_supplemental = true (toppers, mixers, lickables, sprinkles)
-- 2 oil products miscategorized as daily_food (should be supplement)
-- Clear AAFCO for supplemental products
-- Invalidate stale pet_product_scores cache

-- ─── 1A. Set is_supplemental = true for 124 products ───────────

-- 88 products by UPC (via product_upcs junction table)
UPDATE products SET is_supplemental = true
WHERE id IN (
  SELECT product_id FROM product_upcs WHERE upc IN (
    '00640461003273',
    '00640461003297',
    '018214852360',
    '022517446843',
    '022517446898',
    '022517446904',
    '050000659784',
    '050000659807',
    '064992725716',
    '064992725723',
    '064992725747',
    '064992725754',
    '073101004994',
    '076344012467',
    '10023100136186',
    '10023100137725',
    '10060992920042',
    '10840243103079',
    '10840243152756',
    '10878968003183',
    '10878968003190',
    '10878968003206',
    '10878968003213',
    '10878968003220',
    '10878968003237',
    '10878968003251',
    '10878968003404',
    '10878968003411',
    '10878968003435',
    '10878968003442',
    '10878968003459',
    '10878968003633',
    '10878968003664',
    '10878968003695',
    '5391532820460',
    '693804491657',
    '693804491671',
    '693804491923',
    '699184012505',
    '699184012512',
    '699184012529',
    '699184012536',
    '703387940005',
    '703387940036',
    '703387940043',
    '705105946528',
    '755970404173',
    '755970405705',
    '755970407969',
    '810027373786',
    '810100850821',
    '810100850845',
    '810100850869',
    '810100850890',
    '810100850906',
    '810100850968',
    '810100850982',
    '810100854683',
    '810100854690',
    '810100854706',
    '810100854713',
    '810118120572',
    '810118120589',
    '810118120596',
    '840243133345',
    '840243152773',
    '850013579808',
    '850046954061',
    '850047931061',
    '853079003973',
    '853994001245',
    '854814007010',
    '855089008214',
    '878968001700',
    '878968001755',
    '878968001779',
    '878968003346',
    '878968003353',
    '878968003360',
    '886817006363',
    '886817007421',
    '886817007490',
    '886817007506',
    '886817007612',
    '886817007650',
    '886817007711',
    '886817007759',
    '886817007797'
  )
);

-- 1 product by chewy_sku (no UPC)
UPDATE products SET is_supplemental = true
WHERE is_supplemental IS NOT true
AND chewy_sku IN ('1311422');

-- 35 products by exact name (Amazon products with no retailer ID)
UPDATE products SET is_supplemental = true
WHERE is_supplemental IS NOT true
AND name IN (
  'ACANA Lickables Cat Treats Salmon Recipe .5oz Tubes (5 Count) (Pack of 2)',
  'Amazon Basics Dog Treats Freeze Dried Raw Single Ingredient Chicken Breast, High Protein, Healthy Training Treats or Meal Topper for All Dogs, Grain-Free, 3 Oz (Pack of 2) (Previously Wag)',
  'Blue Buffalo Wilderness Trail Toppers Wild Cuts Wet Dog Food Variety Pack, High-Protein & Grain-Free, Made with Natural Ingredients, Chicken and Beef Flavors, 3-oz Pouches, (12 Count, 6 of Each)',
  'Brutus Chicken Broth Liquid for Dogs - All Natural Chicken Bone Broth for Dogs with Chondroitin Glucosamine Turmeric -Human Grade Dog Food Toppers for Picky Eaters & Dry Food -Tasty & Nutritious',
  'Bully Max 30/20 High Protein Chicken Dog Food (5lbs) + Freeze-Dried Raw Salmon Toppers + Real Beef Treats (2pk) – Complete Meals, Enhanced Nutrition & Training Rewards High Performance Dog Bundle',
  'Bully Max 30/20 High Protein Chicken Dog Food 5 lbs. + Freeze-Dried Raw Salmon Toppers – Premium Performance Nutrition Bundle for Muscle & Energy – High Calorie Meals with Added Flavor for All Breeds',
  'Bully Max Freeze-Dried Raw Dog Food Toppers for Puppies & Adult Dogs - Salmon with Real Fruits & Veggies - Meal Enhancers with Vitamins & Minerals - Feed as Puppy Treat or Dog Meal',
  'Cesar Simply Crafted Adult Wet Dog Food Toppers for Dry Food, Chicken, 1.3 oz Tubs, 10 Count',
  'Cesar Simply Crafted Adult Wet Dog Food Toppers for Dry Food, Chicken, Carrots, Potatoes & Peas, 1.3 oz Tubs, 10 Count',
  'Cesar Simply Crafted Wet Dog Food Toppers for Dry Food, Chicken, Carrots, Potatoes & Peas and Chicken, Sweet Potato, Apple, Barley & Spinach Meal Topper Variety Pack, 1.3 oz. Tubs, 8 Count (Pack of 2)',
  'Cesar Simply Crafted Wet Dog Food Toppers for Dry Food, Chicken, Duck, Purple Potatoes, Pumpkin, Green Beans & Brown Rice, and Chicken, Carrots, Barley & Spinach Variety Pack, 1.3 oz Tubs, 8 Count',
  'Faywell Vital Fiber Wellbar Puppy Chew Treats, Contain Goat Milk Powder, Rich in Calcium and Protein, Soft Vanilla Texture, 80g',
  'Freeze Dried Raw Dog Food - Beef & Turkey Salmon Flavors, 14 oz. | High Protein and Grain Free Dog Food for All Breeds and Picky Eaters - Versatile as Meal Topper, Snack, and Treats',
  'Freeze Dried Raw Dog Food - Chicken & Turkey Salmon Flavors, 14 oz. | High Protein and Grain Free Dog Food for All Breeds and Picky Eaters - Versatile as Meal Topper, Snack, and Treats',
  'Freeze Dried Raw Dog Food - Premium Turkey and Salmon Flavor with High Protein and Grain Free Dog Food for All Breeds and Picky Eaters - Versatile as Meal Topper, Snack, and Treats, 5 Oz',
  'Instinct RawBoost Mixers, gefriergetrocknetes Hundefutter, getreidefreies Rezept – natürliches Rindfleisch, 400 ml Beutel',
  'Instinct RawBoost Shakers, Freeze-Dried Dog Food Powder Topper - Beef, 5.5 oz. Bottle',
  'K9 Natural Lamb Freeze Dried Dog Food, High-Meat Natural Complete Meal or Meal Toppers for Dogs, Grass-Fed Lamb from New Zealand, Grain-Free, GMO-Free, Complete & Balanced Nutrition, 1.1lb',
  'McLovin''s Pet Freeze Dried Raw Beef Liver Dog Treats and Toppers, 14 oz. - Single Ingredient, Grain-Free, Gluten-Free, High-Protein Treat – Healthy Dog Training Treats',
  'Nulo Freestyle Grain-Free Perfect Purees Premium Wet Cat Treats, Squeezable Meal Topper for Felines, High Moisture Content to Support Cat Hydration, 0.5 Ounce, Variety Pack',
  'Nutramax Cosequin for Senior Cats Joint Health Supplement, Contains Glucosamine for Cats, Plus Chondroitin, Supports Joint, Skin and Coat, and Immune Health, Sprinkle Capsules, 60 Count',
  'PETITE CUISINE Lickables Variety Pack, 0.5 oz. (20 Count) (Pack of 2)',
  'Portland Pet Food Company Fresh Dog Food Pouches - Human-Grade Topper Mix-Ins & Wet Pet Meals - Small & Large Breed Puppy & Senior Dogs - Gluten-Free Limited Ingredient Meal Toppers - 5 Pack Variety',
  'Primal Dog Food Toppers & Cat Food Toppers, Cupboard Cuts, Grain Free Meal Mixers with Probiotics, Raw Freeze Dried Dog Treats & Cat Treats, Great for Training, (Chicken, 18 oz)',
  'Primal Freeze Dried Dog Food, Pronto Mini Nuggets, Lamb; Scoop & Serve, Complete & Balanced Meal; Also Use as Topper or Treat; Premium, Healthy, Grain Free, High Protein Raw Dog Food (7 oz)',
  'Stewart 100% Beef Liver Dog Treats, 21 oz Tub, ~475 Pieces, Freeze Dried Raw, 50% Protein, Single Ingredient Training Treats or Meal Topper, Grain Free, Gluten Free',
  'Stewart 100% Chicken Breast Dog Treats, 14.8 oz Tub, ~280 Pieces, Freeze Dried Raw, Ingredient, 74% Protein Training Treats or Meal Topper, Grain Free, Gluten Free, (Pack of 2)',
  'Stewart 100% Chicken Breast Dog Treats, 14.8 oz Tub, ~280 Pieces, Freeze Dried Raw, Single Ingredient, 74% Protein Training Treats or Meal Topper, Grain Free, Gluten Free',
  'Stewart 100% Wild Salmon Dog Treats, 9.5 oz Tub, ~190 Pieces, Freeze Dried Raw, Single Ingredient, 65% Protein Training Treats or Meal Topper, Grain Free, Gluten Free',
  'Stewart Chicken Liver Dog Treats, 1.5 oz, ~25 Pieces, Freeze Dried Raw, Single Ingredient, 60% Protein Training Treats or Meal Topper in a Resealable Tub, Grain Free, Gluten Free (Pack of 2)',
  'The New Zealand Natural Pet Food Co WOOF Freeze Dried Dog Food - Chicken Recipe, High Protein Dog Treats & Snacks, Dog Food Toppers & Meals, 9.9 oz',
  'Under the Weather Kitten Milk Replacement Powder + Colostrum for Cats & Kittens | Goat Milk Replacer Powder | Goat-Based Formula with Colostrum for Immune & Digestive Support - 12 oz',
  'Whole Life Cat Just One Salmon Freeze Dried Cat Treats - Human Grade High Protein Food, Healthy Training Snacks, Freeze Dried Salmon Food Toppers, USA Made Natural Treats - 2.5 oz (Pack of 1)',
  'Whole Life Dog Just One Chicken Freeze Dried Dog Treats - Human Grade High Protein Food, Healthy Training Snacks, Freeze Dried Food Toppers, USA Made Natural Treats - 21 oz (Value Pack of 1)',
  'Whole Life Pet Freeze Dried Chicken Cat Treats + Whole Life Pet Just One Salmon - Cat Treats and Toppers'
);

-- ─── 1B. Recategorize 2 oil products as supplement ─────────────

-- Pure Balance Salmon Oil (wrong category, wrong species, wrong form)
UPDATE products SET
  category = 'supplement',
  product_form = 'wet',
  aafco_statement = NULL,
  aafco_inference = 'not_applicable'
WHERE id IN (SELECT product_id FROM product_upcs WHERE upc = '194346055531');

-- Raw Paws Coconut Oil (wrong category)
UPDATE products SET
  category = 'supplement',
  aafco_statement = NULL,
  aafco_inference = 'not_applicable'
WHERE id IN (SELECT product_id FROM product_upcs WHERE upc = '853458007622');

-- ─── 1C. Clear AAFCO for all supplemental products ────────────

UPDATE products SET
  aafco_statement = NULL,
  aafco_inference = 'not_applicable'
WHERE is_supplemental = true
AND aafco_statement IS NOT NULL;

-- ─── 1D. Invalidate stale pet_product_scores cache ────────────

DELETE FROM pet_product_scores
WHERE product_id IN (
  SELECT id FROM products
  WHERE is_supplemental = true
  AND id IN (
    SELECT product_id FROM pet_product_scores
    WHERE is_supplemental IS NOT true
  )
);
