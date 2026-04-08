// Client-side batch scoring — fallback when Edge Function is unavailable.
// Fetches candidate products + ingredients from Supabase, scores on-device
// using the same pure computeScore() engine, upserts to pet_product_scores.
//
// Approach F: Delta Scoring + Asymmetric Limits
// - Delta mode: only scores new/updated products (cache maturity gated)
// - Client limit: 200 products (Edge Function handles 1000 via two-phase)

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

// ─── Constants (mirror Edge Function where noted) ──────────

const UPSERT_CHUNK = 500;
const INGREDIENT_QUERY_CHUNK = 50;
const QUERY_PAGE = 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes (full batch only)
const CLIENT_LIMIT = 200; // Client-side product cap (Edge Function uses 1000)
const CACHE_MATURITY_THRESHOLD = 0.8; // Delta mode requires ≥80% cache coverage

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
 * Supports delta scoring (only new/updated products) when cache is mature.
 * Falls back to full batch when cache is empty or incomplete.
 */
export async function batchScoreOnDevice(
  petId: string,
  petProfile: Pet,
  category?: string,
  productForm?: string | null,
  limitSize: number = CLIENT_LIMIT,
): Promise<{ scored: number; duration_ms: number }> {
  const startTime = Date.now();

  // ── 1. Delta check + cache maturity (lightweight, always allowed) ──

  let deltaTimestamp: string | null = null;
  let cacheCount = 0;
  let totalProducts = 0;

  if (category) {
    // Build form-aware maturity queries when productForm is specified.
    // Without this, dry+wet scores fill the 80% threshold and minority
    // forms (freeze-dried, raw, dehydrated) never get a full batch.
    let deltaQuery = supabase
      .from('pet_product_scores')
      .select('product_updated_at')
      .eq('pet_id', petId)
      .eq('category', category);
    if (productForm) deltaQuery = deltaQuery.eq('product_form', productForm);
    deltaQuery = deltaQuery.order('product_updated_at', { ascending: false }).limit(1);

    let countQuery = supabase
      .from('pet_product_scores')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .eq('category', category);
    if (productForm) countQuery = countQuery.eq('product_form', productForm);

    let totalQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('target_species', petProfile.species)
      .eq('is_vet_diet', false)
      .eq('is_recalled', false)
      .eq('category', category);
    if (productForm) totalQuery = totalQuery.eq('product_form', productForm);

    const [deltaRes, countRes, totalRes] = await Promise.all([
      deltaQuery.maybeSingle(),
      countQuery,
      totalQuery,
    ]);
    deltaTimestamp = deltaRes.data?.product_updated_at ?? null;
    cacheCount = countRes.count ?? 0;
    totalProducts = totalRes.count ?? 0;
  }

  const isCacheMature =
    deltaTimestamp != null &&
    totalProducts > 0 &&
    cacheCount >= totalProducts * CACHE_MATURITY_THRESHOLD;

  // ── 2. Rate limit (full batch only — delta is cheap) ──

  if (!isCacheMature) {
    const rateLimitKey = category
      ? `${petId}:${category}${productForm ? ':' + productForm : ''}`
      : petId;
    const lastRun = lastBatchTimestamp.get(rateLimitKey);
    if (lastRun && Date.now() - lastRun < RATE_LIMIT_MS) {
      return { scored: 0, duration_ms: 0 };
    }
  }

  // ── 3. Fetch pet anchors (updated_at, health_reviewed_at) ──

  const { data: petRow, error: petError } = await supabase
    .from('pets')
    .select('id, updated_at, health_reviewed_at')
    .eq('id', petId)
    .maybeSingle();

  if (petError || !petRow) {
    throw new Error(`Pet not found: ${petError?.message ?? petId}`);
  }

  // ── 4. Fetch allergens & conditions ──

  const [allergenRows, conditionRows] = await Promise.all([
    getPetAllergens(petId),
    getPetConditions(petId),
  ]);

  const allergens = allergenRows.map((r) => r.allergen);
  const conditions = conditionRows.map((r) => r.condition_tag);

  // ── 5. Fetch candidate products (delta or full batch) ──

  let query = supabase
    .from('products')
    .select(SCORING_COLUMNS)
    .eq('target_species', petProfile.species)
    .eq('is_vet_diet', false)
    .eq('is_recalled', false);
  if (category) query = query.eq('category', category);
  if (productForm) query = query.eq('product_form', productForm);

  if (isCacheMature) {
    // Delta mode: only fetch new/updated products since last score
    query = query.gt('updated_at', deltaTimestamp!);
  } else {
    // Full batch: newest first, capped at limitSize
    query = query.order('updated_at', { ascending: false }).limit(limitSize);
  }

  const { data: productData, error: prodErr } = await query;

  if (prodErr) {
    throw new Error(`Failed to fetch products: ${prodErr.message}`);
  }

  const products = (productData ?? []) as unknown as Product[];

  if (products.length === 0) {
    const emptyRateLimitKey = category
      ? `${petId}:${category}${productForm ? ':' + productForm : ''}`
      : petId;
    if (!isCacheMature) lastBatchTimestamp.set(emptyRateLimitKey, Date.now());
    return { scored: 0, duration_ms: Date.now() - startTime };
  }

  if (__DEV__) {
    console.log(
      `[batchScoreOnDevice] ${isCacheMature ? 'Delta' : 'Full batch'}: ${products.length} products to score`,
    );
  }

  // ── 6. Bulk ingredient fetch (chunked by 50 IDs, paginated at 1000 rows) ──

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

  // ── 7. Hydrate + group by product_id ──

  const ingredientsByProduct = new Map<string, ProductIngredient[]>();

  for (const row of ingredientRows) {
    const hydrated = hydrateIngredient(row as unknown as Parameters<typeof hydrateIngredient>[0]);
    if (!hydrated) continue;

    const list = ingredientsByProduct.get(row.product_id) ?? [];
    list.push(hydrated);
    ingredientsByProduct.set(row.product_id, list);
  }

  // ── 8. Scoring loop ──

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
        product_form: product.product_form ?? null,
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

  // ── 9. Chunked upsert into pet_product_scores ──

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

  // ── 10. Mark rate limit (full batch only) + return ──

  if (!isCacheMature) {
    const doneRateLimitKey = category
      ? `${petId}:${category}${productForm ? ':' + productForm : ''}`
      : petId;
    lastBatchTimestamp.set(doneRateLimitKey, Date.now());
  }

  return {
    scored: results.length,
    duration_ms: Date.now() - startTime,
  };
}

// ─── Hybrid: Edge Function first, client-side fallback ──────

/**
 * Tries the batch-score Edge Function first (1000 products, two-phase).
 * Falls back to client-side scoring (200 products) if the Edge Function fails.
 * Both paths support delta scoring when cache is mature.
 */
export async function batchScoreHybrid(
  petId: string,
  petProfile: Pet,
  category?: string,
  productForm?: string | null,
): Promise<{ scored: number; duration_ms: number }> {
  // Try Edge Function first (1000 product limit, two-phase)
  try {
    const { data, error } = await supabase.functions.invoke<{
      scored: number;
      duration_ms: number;
      phase2_started?: boolean;
    }>('batch-score', {
      body: {
        pet_id: petId,
        pet_profile: petProfile,
        limit_size: 1000,
        scoring_version: CURRENT_SCORING_VERSION,
        ...(category && { category }),
        ...(productForm && { product_form: productForm }),
      },
    });
    if (__DEV__ && error) {
      // Try to read the response body for more detail
      try {
        const ctx = (error as any).context;
        if (ctx instanceof Response) {
          const text = await ctx.clone().text();
          console.log('[batchScoreHybrid] Edge Function response body:', text);
        }
      } catch { /* ignore */ }
    }

    if (!error && data?.scored != null) {
      if (__DEV__) {
        console.log(
          `[batchScoreHybrid] Edge Function scored ${data.scored} products in ${data.duration_ms}ms` +
          (data.phase2_started ? ' (Phase 2 running in background)' : ''),
        );
      }
      return { scored: data.scored, duration_ms: data.duration_ms ?? 0 };
    }
    if (__DEV__) {
      const ctx = error?.context;
      const status = ctx?.status ?? ctx?.statusCode ?? 'unknown';
      const msg = typeof data === 'string' ? data : JSON.stringify(data);
      console.log(`[batchScoreHybrid] Edge Function failed (HTTP ${status}), falling back to client-side. error=${error?.message} body=${msg}`);
    }
  } catch (err) {
    if (__DEV__) console.log('[batchScoreHybrid] Edge Function unavailable, falling back to client-side', err);
  }

  // Fallback: client-side scoring (200 product limit)
  const result = await batchScoreOnDevice(petId, petProfile, category, productForm, CLIENT_LIMIT);
  if (__DEV__) console.log(`[batchScoreHybrid] Client-side scored ${result.scored} products in ${result.duration_ms}ms`);
  return result;
}
