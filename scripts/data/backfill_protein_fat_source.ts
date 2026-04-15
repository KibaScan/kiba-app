/**
 * Backfill is_protein_fat_source flag on ingredients_dict.
 *
 * Classifies protein and fat source ingredients for:
 * - Layer 1c protein naming specificity scoring (formulationScore.ts)
 * - Condition scoring protein source count (conditionScoring.ts)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_protein_fat_source.ts
 *
 * Dry run (no writes):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_protein_fat_source.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Protein/Fat Source Classification ───────────────────

// Exact canonical_name matches → is_protein_fat_source = true
// These always win, even if they match an exclusion pattern.
const EXACT_MATCHES: Set<string> = new Set([
  // ── Named meats (raw / deboned / dehydrated) ──
  'chicken', 'beef', 'turkey', 'lamb', 'duck', 'venison', 'bison', 'rabbit',
  'salmon', 'whitefish', 'herring', 'mackerel', 'sardine', 'sardines',
  'anchovy', 'anchovies', 'trout', 'tuna', 'cod', 'pollock', 'haddock',
  'catfish', 'tilapia', 'elk', 'goat', 'kangaroo', 'quail', 'pheasant',
  'boar', 'pork', 'menhaden',
  'deboned_chicken', 'deboned_turkey', 'deboned_lamb', 'deboned_salmon',
  'deboned_beef', 'deboned_duck', 'deboned_pork', 'deboned_trout',
  'white_fish', 'white_fish_broth',
  'dehydrated_chicken', 'dehydrated_turkey', 'dehydrated_lamb',
  'dehydrated_salmon', 'dehydrated_duck', 'dehydrated_pork',

  // ── Named meals ──
  'chicken_meal', 'salmon_meal', 'turkey_meal', 'lamb_meal', 'duck_meal',
  'herring_meal', 'whitefish_meal', 'menhaden_fish_meal', 'beef_meal',
  'pork_meal', 'venison_meal', 'bison_meal', 'rabbit_meal', 'trout_meal',
  'cod_meal', 'pollock_meal', 'mackerel_meal', 'anchovy_meal',

  // ── Named organ meats ──
  'chicken_liver', 'beef_liver', 'turkey_liver', 'duck_liver', 'lamb_liver',
  'pork_liver', 'chicken_heart', 'beef_heart', 'turkey_heart',
  'chicken_gizzard', 'chicken_gizzards', 'chicken_necks',

  // ── Eggs ──
  'eggs', 'egg', 'dried_egg', 'dried_egg_product', 'egg_product',
  'whole_eggs', 'dehydrated_egg', 'dried_whole_egg',

  // ── Dairy protein ──
  'casein', 'whey', 'whey_protein', 'cheese', 'cottage_cheese',

  // ── Named animal fats ──
  'chicken_fat', 'salmon_oil', 'fish_oil', 'beef_tallow', 'duck_fat',
  'herring_oil', 'turkey_fat', 'lamb_fat', 'pork_fat', 'menhaden_oil',
  'pollock_oil', 'cod_liver_oil', 'krill_oil', 'krill_meal',
  'sardine_oil', 'anchovy_oil', 'mackerel_oil',

  // ── Named plant oils (primary fat sources) ──
  'flaxseed_oil', 'linseed_oil', 'sunflower_oil', 'coconut_oil', 'canola_oil',
  'safflower_oil', 'soybean_oil', 'olive_oil', 'corn_oil',

  // ── Unnamed protein/fat sources (still protein/fat, just unnamed species) ──
  'fish', 'poultry',
  'animal_fat', 'poultry_fat', 'animal_digest', 'meat_meal',
  'meat_by_products', 'meat_by_product', 'meat_by_product_meal',
  'fish_meal', 'poultry_meal', 'poultry_by_products', 'poultry_by_product_meal',
  'animal_liver', 'bone_meal', 'natural_flavor', 'ocean_fish_meal',
  'ocean_whitefish', 'dried_meat_by_products', 'liver',
  'poultry_digest', 'animal_by_product_meal', 'vegetable_oil',
  'chicken_by_product_meal', 'poultry_by_product',

  // ── Plant protein isolates/concentrates ──
  'pea_protein', 'pea_protein_isolate', 'pea_protein_concentrate',
  'soy_protein', 'soy_protein_isolate', 'soybean_meal',
  'corn_gluten_meal', 'corn_protein', 'corn_protein_concentrate',
  'cornprotein_meal',  // parser artifact (jammed spelling)
  'wheat_gluten', 'wheat_germ_meal',
  'rice_protein', 'rice_protein_concentrate',
  'potato_protein',
]);

// ─── Underscore-Aware Boundary Helpers ───────────────────
// In canonical names, words are separated by underscores.
// Standard \b treats _ as a word character, so \bcorn\b won't match corn_meal.
// These helpers use (?:^|_) and (?:$|_) as word boundaries instead.

/** Match a word at underscore boundaries: (?:^|_)word(?:$|_) */
function uw(word: string): RegExp {
  return new RegExp(`(?:^|_)${word}(?:$|_)`);
}

/** Match a word prefix at underscore boundary: (?:^|_)prefix */
function uwPrefix(prefix: string): RegExp {
  return new RegExp(`(?:^|_)${prefix}`);
}

// Pattern fragments — catch parser variants (organic_chicken, dehydrated_salmon_meal, etc.)
// Max length filter: ingredients > 60 chars are parser garbage (compound entries, marketing copy)
const MAX_INGREDIENT_LENGTH = 60;

const PATTERNS: RegExp[] = [
  // Named species at underscore boundaries
  uw('chicken'), uw('beef'), uw('turkey'), uw('lamb'), uw('duck'),
  uw('venison'), uw('bison'), uw('rabbit'), uw('salmon'), uw('herring'),
  uw('mackerel'), uwPrefix('sardine'), uwPrefix('anchov'), uw('trout'), uw('tuna'),
  uw('cod'), uw('pollock'), uw('haddock'), uw('catfish'), uw('tilapia'),
  uw('elk'), uw('goat'), uw('pork'), uwPrefix('whitefish'), uw('quail'),
  uw('pheasant'), uw('boar'), uw('kangaroo'), uw('menhaden'),
  // Structural suffixes (X_meal, X_fat, X_oil, etc.)
  /_meal$/,
  /_fat$/,
  /_oil$/,
  /_protein$/,
  /_by_product/,
  /_digest$/,
  /_liver$/,
  /_heart$/,
  /_tallow$/,
  // Eggs & dairy
  uwPrefix('egg'), uw('casein'), uw('whey'), uw('cheese'),
  // Gluten meals (protein sources)
  /gluten_meal/, /wheat_gluten/,
  // Natural flavor
  /natural_flavor/,
];

// Hard exclusions — NEVER classify as protein/fat source.
// These only block PATTERN matches. Exact set matches are immune.
// Use underscore-aware boundaries so corn_meal is excluded by the corn rule.
const EXCLUSION_PATTERNS: RegExp[] = [
  // Grains (except gluten meal / protein isolates — handled by exact set)
  uw('corn'), uw('rice'), uw('wheat'), uwPrefix('barley'), uw('oats?'),
  uwPrefix('sorghum'), uwPrefix('millet'), uw('rye'), uwPrefix('buckwheat'),
  // Starches
  uw('potato'), uwPrefix('tapioca'), uwPrefix('cassava'), /sweet_potato/,
  // Fibers
  uwPrefix('cellulose'), /beet_pulp/, /pea_fiber/, /pea_starch/, /pea_flour/,
  /pea_hull/, /tomato_pomace/, uw('pumpkin'), uw('apple'),
  // Legumes as carbs (not protein isolates)
  uw('peas?'), uwPrefix('lentil'), uwPrefix('chickpea'), uwPrefix('fava'), uwPrefix('bean'),
  // Vitamins/minerals/supplements
  uwPrefix('vitamin'), uwPrefix('mineral'), uwPrefix('calcium'), uwPrefix('phosphate'),
  uwPrefix('potassium'), uwPrefix('chloride'), uwPrefix('sulfate'), uwPrefix('oxide'),
  uwPrefix('selenite'), uwPrefix('iodate'), uwPrefix('carbonate'),
  /taurine/, uw('methionine'), uw('l_carnitine'),
  uw('biotin'), uw('choline'), uwPrefix('niacin'), uwPrefix('thiamine'),
  uwPrefix('riboflavin'), uwPrefix('folic'), uwPrefix('pyridoxine'),
  uwPrefix('ascorbic'), uwPrefix('pantothen'),
  // Probiotics
  uwPrefix('probiotic'), uwPrefix('lactobacillus'), uwPrefix('bacillus'), uwPrefix('enterococcus'),
  // Preservatives / extracts
  uwPrefix('rosemary'), uwPrefix('tocopherol'), /citric_acid/, uwPrefix('peppermint'),
  uwPrefix('marigold'), uwPrefix('yucca'),
  // Non-fat plant items
  uw('flaxseed'), /chia_seed/, /sunflower_seed/,
  // Misc non-protein items
  uwPrefix('alfalfa'), uwPrefix('kelp'), uwPrefix('seaweed'), uwPrefix('spirulina'),
  /brewers_yeast/, /dried_yeast/, uwPrefix('yeast'),
  uw('salt'), uw('water'), /guar_gum/, uwPrefix('xanthan'), uwPrefix('carrageenan'),
  uwPrefix('agar'), /locust_bean/,
  // Colors / dyes
  uwPrefix('color'), uw('dye'), /yellow_\d/, /red_\d/, /blue_\d/,
  // Fruits / vegetables
  uwPrefix('blueberr'), uwPrefix('cranberr'), uw('carrot'), uw('spinach'),
  uwPrefix('broccoli'), /sweet_potato/, uw('squash'), uwPrefix('parsley'),
  uwPrefix('turmeric'), uw('ginger'),
  // Parser garbage patterns
  /guaranteed_analysis/, /crude_protein/, /crude_fat/, /active_ingredient/,
  /they_contain/, /with_over_\d/, /source_of_protein/, /perfect_protein/,
  /at_\d+_protein/, /low_in_fat/, /\d+_fat/, /\d+_protein/,
  uwPrefix('including'), /a_meal$/, /a_good_source/, /a_happy/,
  /complete_and_balanced/, uwPrefix('filling_'),
  // Compound entries (multiple ingredients jammed together by parser)
  /&/, /__/, /sea_salt/, /green_bean/, uwPrefix('potatoes'),
];

// ─── Classification Logic ────────────────────────────────

interface IngredientRow {
  id: string;
  canonical_name: string;
  is_protein_fat_source: boolean;
}

function classify(name: string): { match: boolean; ambiguous: boolean } {
  const lower = name.toLowerCase();

  // Exact set always wins — immune to exclusions and length filter
  if (EXACT_MATCHES.has(lower)) {
    return { match: true, ambiguous: false };
  }

  // Length filter: skip parser garbage (compound entries, marketing copy)
  if (lower.length > MAX_INGREDIENT_LENGTH) {
    return { match: false, ambiguous: false };
  }

  // Check exclusions before patterns
  for (const pat of EXCLUSION_PATTERNS) {
    if (pat.test(lower)) {
      return { match: false, ambiguous: false };
    }
  }

  // Check patterns
  for (const pat of PATTERNS) {
    if (pat.test(lower)) {
      return { match: true, ambiguous: true };
    }
  }

  return { match: false, ambiguous: false };
}

// ─── Main ────────────────────────────────────────────────

async function backfill() {
  console.log(`Protein/Fat Source Backfill${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('─'.repeat(50));

  // Fetch all ingredients_dict rows
  const allIngredients: IngredientRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('ingredients_dict')
      .select('id, canonical_name, is_protein_fat_source')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allIngredients.push(...(data as IngredientRow[]));
    offset += BATCH_SIZE;
    if (data.length < BATCH_SIZE) break;
  }

  console.log(`Fetched ${allIngredients.length} ingredients\n`);

  // Classify each ingredient
  const matches: { id: string; name: string }[] = [];
  const ambiguous: string[] = [];
  const excludedHits: string[] = [];

  for (const ing of allIngredients) {
    const { match, ambiguous: isAmbiguous } = classify(ing.canonical_name);

    if (match) {
      matches.push({ id: ing.id, name: ing.canonical_name });
      if (isAmbiguous) {
        ambiguous.push(ing.canonical_name);
      }
    } else {
      // Track if this was excluded despite matching a pattern
      const lower = ing.canonical_name.toLowerCase();
      const wouldMatchPattern = PATTERNS.some(p => p.test(lower));
      if (wouldMatchPattern) {
        excludedHits.push(ing.canonical_name);
      }
    }
  }

  // ─── Report ──────────────────────────────────────────

  console.log('PROTEIN/FAT SOURCE MATCHES (is_protein_fat_source = true):');
  for (const m of matches) {
    console.log(`  ${m.name}`);
  }

  if (ambiguous.length > 0) {
    console.log('\nAMBIGUOUS (pattern-matched, review manually):');
    for (const a of ambiguous) {
      console.log(`  ${a}`);
    }
  }

  if (excludedHits.length > 0) {
    console.log('\nEXCLUDED (matched a pattern but blocked by exclusion):');
    for (const e of excludedHits) {
      console.log(`  ${e} → false (correct)`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Total ingredients:          ${allIngredients.length}`);
  console.log(`  is_protein_fat_source=true: ${matches.length}`);
  console.log(`  Ambiguous (pattern-only):   ${ambiguous.length}`);
  console.log(`  Excluded overrides:         ${excludedHits.length}`);

  // ─── Exclusion Verification ────────────────────────

  console.log('\nEXCLUSION VERIFICATION (grains/starches/fibers/vitamins must be false):');
  const verifyNames = /corn|rice|wheat|barley|potato|tapioca|cellulose|beet_pulp|vitamin|mineral|taurine|salt/;
  const verifyIngredients = allIngredients.filter(i => verifyNames.test(i.canonical_name.toLowerCase()));
  const matchIds = new Set(matches.map(m => m.id));

  // Exceptions: items that legitimately match BOTH verify pattern AND protein/fat source
  const legitimateExceptions = new Set([
    'corn_gluten_meal', 'corn_protein', 'corn_protein_concentrate', 'cornprotein_meal', 'corn_oil',
    'rice_protein', 'rice_protein_concentrate',
    'wheat_gluten', 'wheat_germ_meal',
    'potato_protein',
    'soybean_germ_meal',
  ]);

  let allExcluded = true;
  for (const check of verifyIngredients.slice(0, 15)) {
    const wouldFlag = matchIds.has(check.id);
    const isLegitException = legitimateExceptions.has(check.canonical_name.toLowerCase());
    const ok = !wouldFlag || isLegitException;
    if (!ok) allExcluded = false;
    console.log(`  ${check.canonical_name}: flagged=${wouldFlag} ${ok ? '✓' : '✗ ERROR'}${isLegitException ? ' (legitimate exception)' : ''}`);
  }
  if (verifyIngredients.length > 15) {
    const remaining = verifyIngredients.slice(15);
    const remainingErrors = remaining.filter(i => matchIds.has(i.id) && !legitimateExceptions.has(i.canonical_name.toLowerCase()));
    if (remainingErrors.length > 0) {
      allExcluded = false;
      console.log(`  ERRORS:`);
      for (const err of remainingErrors) {
        console.log(`    ${err.canonical_name} ✗`);
      }
    }
    console.log(`  ... and ${remaining.length} more (${remainingErrors.length === 0 ? 'all ✓' : `${remainingErrors.length} ERRORS`})`);
  }
  console.log(`  Result: ${allExcluded ? 'ALL PASS' : 'FAILURES DETECTED — aborting'}`);

  if (!allExcluded) {
    console.error('\nExclusion check failed — protein/fat source flags would incorrectly include excluded ingredients.');
    process.exit(1);
  }

  // ─── Apply Updates ─────────────────────────────────

  if (DRY_RUN) {
    console.log('\n(Dry run — no rows updated. Remove --dry-run to apply.)');
    return;
  }

  if (matches.length > 0) {
    const ids = matches.map(m => m.id);
    const CHUNK = 100;
    let updated = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('ingredients_dict')
        .update({ is_protein_fat_source: true })
        .in('id', chunk);

      if (error) {
        console.error(`\nFailed to update chunk ${i}-${i + chunk.length}: ${error.message}`);
        process.exit(1);
      }
      updated += chunk.length;
    }
    console.log(`\nUpdated ${updated} rows with is_protein_fat_source = true (${Math.ceil(ids.length / CHUNK)} chunks)`);
  }

  // ─── Spot Check ────────────────────────────────────

  console.log('\nSPOT CHECK (10 random flagged ingredients):');
  const spotIds = matches
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(m => m.id);

  const { data: spotCheck } = await supabase
    .from('ingredients_dict')
    .select('canonical_name, is_protein_fat_source, is_unnamed_species')
    .in('id', spotIds);

  if (spotCheck) {
    for (const row of spotCheck) {
      console.log(`  ${row.canonical_name}: is_protein_fat_source=${row.is_protein_fat_source}, is_unnamed_species=${row.is_unnamed_species}`);
    }
  }

  console.log('\nDone.');
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
