/**
 * D-137: Backfill is_pulse and is_pulse_protein flags on ingredients_dict.
 *
 * Classifies pulse ingredients for DCM positional load detection.
 * Excludes potatoes, sweet potatoes, soy, and tapioca — these are NOT pulses.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_pulse_flags.ts
 *
 * Dry run (no writes):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_pulse_flags.ts --dry-run
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

// ─── Pulse Classification ────────────────────────────────

// Exact canonical_name matches for is_pulse = true
const PULSE_EXACT: Set<string> = new Set([
  // Pea cluster
  'whole_peas', 'dried_peas', 'green_peas', 'yellow_peas',
  'pea_flour', 'pea_starch', 'pea_fiber', 'pea_hull_fiber',
  'split_peas', 'peas',
  // Lentil cluster
  'lentils', 'red_lentils', 'green_lentils', 'lentil_flour', 'lentil_fiber',
  // Chickpea cluster
  'chickpeas', 'garbanzo_beans', 'chickpea_flour',
  // Bean cluster
  'fava_beans', 'dried_beans', 'navy_beans', 'black_beans',
  'white_beans', 'kidney_beans', 'pinto_beans',
]);

// Pattern fragments — catch parser variants (organic_green_peas, dehydrated_lentils, etc.)
const PULSE_PATTERNS: RegExp[] = [
  /\bpeas?\b/,          // pea, peas (but not "peanut")
  /\blentil/,           // lentils, lentil_flour, etc.
  /\bchickpea/,         // chickpeas, chickpea_flour
  /\bgarbanzo/,         // garbanzo_beans
  /\bfava/,             // fava_beans
  /\bnavy_bean/,        // navy_beans
  /\bblack_bean/,       // black_beans
  /\bwhite_bean/,       // white_beans
  /\bkidney_bean/,      // kidney_beans
  /\bpinto_bean/,       // pinto_beans
  /\bdried_bean/,       // dried_beans
];

// Exact matches for is_pulse_protein = true (subset of is_pulse)
const PULSE_PROTEIN_EXACT: Set<string> = new Set([
  'pea_protein', 'pea_protein_isolate', 'pea_protein_concentrate',
  'lentil_protein', 'chickpea_protein',
]);

// Pattern fragments for pulse protein variants
const PULSE_PROTEIN_PATTERNS: RegExp[] = [
  /pea_protein/,
  /lentil_protein/,
  /chickpea_protein/,
];

// Hard exclusions — NEVER classify as pulse
const EXCLUSION_PATTERNS: RegExp[] = [
  /potato/,             // potato, sweet_potato, potato_starch, etc.
  /\bsoy/,              // soy, soybean, soy_protein, etc.
  /tapioca/,            // tapioca, tapioca_starch, etc.
  /cassava/,            // cassava (same plant as tapioca)
  /peanut/,             // peanuts are NOT pulses (they're legumes but excluded from DCM scope)
];

// ─── Classification Logic ────────────────────────────────

interface IngredientRow {
  id: string;
  canonical_name: string;
  is_pulse: boolean;
  is_pulse_protein: boolean;
}

type Classification = 'pulse_protein' | 'pulse' | 'excluded' | 'none';

function classify(name: string): { result: Classification; ambiguous: boolean } {
  const lower = name.toLowerCase();

  // Check exclusions first — always wins
  for (const pat of EXCLUSION_PATTERNS) {
    if (pat.test(lower)) {
      return { result: 'excluded', ambiguous: false };
    }
  }

  // Check pulse protein (exact then pattern)
  if (PULSE_PROTEIN_EXACT.has(lower)) {
    return { result: 'pulse_protein', ambiguous: false };
  }
  for (const pat of PULSE_PROTEIN_PATTERNS) {
    if (pat.test(lower)) {
      return { result: 'pulse_protein', ambiguous: true };
    }
  }

  // Check pulse (exact then pattern)
  if (PULSE_EXACT.has(lower)) {
    return { result: 'pulse', ambiguous: false };
  }
  for (const pat of PULSE_PATTERNS) {
    if (pat.test(lower)) {
      return { result: 'pulse', ambiguous: true };
    }
  }

  return { result: 'none', ambiguous: false };
}

// ─── Main ────────────────────────────────────────────────

async function backfill() {
  console.log(`D-137 Pulse Flag Backfill${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('─'.repeat(50));

  // Fetch all ingredients_dict rows
  const allIngredients: IngredientRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('ingredients_dict')
      .select('id, canonical_name, is_pulse, is_pulse_protein')
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
  const pulseUpdates: { id: string; name: string }[] = [];
  const pulseProteinUpdates: { id: string; name: string }[] = [];
  const ambiguous: { name: string; classification: string }[] = [];
  const excluded: string[] = [];

  for (const ing of allIngredients) {
    const { result, ambiguous: isAmbiguous } = classify(ing.canonical_name);

    if (result === 'excluded') {
      // Only track if name matches a pulse pattern (i.e. it WOULD have matched without exclusion)
      const hasPulsePattern = PULSE_PATTERNS.some(p => p.test(ing.canonical_name.toLowerCase()));
      if (hasPulsePattern) {
        excluded.push(ing.canonical_name);
      }
      continue;
    }

    if (result === 'pulse_protein') {
      pulseProteinUpdates.push({ id: ing.id, name: ing.canonical_name });
      pulseUpdates.push({ id: ing.id, name: ing.canonical_name }); // is_pulse_protein implies is_pulse
      if (isAmbiguous) {
        ambiguous.push({ name: ing.canonical_name, classification: 'pulse_protein (pattern)' });
      }
    } else if (result === 'pulse') {
      pulseUpdates.push({ id: ing.id, name: ing.canonical_name });
      if (isAmbiguous) {
        ambiguous.push({ name: ing.canonical_name, classification: 'pulse (pattern)' });
      }
    }
  }

  // ─── Report ──────────────────────────────────────────

  console.log('PULSE MATCHES (is_pulse = true):');
  for (const p of pulseUpdates) {
    const isAlsoProtein = pulseProteinUpdates.some(pp => pp.id === p.id);
    console.log(`  ${p.name}${isAlsoProtein ? '  ← also is_pulse_protein' : ''}`);
  }

  console.log(`\nPULSE PROTEIN MATCHES (is_pulse_protein = true):`);
  for (const pp of pulseProteinUpdates) {
    console.log(`  ${pp.name}`);
  }

  if (ambiguous.length > 0) {
    console.log('\n⚠ AMBIGUOUS (pattern-matched, review manually):');
    for (const a of ambiguous) {
      console.log(`  ${a.name} → ${a.classification}`);
    }
  }

  if (excluded.length > 0) {
    console.log('\nEXCLUDED (matched pulse pattern but blocked by exclusion):');
    for (const e of excluded) {
      console.log(`  ${e} → is_pulse = false (correct)`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Total ingredients:    ${allIngredients.length}`);
  console.log(`  is_pulse = true:      ${pulseUpdates.length}`);
  console.log(`  is_pulse_protein:     ${pulseProteinUpdates.length}`);
  console.log(`  Ambiguous matches:    ${ambiguous.length}`);

  // ─── Verification: confirm exclusions are false ─────

  console.log('\nEXCLUSION VERIFICATION (must all be is_pulse = false):');
  const exclusionChecks = allIngredients.filter(i => {
    const lower = i.canonical_name.toLowerCase();
    return /potato|sweet_potato|soy|tapioca|cassava/.test(lower);
  });
  const allExcluded = exclusionChecks.every(i => !pulseUpdates.some(p => p.id === i.id));
  for (const check of exclusionChecks.slice(0, 10)) {
    const wouldFlag = pulseUpdates.some(p => p.id === check.id);
    console.log(`  ${check.canonical_name}: is_pulse=${wouldFlag} ${wouldFlag ? '✗ ERROR' : '✓'}`);
  }
  if (exclusionChecks.length > 10) {
    console.log(`  ... and ${exclusionChecks.length - 10} more (all ${allExcluded ? '✓' : '✗ ERRORS FOUND'})`);
  }
  console.log(`  Result: ${allExcluded ? 'ALL PASS' : 'FAILURES DETECTED — aborting'}`);

  if (!allExcluded) {
    console.error('\nExclusion check failed — pulse flags would incorrectly include excluded ingredients.');
    process.exit(1);
  }

  // ─── Apply Updates ─────────────────────────────────

  if (DRY_RUN) {
    console.log('\n(Dry run — no rows updated. Remove DRY_RUN=1 to apply.)');
    return;
  }

  let updateErrors = 0;

  // Batch update is_pulse
  if (pulseUpdates.length > 0) {
    const pulseIds = pulseUpdates.map(p => p.id);
    const { error } = await supabase
      .from('ingredients_dict')
      .update({ is_pulse: true })
      .in('id', pulseIds);

    if (error) {
      console.error(`\nFailed to update is_pulse: ${error.message}`);
      updateErrors++;
    } else {
      console.log(`\nUpdated ${pulseIds.length} rows with is_pulse = true`);
    }
  }

  // Batch update is_pulse_protein
  if (pulseProteinUpdates.length > 0) {
    const proteinIds = pulseProteinUpdates.map(p => p.id);
    const { error } = await supabase
      .from('ingredients_dict')
      .update({ is_pulse_protein: true })
      .in('id', proteinIds);

    if (error) {
      console.error(`\nFailed to update is_pulse_protein: ${error.message}`);
      updateErrors++;
    } else {
      console.log(`Updated ${proteinIds.length} rows with is_pulse_protein = true`);
    }
  }

  // ─── Spot Check ────────────────────────────────────

  console.log('\nSPOT CHECK (10 random pulse ingredients):');
  const spotIds = pulseUpdates
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map(p => p.id);

  const { data: spotCheck } = await supabase
    .from('ingredients_dict')
    .select('canonical_name, is_pulse, is_pulse_protein')
    .in('id', spotIds);

  if (spotCheck) {
    for (const row of spotCheck) {
      console.log(`  ${row.canonical_name}: is_pulse=${row.is_pulse}, is_pulse_protein=${row.is_pulse_protein}`);
    }
  }

  console.log(`\nDone. ${updateErrors === 0 ? 'All updates applied.' : `${updateErrors} errors.`}`);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
