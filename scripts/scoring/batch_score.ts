/**
 * Batch Scoring Script — scores all eligible products (Layer 1 + Layer 2)
 * and computes category averages for the benchmark bar.
 *
 * Usage: npx tsx scripts/scoring/batch_score.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import { computeScore } from '../../src/services/scoring/engine';
import type { Product } from '../../src/types';
import type { ProductIngredient } from '../../src/types/scoring';

// ─── Environment ──────────────────────────────────────────

// Load .env file manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Types ────────────────────────────────────────────────

interface SegmentKey {
  category: 'daily_food' | 'treat';
  target_species: 'dog' | 'cat';
  is_grain_free: boolean;
}

interface SegmentStats {
  scores: number[];
  avg_score: number;
  median_score: number;
  min_score: number;
  max_score: number;
  product_count: number;
}

interface IngredientDictRow {
  canonical_name: string;
  cluster_id: string | null;
  dog_base_severity: string;
  cat_base_severity: string;
  is_unnamed_species: boolean;
  is_legume: boolean;
  position_reduction_eligible: boolean;
  cat_carb_flag: boolean;
  allergen_group: string | null;
  allergen_group_possible: string[] | null;
}

interface ProductIngredientRow {
  position: number;
  ingredient_id: string;
  ingredients_dict: IngredientDictRow | null;
}

// ─── Constants ────────────────────────────────────────────

const BATCH_SIZE = 500;
const INGREDIENT_BATCH_SIZE = 1000;

// ─── Hydration ────────────────────────────────────────────

function hydrateIngredient(row: ProductIngredientRow): ProductIngredient | null {
  const dict = row.ingredients_dict;
  if (!dict) return null;

  return {
    position: row.position,
    canonical_name: dict.canonical_name,
    dog_base_severity: dict.dog_base_severity as ProductIngredient['dog_base_severity'],
    cat_base_severity: dict.cat_base_severity as ProductIngredient['cat_base_severity'],
    is_unnamed_species: dict.is_unnamed_species,
    is_legume: dict.is_legume,
    position_reduction_eligible: dict.position_reduction_eligible,
    cluster_id: dict.cluster_id,
    cat_carb_flag: dict.cat_carb_flag,
    allergen_group: dict.allergen_group,
    allergen_group_possible: dict.allergen_group_possible ?? [],
    is_protein_fat_source: false, // M1 limitation — same as pipeline.ts
  };
}

// ─── Fetch Products ───────────────────────────────────────

async function fetchScoreableProducts(): Promise<Product[]> {
  const allProducts: Product[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .neq('category', 'supplement')       // D-096: skip supplements
      .not('ingredients_raw', 'is', null)   // need ingredients to score
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error(`Fetch error at offset ${offset}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allProducts.push(...(data as Product[]));
    offset += data.length;

    if (data.length < BATCH_SIZE) break;
  }

  return allProducts;
}

// ─── Bulk Fetch All Ingredients ───────────────────────────

interface IngredientRowWithProduct extends ProductIngredientRow {
  product_id: string;
}

async function fetchAllIngredients(): Promise<Map<string, ProductIngredient[]>> {
  const ingredientMap = new Map<string, ProductIngredient[]>();
  let offset = 0;

  console.log('Fetching all product ingredients...');

  while (true) {
    const { data, error } = await supabase
      .from('product_ingredients')
      .select('product_id, position, ingredient_id, ingredients_dict(*)')
      .range(offset, offset + INGREDIENT_BATCH_SIZE - 1)
      .order('product_id')
      .order('position', { ascending: true });

    if (error) {
      console.error(`Ingredient fetch error at offset ${offset}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;

    const rows = data as unknown as IngredientRowWithProduct[];

    for (const row of rows) {
      const hydrated = hydrateIngredient(row);
      if (!hydrated) continue;

      if (!ingredientMap.has(row.product_id)) {
        ingredientMap.set(row.product_id, []);
      }
      ingredientMap.get(row.product_id)!.push(hydrated);
    }

    offset += data.length;

    if (offset % 5000 === 0) {
      console.log(`  Fetched ${offset} ingredient rows...`);
    }

    if (data.length < INGREDIENT_BATCH_SIZE) break;
  }

  console.log(`Loaded ingredients for ${ingredientMap.size} products`);
  return ingredientMap;
}

// ─── Statistics ───────────────────────────────────────────

function computeStats(scores: number[]): SegmentStats {
  if (scores.length === 0) {
    return { scores: [], avg_score: 0, median_score: 0, min_score: 0, max_score: 0, product_count: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, s) => acc + s, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return {
    scores: sorted,
    avg_score: Math.round((sum / sorted.length) * 10) / 10,
    median_score: Math.round(median * 10) / 10,
    min_score: sorted[0],
    max_score: sorted[sorted.length - 1],
    product_count: sorted.length,
  };
}

function segmentKey(seg: SegmentKey): string {
  return `${seg.category}|${seg.target_species}|${seg.is_grain_free}`;
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  // Fetch products and ingredients in parallel
  console.log('Fetching scoreable products and ingredients...');
  const [products, ingredientMap] = await Promise.all([
    fetchScoreableProducts(),
    fetchAllIngredients(),
  ]);
  console.log(`Found ${products.length} scoreable products (non-supplement, has ingredients_raw)`);

  const segments = new Map<string, { key: SegmentKey; scores: number[] }>();

  // Initialize all 8 segments
  for (const category of ['daily_food', 'treat'] as const) {
    for (const species of ['dog', 'cat'] as const) {
      for (const grainFree of [true, false]) {
        const key: SegmentKey = { category, target_species: species, is_grain_free: grainFree };
        segments.set(segmentKey(key), { key, scores: [] });
      }
    }
  }

  let scored = 0;
  let skipped = 0;
  const scoreUpdates: Array<{ id: string; base_score: number }> = [];

  for (const product of products) {
    const isTreat = product.category === 'treat';
    const isDailyFood = product.category === 'daily_food';

    if (!isTreat && !isDailyFood) {
      skipped++;
      continue;
    }

    // Look up pre-fetched ingredients
    const ingredients = ingredientMap.get(product.id);
    if (!ingredients || ingredients.length === 0) {
      skipped++;
      continue;
    }

    // For daily food: skip partial-score products (no GA) — they'd skew averages
    const hasGa = product.ga_protein_pct !== null ||
                  product.ga_fat_pct !== null ||
                  product.ga_fiber_pct !== null;

    // Score: Layer 1 + Layer 2 only (no pet profile = no Layer 3)
    const result = computeScore(product, ingredients);

    // Write base_score back to every scored product (even partial)
    scoreUpdates.push({ id: product.id, base_score: result.finalScore });

    // For category averages: exclude daily food without GA or with partial scores
    if (isDailyFood && (!hasGa || result.isPartialScore)) {
      skipped++;
      continue;
    }

    const key: SegmentKey = {
      category: isTreat ? 'treat' : 'daily_food',
      target_species: product.target_species === 'cat' ? 'cat' : 'dog',
      is_grain_free: product.is_grain_free,
    };

    segments.get(segmentKey(key))!.scores.push(result.finalScore);
    scored++;

    if (scored % 500 === 0) {
      console.log(`Scored ${scored}/${products.length} products...`);
    }
  }

  // Write base_score back to each product row
  console.log(`\nWriting base_score to ${scoreUpdates.length} products...`);
  const UPDATE_BATCH = 50;
  const now = new Date().toISOString();
  let updateErrors = 0;

  for (let i = 0; i < scoreUpdates.length; i += UPDATE_BATCH) {
    const batch = scoreUpdates.slice(i, i + UPDATE_BATCH);
    const promises = batch.map(({ id, base_score }) =>
      supabase
        .from('products')
        .update({ base_score, base_score_computed_at: now })
        .eq('id', id)
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error) updateErrors++;
    }

    if ((i + UPDATE_BATCH) % 500 === 0) {
      console.log(`  Updated ${Math.min(i + UPDATE_BATCH, scoreUpdates.length)}/${scoreUpdates.length}...`);
    }
  }

  if (updateErrors > 0) {
    console.error(`  ${updateErrors} update errors occurred`);
  } else {
    console.log(`  All ${scoreUpdates.length} products updated successfully`);
  }

  console.log(`\nScoring complete: ${scored} scored, ${skipped} skipped`);
  console.log('');

  // Compute stats and upsert
  const upsertRows: Array<{
    category: string;
    target_species: string;
    is_grain_free: boolean;
    avg_score: number;
    median_score: number;
    min_score: number;
    max_score: number;
    product_count: number;
    computed_at: string;
  }> = [];

  for (const [, segment] of segments) {
    const stats = computeStats(segment.scores);
    const label = `${segment.key.category} × ${segment.key.target_species} × ${segment.key.is_grain_free ? 'grain-free' : 'grain-inclusive'}`;

    console.log(`${label}: ${stats.product_count} products, avg=${stats.avg_score}, median=${stats.median_score}, range=[${stats.min_score}-${stats.max_score}]`);

    upsertRows.push({
      category: segment.key.category,
      target_species: segment.key.target_species,
      is_grain_free: segment.key.is_grain_free,
      avg_score: stats.avg_score,
      median_score: stats.median_score,
      min_score: stats.min_score,
      max_score: stats.max_score,
      product_count: stats.product_count,
      computed_at: new Date().toISOString(),
    });
  }

  console.log('\nUpserting category averages...');

  // Delete existing rows and insert fresh
  const { error: deleteError } = await supabase
    .from('category_averages')
    .delete()
    .gte('product_count', 0); // match all rows

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
  }

  const { error: insertError } = await supabase
    .from('category_averages')
    .insert(upsertRows);

  if (insertError) {
    console.error('Insert error:', insertError.message);
    process.exit(1);
  }

  console.log('Category averages written successfully.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
