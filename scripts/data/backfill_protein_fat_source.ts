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
  'corn_gluten_meal', 'wheat_gluten', 'rice_protein', 'potato_protein',
  'rice_protein_concentrate',
]);

// Pattern fragments — catch parser variants (organic_chicken, dehydrated_salmon_meal, etc.)
const PATTERNS: RegExp[] = [
  // Named species
  /\bchicken\b/, /\bbeef\b/, /\bturkey\b/, /\blamb\b/, /\bduck\b/,
  /\bvenison\b/, /\bbison\b/, /\brabbit\b/, /\bsalmon\b/, /\bherring\b/,
  /\bmackerel\b/, /\bsardine/, /\banchov/, /\btrout\b/, /\btuna\b/,
  /\bcod\b/, /\bpollock\b/, /\bhaddock\b/, /\bcatfish\b/, /\btilapia\b/,
  /\belk\b/, /\bgoat\b/, /\bpork\b/, /\bwhitefish/, /\bquail\b/,
  /\bpheasant\b/, /\bboar\b/, /\bkangaroo\b/, /\bmenhaden\b/,
  // Structural (X_meal, X_fat, X_oil, X_protein, X_by_product, X_digest, X_liver, X_heart)
  /\w_meal\b/,
  /\w_fat\b/,
  /\w_oil\b/,
  /\w_protein\b/,
  /\w_by_product/,
  /\w_digest\b/,
  /\w_liver\b/,
  /\w_heart\b/,
  /\w_tallow\b/,
  // Eggs & dairy
  /\begg/, /\bcasein\b/, /\bwhey\b/, /\bcheese\b/,
  // Gluten meals (protein sources)
  /\bgluten_meal\b/, /\bwheat_gluten\b/,
  // Natural flavor (protein/fat source)
  /\bnatural_flavor\b/,
];

// Hard exclusions — NEVER classify as protein/fat source.
// These only block PATTERN matches. Exact set matches are immune.
const EXCLUSION_PATTERNS: RegExp[] = [
  // Grains (except gluten meal / protein isolates — handled by exact set)
  /\bcorn\b/, /\brice\b/, /\bwheat\b/, /\bbarley/, /\boats?\b/, /\bsorghum/,
  /\bmillet/, /\brye\b/, /\bbuckwheat/,
  // Starches
  /\bpotato\b/, /\btapioca/, /\bcassava/, /\bsweet_potato/,
  // Fibers
  /\bcellulose/, /\bbeet_pulp/, /\bpea_fiber/, /\bpea_starch/, /\bpea_flour/,
  /\bpea_hull/, /\btomato_pomace/, /\bpumpkin\b/, /\bapple\b/,
  // Legumes as carbs (not protein isolates)
  /\bpeas?\b/, /\blentil/, /\bchickpea/, /\bfava/, /\bbean/,
  // Vitamins/minerals/supplements
  /\bvitamin/, /\bmineral/, /\bcalcium/, /\bphosphate/, /\bpotassium/,
  /\bchloride/, /\bsulfate/, /\boxide/, /\bselenite/, /\biodate/,
  /\bcarbonate/, /\btaurine\b/, /\bmethionine\b/, /\bl_carnitine\b/,
  /\bbiotin\b/, /\bcholine\b/, /\bniacin/, /\bthiamine/, /\briboflavin/,
  /\bfolic/, /\bpyridoxine/, /\bascorbic/, /\bpantothen/,
  // Probiotics
  /\bprobiotics?/, /\blactobacillus/, /\bbacillus/, /\benterococcus/,
  // Preservatives / extracts (rosemary_oil is NOT a fat source)
  /\brosemary/, /\btocopherol/, /\bcitric_acid/, /\bpeppermint/,
  /\bmarigold/, /\byucca/,
  // Non-fat plant items
  /\bflaxseed\b/, /\bchia_seed/, /\bsunflower_seed/,
  // Misc non-protein items that could match patterns
  /\balfalfa/, /\bkelp/, /\bseaweed/, /\bspirulina/,
  /\bbrewers_yeast/, /\bdried_yeast/, /\byeast/,
  /\bsalt\b/, /\bwater\b/, /\bguar_gum/, /\bxanthan/, /\bcarrageenan/,
  /\bagar/, /\blocust_bean/,
  // Colors / dyes
  /\bcolor/, /\bdye\b/, /\byellow_\d/, /\bred_\d/, /\bblue_\d/,
  // Fruits / vegetables
  /\bblueberr/, /\bcranberr/, /\bcarrot\b/, /\bspinach\b/, /\bbroccoli/,
  /\bsweet_potato/, /\bsquash/, /\bparsley/, /\bturmeric/, /\bginger\b/,
];

// ─── Classification Logic ────────────────────────────────

interface IngredientRow {
  id: string;
  canonical_name: string;
  is_protein_fat_source: boolean;
}

function classify(name: string): { match: boolean; ambiguous: boolean } {
  const lower = name.toLowerCase();

  // Exact set always wins — immune to exclusions
  if (EXACT_MATCHES.has(lower)) {
    return { match: true, ambiguous: false };
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

  // Exceptions: exact set items that legitimately match verify pattern
  const legitimateExceptions = new Set([
    'corn_gluten_meal', 'rice_protein', 'rice_protein_concentrate',
    'wheat_gluten', 'potato_protein', 'corn_oil',
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
    if (remainingErrors.length > 0) allExcluded = false;
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
    const { error } = await supabase
      .from('ingredients_dict')
      .update({ is_protein_fat_source: true })
      .in('id', ids);

    if (error) {
      console.error(`\nFailed to update: ${error.message}`);
      process.exit(1);
    }
    console.log(`\nUpdated ${ids.length} rows with is_protein_fat_source = true`);
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
