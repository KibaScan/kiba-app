// supabase/functions/batch-score/index.ts
// Approach F: Delta Scoring + Two-Phase Edge Function
//
// Phase 1 (sync): Scores first 200 products, returns response immediately.
// Phase 2 (background): EdgeRuntime.waitUntil() scores remaining ~800 products
//   in 200-product chunks while the user views Phase 1 results.
// Delta mode: When cache is mature (≥80% coverage), only scores new/updated products.
//
// Called by batchScoreHybrid() in src/services/batchScoreOnDevice.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { computeScore } from './scoring/engine.ts';
import { hydrateIngredient } from './scoring/pipeline.ts';
import type { Product, PetProfile } from './types/index.ts';
import type { ProductIngredient } from './types/scoring.ts';
import { detectVarietyPack } from './utils/varietyPackDetector.ts';
import { isSupplementalByName } from './utils/supplementalClassifier.ts';
import { CURRENT_SCORING_VERSION } from './utils/constants.ts';

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const UPSERT_CHUNK = 500;
const INGREDIENT_QUERY_CHUNK = 50;
const QUERY_PAGE = 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes (full batch only)
const PHASE1_SIZE = 200; // Products scored synchronously before returning response
const DEFAULT_LIMIT = 1000; // Default server-side limit (client sends this)
const MAX_LIMIT = 2000; // Hard ceiling
const MIN_LIMIT = 50; // Hard floor
const PHASE2_CHUNK = 200; // Products per background chunk
const PHASE2_YIELD_MS = 50; // Event loop yield between chunks for GC
const CACHE_MATURITY_THRESHOLD = 0.8; // Delta mode requires ≥80% cache coverage

const SCORING_COLUMNS = [
  'id', 'brand', 'name', 'category', 'target_species',
  'aafco_statement', 'life_stage_claim', 'preservative_type',
  'ga_protein_pct', 'ga_fat_pct', 'ga_fiber_pct', 'ga_moisture_pct',
  'ga_kcal_per_cup', 'ga_kcal_per_kg', 'ga_taurine_pct', 'ga_l_carnitine_mg',
  'ga_dha_pct', 'ga_omega3_pct', 'ga_omega6_pct', 'ga_zinc_mg_kg', 'ga_probiotics_cfu',
  'is_grain_free', 'is_supplemental', 'is_vet_diet', 'is_recalled',
  'product_form', 'updated_at', 'ingredients_raw',
].join(',');

// ─── Helpers (shared by Phase 1 & Phase 2) ──────────────────

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

interface ScoringContext {
  petId: string;
  petProfile: PetProfile;
  petRow: { updated_at: string; health_reviewed_at: string | null };
  allergens: string[];
  conditions: string[];
  clientScoringVersion: string;
}

/** Fetch ingredients for a batch of products (chunked + paginated). */
async function fetchIngredients(
  productIds: string[],
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<Map<string, ProductIngredient[]>> {
  const ingredientRows: Array<Record<string, unknown>> = [];

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
        console.error('[batch-score] Ingredients query failed:', pageErr);
        break; // Skip this chunk, continue with others
      }
      if (!page || page.length === 0) break;
      ingredientRows.push(...page);
      if (page.length < QUERY_PAGE) break;
      ingFrom += QUERY_PAGE;
    }
  }

  const byProduct = new Map<string, ProductIngredient[]>();
  for (const row of ingredientRows) {
    const hydrated = hydrateIngredient(row);
    if (!hydrated) continue;
    const pid = row.product_id as string;
    const list = byProduct.get(pid) ?? [];
    list.push(hydrated);
    byProduct.set(pid, list);
  }
  return byProduct;
}

/** Score products and upsert results. Returns count of scored products. */
async function scoreAndUpsert(
  products: Product[],
  ingredientsByProduct: Map<string, ProductIngredient[]>,
  ctx: ScoringContext,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<number> {
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
        ctx.petProfile,
        ctx.allergens,
        ctx.conditions,
      );

      results.push({
        pet_id: ctx.petId,
        product_id: product.id,
        final_score: result.finalScore,
        is_partial_score: result.isPartialScore,
        is_supplemental: scoringProduct.is_supplemental,
        category: result.category,
        product_form: product.product_form ?? null,
        life_stage_at_scoring: ctx.petProfile.life_stage ?? null,
        pet_updated_at: ctx.petRow.updated_at,
        pet_health_reviewed_at: ctx.petRow.health_reviewed_at,
        product_updated_at: product.updated_at,
        scored_at: scoredAt,
        scoring_version: ctx.clientScoringVersion,
      });
    } catch (err) {
      console.error(`[batch-score] Failed to score product ${product.id}:`, err);
    }
  }

  // Chunked upsert
  for (let i = 0; i < results.length; i += UPSERT_CHUNK) {
    const chunk = results.slice(i, i + UPSERT_CHUNK);
    const { error: upsertError } = await supabase
      .from('pet_product_scores')
      .upsert(chunk, { onConflict: 'pet_id,product_id' });

    if (upsertError) {
      console.error(
        `[batch-score] Upsert chunk ${Math.floor(i / UPSERT_CHUNK)} failed:`,
        upsertError,
      );
    }
  }

  return results.length;
}

// ─── Request Handler ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const petId = body.pet_id;
  const petProfile = body.pet_profile as PetProfile | undefined;
  const filterCategory = typeof body.category === 'string' ? body.category : null;
  const filterForm = typeof body.product_form === 'string' ? body.product_form : null;
  // Payload-driven versioning: client tells us which version to write.
  // Old clients won't send this field → fallback '1' prevents infinite wipe+score loops.
  const clientScoringVersion = typeof body.scoring_version === 'string'
    ? body.scoring_version : '1';
  const limitSize = typeof body.limit_size === 'number'
    ? Math.min(Math.max(body.limit_size, MIN_LIMIT), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (!petId || typeof petId !== 'string') {
    return jsonResponse({ error: 'pet_id is required' }, 400);
  }
  if (!petProfile || typeof petProfile !== 'object') {
    return jsonResponse({ error: 'pet_profile is required' }, 400);
  }

  const startTime = Date.now();

  // Service role client — bypasses RLS (ES256 auth tokens not supported by gateway).
  // Pet ownership is verified at the client layer; function is rate-limited.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
  );

  // ── 1. Verify pet exists + get invalidation anchors ──

  const { data: petRow, error: petError } = await supabase
    .from('pets')
    .select('id, updated_at, health_reviewed_at')
    .eq('id', petId)
    .maybeSingle();

  if (petError || !petRow) {
    return jsonResponse({ error: 'Pet not found', detail: petError?.message ?? 'no row returned', pet_id: petId }, 404);
  }

  // ── 2. Delta check + cache maturity ──

  let deltaTimestamp: string | null = null;
  let cacheCount = 0;
  let totalProducts = 0;

  if (filterCategory) {
    // Build form-aware maturity queries when filterForm is specified.
    // Without this, dry+wet scores fill the 80% threshold and minority
    // forms (freeze-dried, raw, dehydrated) never get a full batch.
    let deltaQuery = supabase
      .from('pet_product_scores')
      .select('product_updated_at')
      .eq('pet_id', petId)
      .eq('category', filterCategory);
    if (filterForm) deltaQuery = deltaQuery.eq('product_form', filterForm);
    deltaQuery = deltaQuery.order('product_updated_at', { ascending: false }).limit(1);

    let countQuery = supabase
      .from('pet_product_scores')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .eq('category', filterCategory);
    if (filterForm) countQuery = countQuery.eq('product_form', filterForm);

    let totalQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('target_species', petProfile.species)
      .eq('is_vet_diet', false)
      .eq('is_recalled', false)
      .eq('category', filterCategory);
    if (filterForm) totalQuery = totalQuery.eq('product_form', filterForm);

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

  // ── 3. Rate limit (full batch only — delta is cheap) ──

  if (!isCacheMature) {
    // Rate limit per pet+category (not just per pet) — scoring treats
    // should not block scoring dry food.
    let rateLimitQuery = supabase
      .from('pet_product_scores')
      .select('scored_at')
      .eq('pet_id', petId)
      .order('scored_at', { ascending: false })
      .limit(1);
    if (filterCategory) rateLimitQuery = rateLimitQuery.eq('category', filterCategory);
    if (filterForm) rateLimitQuery = rateLimitQuery.eq('product_form', filterForm);

    const { data: lastScore } = await rateLimitQuery.maybeSingle();

    if (lastScore?.scored_at) {
      const elapsed = Date.now() - new Date(lastScore.scored_at).getTime();
      if (elapsed < RATE_LIMIT_MS) {
        return jsonResponse({ scored: 0, skipped: 'rate_limited', duration_ms: Date.now() - startTime });
      }
    }
  }

  // ── 4. Fetch allergens & conditions server-side (authoritative) ──

  const [allergensRes, conditionsRes] = await Promise.all([
    supabase.from('pet_allergens').select('allergen').eq('pet_id', petId),
    supabase
      .from('pet_conditions')
      .select('condition_tag')
      .eq('pet_id', petId),
  ]);

  const allergens = (allergensRes.data ?? []).map(
    (r: { allergen: string }) => r.allergen,
  );
  const conditions = (conditionsRes.data ?? []).map(
    (r: { condition_tag: string }) => r.condition_tag,
  );

  const scoringCtx: ScoringContext = {
    petId: petId as string,
    petProfile,
    petRow: { updated_at: petRow.updated_at, health_reviewed_at: petRow.health_reviewed_at },
    allergens,
    conditions,
    clientScoringVersion,
  };

  // ── 5. Build product query (delta or full batch) ──

  const buildBaseQuery = () => {
    let q = supabase
      .from('products')
      .select(SCORING_COLUMNS)
      .eq('target_species', petProfile.species)
      .eq('is_vet_diet', false)
      .eq('is_recalled', false);
    if (filterCategory) q = q.eq('category', filterCategory);
    if (filterForm) q = q.eq('product_form', filterForm);
    return q;
  };

  // ── 6. Delta mode: score only new/updated products ──

  if (isCacheMature) {
    const { data: deltaProducts, error: deltaErr } = await buildBaseQuery()
      .gt('updated_at', deltaTimestamp!);

    if (deltaErr) {
      return jsonResponse({ error: `Failed to fetch products: ${deltaErr.message}` }, 500);
    }

    const products = (deltaProducts ?? []) as Product[];

    if (products.length === 0) {
      return jsonResponse({ scored: 0, duration_ms: Date.now() - startTime, delta: true });
    }

    // Score the delta (typically 0-10 products — no phasing needed)
    const ingredientsByProduct = await fetchIngredients(
      products.map(p => p.id),
      supabase,
    );
    const scored = await scoreAndUpsert(products, ingredientsByProduct, scoringCtx, supabase);

    console.log(`[batch-score] Delta scored ${scored} new/updated products`);
    return jsonResponse({ scored, duration_ms: Date.now() - startTime, delta: true });
  }

  // ── 7. Full batch mode: Phase 1 (sync) + Phase 2 (background) ──

  // Phase 1: Score the first PHASE1_SIZE products synchronously
  const phase1Limit = Math.min(PHASE1_SIZE, limitSize);

  const { data: p1Data, error: p1Err } = await buildBaseQuery()
    .order('updated_at', { ascending: false })
    .limit(phase1Limit);

  if (p1Err) {
    return jsonResponse({ error: `Failed to fetch products: ${p1Err.message}` }, 500);
  }

  const phase1Products = (p1Data ?? []) as Product[];

  if (phase1Products.length === 0) {
    return jsonResponse({ scored: 0, duration_ms: Date.now() - startTime });
  }

  // Fetch ingredients + score Phase 1
  const p1Ingredients = await fetchIngredients(
    phase1Products.map(p => p.id),
    supabase,
  );
  const phase1Scored = await scoreAndUpsert(phase1Products, p1Ingredients, scoringCtx, supabase);

  // Phase 2: Background scoring of remaining products (if needed)
  const needsPhase2 =
    limitSize > PHASE1_SIZE &&
    phase1Products.length >= PHASE1_SIZE; // Small category = no Phase 2

  if (needsPhase2) {
    // Create a fresh Supabase client for Phase 2 (background context)
    const p2Supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!,
    );

    EdgeRuntime.waitUntil((async () => {
      let totalPhase2Scored = 0;

      for (let offset = PHASE1_SIZE; offset < limitSize; offset += PHASE2_CHUNK) {
        try {
          const { data: chunkData } = await buildBaseQuery()
            .order('updated_at', { ascending: false })
            .range(offset, offset + PHASE2_CHUNK - 1);

          const chunkProducts = (chunkData ?? []) as Product[];
          if (chunkProducts.length === 0) break; // No more products

          const chunkIngredients = await fetchIngredients(
            chunkProducts.map(p => p.id),
            p2Supabase,
          );
          const scored = await scoreAndUpsert(
            chunkProducts, chunkIngredients, scoringCtx, p2Supabase,
          );
          totalPhase2Scored += scored;

          // Yield event loop between chunks for GC
          await new Promise(resolve => setTimeout(resolve, PHASE2_YIELD_MS));
        } catch (err) {
          console.error(`[batch-score] Phase 2 chunk at offset ${offset} failed:`, err);
          // Continue to next chunk — partial completion is fine.
          // Cache maturity check will trigger a healing full batch if needed.
        }
      }

      console.log(`[batch-score] Phase 2 completed: ${totalPhase2Scored} additional products scored`);
    })());
  }

  // Return Phase 1 response immediately
  return jsonResponse({
    scored: phase1Scored,
    duration_ms: Date.now() - startTime,
    phase2_started: needsPhase2,
  });
});
