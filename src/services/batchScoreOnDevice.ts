// Client-side batch scoring — replaces batch-score Edge Function.
// Fetches candidate products + ingredients from Supabase, scores on-device
// using the same pure computeScore() engine, upserts to pet_product_scores.
// Solves the WORKER_LIMIT OOM on Supabase free tier.

import { supabase } from './supabase';
import { computeScore } from './scoring/engine';
import { hydrateIngredient } from './scoring/pipeline';
import { getPetAllergens, getPetConditions } from './petService';
import { detectVarietyPack } from '../utils/varietyPackDetector';
import { isSupplementalByName } from '../utils/supplementalClassifier';
import { CURRENT_SCORING_VERSION } from '../utils/constants';
import type { Product } from '../types';
import type { Pet } from '../types/pet';
import type { ProductIngredient } from '../types/scoring';

// ─── Constants (mirror Edge Function) ───────────────────────

const UPSERT_CHUNK = 500;
const INGREDIENT_QUERY_CHUNK = 50;
const QUERY_PAGE = 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

// In-memory rate limit per pet (survives across component mounts within app session)
const lastBatchTimestamp = new Map<string, number>();

// Scoring-only columns (same as Edge Function)
const SCORING_COLUMNS = [
  'id', 'brand', 'name', 'category', 'target_species',
  'aafco_statement', 'life_stage_claim', 'preservative_type',
  'ga_protein_pct', 'ga_fat_pct', 'ga_fiber_pct', 'ga_moisture_pct',
  'ga_kcal_per_cup', 'ga_kcal_per_kg', 'ga_taurine_pct', 'ga_l_carnitine_mg',
  'ga_dha_pct', 'ga_omega3_pct', 'ga_omega6_pct', 'ga_zinc_mg_kg', 'ga_probiotics_cfu',
  'is_grain_free', 'is_supplemental', 'is_vet_diet', 'is_recalled',
  'product_form', 'updated_at', 'ingredients_raw',
].join(',');

// ─── Row shape from Supabase ingredient join ────────────────

interface IngredientRow {
  product_id: string;
  position: number;
  ingredient_id: string;
  ingredients_dict: Record<string, unknown> | null;
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Batch-scores candidate products on-device for a given pet.
 * Fetches products + ingredients from Supabase, runs computeScore() in a loop,
 * upserts results to pet_product_scores cache.
 *
 * Same signature as the former triggerBatchScore() for drop-in replacement.
 */
export async function batchScoreOnDevice(
  petId: string,
  petProfile: Pet,
  category?: string,
  productForm?: string | null,
): Promise<{ scored: number; duration_ms: number }> {
  const startTime = Date.now();

  // ── 1. In-memory rate limit ──

  const lastRun = lastBatchTimestamp.get(petId);
  if (lastRun && Date.now() - lastRun < RATE_LIMIT_MS) {
    return { scored: 0, duration_ms: 0 };
  }

  // ── 2. Fetch pet anchors (updated_at, health_reviewed_at) ──

  const { data: petRow, error: petError } = await supabase
    .from('pets')
    .select('id, updated_at, health_reviewed_at')
    .eq('id', petId)
    .maybeSingle();

  if (petError || !petRow) {
    throw new Error(`Pet not found: ${petError?.message ?? petId}`);
  }

  // ── 3. Fetch allergens & conditions ──

  const [allergenRows, conditionRows] = await Promise.all([
    getPetAllergens(petId),
    getPetConditions(petId),
  ]);

  const allergens = allergenRows.map((r) => r.allergen);
  const conditions = conditionRows.map((r) => r.condition_tag);

  // ── 4. Fetch candidate products (200 max) ──

  let query = supabase
    .from('products')
    .select(SCORING_COLUMNS)
    .eq('target_species', petProfile.species)
    .eq('is_vet_diet', false)
    .eq('is_recalled', false);
  if (category) query = query.eq('category', category);
  if (productForm) query = query.eq('product_form', productForm);

  const { data: productData, error: prodErr } = await query.limit(200);

  if (prodErr) {
    throw new Error(`Failed to fetch products: ${prodErr.message}`);
  }

  const products = (productData ?? []) as Product[];

  if (products.length === 0) {
    lastBatchTimestamp.set(petId, Date.now());
    return { scored: 0, duration_ms: Date.now() - startTime };
  }

  // ── 5. Bulk ingredient fetch (chunked by 50 IDs, paginated at 1000 rows) ──

  const productIds = products.map((p) => p.id);
  const ingredientRows: IngredientRow[] = [];

  for (let c = 0; c < productIds.length; c += INGREDIENT_QUERY_CHUNK) {
    const idChunk = productIds.slice(c, c + INGREDIENT_QUERY_CHUNK);
    let ingFrom = 0;
    while (true) {
      const { data: page, error: pageErr } = await supabase
        .from('product_ingredients')
        .select('product_id, position, ingredient_id, ingredients_dict(*)')
        .in('product_id', idChunk)
        .order('position')
        .range(ingFrom, ingFrom + QUERY_PAGE - 1);

      if (pageErr) {
        console.error('[batchScoreOnDevice] Ingredients query failed:', pageErr);
        break;
      }
      if (!page || page.length === 0) break;
      ingredientRows.push(...(page as unknown as IngredientRow[]));
      if (page.length < QUERY_PAGE) break;
      ingFrom += QUERY_PAGE;
    }
  }

  // ── 6. Hydrate + group by product_id ──

  const ingredientsByProduct = new Map<string, ProductIngredient[]>();

  for (const row of ingredientRows) {
    const hydrated = hydrateIngredient(row);
    if (!hydrated) continue;

    const list = ingredientsByProduct.get(row.product_id) ?? [];
    list.push(hydrated);
    ingredientsByProduct.set(row.product_id, list);
  }

  // ── 7. Scoring loop ──

  const results: Array<Record<string, unknown>> = [];
  const scoredAt = new Date().toISOString();

  for (const product of products) {
    try {
      const ingredients = ingredientsByProduct.get(product.id);
      if (!ingredients || ingredients.length === 0) continue;

      // D-145: variety pack bypass
      if (detectVarietyPack(product.name, ingredients)) continue;

      // D-136: runtime supplemental detection
      const scoringProduct =
        !product.is_supplemental && isSupplementalByName(product.name)
          ? { ...product, is_supplemental: true }
          : product;

      const result = computeScore(
        scoringProduct,
        ingredients,
        petProfile,
        allergens,
        conditions,
      );

      results.push({
        pet_id: petId,
        product_id: product.id,
        final_score: result.finalScore,
        is_partial_score: result.isPartialScore,
        is_supplemental: scoringProduct.is_supplemental,
        category: result.category,
        life_stage_at_scoring: petProfile.life_stage ?? null,
        pet_updated_at: petRow.updated_at,
        pet_health_reviewed_at: petRow.health_reviewed_at,
        product_updated_at: product.updated_at,
        scored_at: scoredAt,
        scoring_version: CURRENT_SCORING_VERSION,
      });
    } catch (err) {
      console.error(
        `[batchScoreOnDevice] Failed to score product ${product.id}:`,
        err,
      );
    }
  }

  // ── 8. Chunked upsert into pet_product_scores ──

  for (let i = 0; i < results.length; i += UPSERT_CHUNK) {
    const chunk = results.slice(i, i + UPSERT_CHUNK);
    const { error: upsertError } = await supabase
      .from('pet_product_scores')
      .upsert(chunk, { onConflict: 'pet_id,product_id' });

    if (upsertError) {
      console.error(
        `[batchScoreOnDevice] Upsert chunk ${Math.floor(i / UPSERT_CHUNK)} failed:`,
        upsertError,
      );
    }
  }

  // ── 9. Mark rate limit + return ──

  lastBatchTimestamp.set(petId, Date.now());

  return {
    scored: results.length,
    duration_ms: Date.now() - startTime,
  };
}

// ─── Hybrid: Edge Function first, client-side fallback ──────

/**
 * Tries the batch-score Edge Function first (scores all 19K products server-side).
 * Falls back to client-side scoring (200 products) if the Edge Function fails
 * (WORKER_LIMIT on free tier, timeout, network error, etc.).
 */
export async function batchScoreHybrid(
  petId: string,
  petProfile: Pet,
  category?: string,
  productForm?: string | null,
): Promise<{ scored: number; duration_ms: number }> {
  // Try Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('batch-score', {
      body: {
        pet_id: petId,
        pet_profile: petProfile,
        ...(category && { category }),
        ...(productForm && { product_form: productForm }),
      },
    });

    if (!error && data?.scored != null) {
      return { scored: data.scored, duration_ms: data.duration_ms ?? 0 };
    }
  } catch {
    // Edge Function unavailable — fall through to client-side
  }

  // Fallback: client-side scoring (200 products)
  return batchScoreOnDevice(petId, petProfile, category, productForm);
}
