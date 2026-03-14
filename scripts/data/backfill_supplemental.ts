/**
 * D-136: Backfill is_supplemental flag on existing products.
 *
 * Scans aafco_statement and ingredients_raw for AAFCO
 * intermittent/supplemental feeding language. Updates matching rows.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_supplemental.ts
 *
 * Dry run (no writes):
 *   DRY_RUN=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/data/backfill_supplemental.ts
 */

import { createClient } from '@supabase/supabase-js';
import { isSupplementalProduct } from '../../src/utils/supplementalClassifier';

// ─── Config ──────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Main ────────────────────────────────────────────────

async function backfill() {
  console.log(`D-136 Supplemental Backfill${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('─'.repeat(50));

  let offset = 0;
  let totalProcessed = 0;
  let totalMatched = 0;
  let totalUpdated = 0;
  const matchedProducts: { id: string; brand: string; name: string; source: string }[] = [];

  while (true) {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, brand, name, aafco_statement, ingredients_raw')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    if (!products || products.length === 0) break;

    for (const product of products) {
      totalProcessed++;

      // Check aafco_statement first (most reliable)
      let matched = isSupplementalProduct(product.aafco_statement);
      let matchSource = 'aafco_statement';

      // Fallback: check ingredients_raw (feeding guide sometimes scraped with ingredients)
      if (!matched && product.ingredients_raw) {
        matched = isSupplementalProduct(product.ingredients_raw);
        matchSource = 'ingredients_raw';
      }

      if (matched) {
        totalMatched++;
        matchedProducts.push({
          id: product.id,
          brand: product.brand,
          name: product.name,
          source: matchSource,
        });

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ is_supplemental: true })
            .eq('id', product.id);

          if (updateError) {
            console.error(`  Failed to update ${product.brand} ${product.name}: ${updateError.message}`);
          } else {
            totalUpdated++;
          }
        }
      }
    }

    offset += BATCH_SIZE;
    if (products.length < BATCH_SIZE) break;
  }

  // ─── Report ──────────────────────────────────────────

  console.log(`\nProcessed: ${totalProcessed} products`);
  console.log(`Matched:   ${totalMatched} supplemental products`);
  if (!DRY_RUN) {
    console.log(`Updated:   ${totalUpdated} rows`);
  }

  if (matchedProducts.length > 0) {
    console.log('\nMatched products:');
    for (const p of matchedProducts) {
      console.log(`  [${p.source}] ${p.brand} — ${p.name}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n(Dry run — no rows updated. Remove DRY_RUN=1 to apply.)');
  }
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
