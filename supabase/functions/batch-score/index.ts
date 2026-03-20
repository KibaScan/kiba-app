// supabase/functions/batch-score/index.ts
// M5: Batch-score all products for a pet, upsert into pet_product_scores.
// Called by triggerBatchScore() in src/services/topMatches.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { computeScore } from './scoring/engine.ts';
import { hydrateIngredient } from './scoring/pipeline.ts';
import type { Product, PetProfile } from './types/index.ts';
import type { ProductIngredient } from './types/scoring.ts';
import { detectVarietyPack } from './utils/varietyPackDetector.ts';
import { isSupplementalByName } from './utils/supplementalClassifier.ts';
import { CURRENT_SCORING_VERSION } from './utils/constants.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const UPSERT_CHUNK = 500;
const QUERY_PAGE = 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

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

  if (!petId || typeof petId !== 'string') {
    return jsonResponse({ error: 'pet_id is required' }, 400);
  }
  if (!petProfile || typeof petProfile !== 'object') {
    return jsonResponse({ error: 'pet_profile is required' }, 400);
  }

  const startTime = Date.now();

  // Supabase client with user's JWT (RLS enforced)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    },
  );

  // ── 1. Auth check: verify ownership + get invalidation anchors ──

  const { data: petRow, error: petError } = await supabase
    .from('pets')
    .select('id, updated_at, health_reviewed_at')
    .eq('id', petId)
    .maybeSingle();

  if (petError || !petRow) {
    return jsonResponse({ error: 'Pet not found or access denied' }, 403);
  }

  // ── 2. Rate limit: skip if last batch was < 5 min ago ──

  const { data: lastScore } = await supabase
    .from('pet_product_scores')
    .select('scored_at')
    .eq('pet_id', petId)
    .order('scored_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastScore?.scored_at) {
    const elapsed = Date.now() - new Date(lastScore.scored_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      return jsonResponse({ scored: 0, skipped: 'rate_limited' });
    }
  }

  // ── 3. Fetch allergens & conditions server-side (authoritative) ──

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

  // ── 4. Bulk product query (paginated) ──

  const products: Product[] = [];
  let productFrom = 0;
  while (true) {
    const { data: page, error: pageErr } = await supabase
      .from('products')
      .select('*')
      .eq('target_species', petProfile.species)
      .eq('is_vet_diet', false)
      .eq('is_recalled', false)
      .range(productFrom, productFrom + QUERY_PAGE - 1);

    if (pageErr) {
      return jsonResponse({ error: 'Failed to fetch products' }, 500);
    }
    if (!page || page.length === 0) break;
    products.push(...(page as Product[]));
    if (page.length < QUERY_PAGE) break;
    productFrom += QUERY_PAGE;
  }

  if (products.length === 0) {
    return jsonResponse({ scored: 0, duration_ms: Date.now() - startTime });
  }

  // ── 5. Bulk ingredient query (chunked + paginated) ──

  const productIds = products.map((p) => p.id);
  const ingredientRows: Array<Record<string, unknown>> = [];

  for (let c = 0; c < productIds.length; c += UPSERT_CHUNK) {
    const idChunk = productIds.slice(c, c + UPSERT_CHUNK);
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
        return jsonResponse({ error: 'Failed to fetch ingredients' }, 500);
      }
      if (!page || page.length === 0) break;
      ingredientRows.push(...page);
      if (page.length < QUERY_PAGE) break;
      ingFrom += QUERY_PAGE;
    }
  }

  // ── 6. Group ingredients by product_id ──

  const ingredientsByProduct = new Map<string, ProductIngredient[]>();

  for (const row of ingredientRows ?? []) {
    const hydrated = hydrateIngredient(row);
    if (!hydrated) continue;

    const pid = row.product_id as string;
    const list = ingredientsByProduct.get(pid) ?? [];
    list.push(hydrated);
    ingredientsByProduct.set(pid, list);
  }

  // ── 7. Scoring loop ──

  const results: Array<Record<string, unknown>> = [];
  const scoredAt = new Date().toISOString();

  for (const product of products as Product[]) {
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
        `[batch-score] Failed to score product ${product.id}:`,
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
        `[batch-score] Upsert chunk ${Math.floor(i / UPSERT_CHUNK)} failed:`,
        upsertError,
      );
    }
  }

  // ── 9. Response ──

  return jsonResponse({
    scored: results.length,
    duration_ms: Date.now() - startTime,
  });
});
