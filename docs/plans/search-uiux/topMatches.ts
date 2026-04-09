// M5 Top Matches Service — Cache freshness, query, and batch trigger.
// Phase 3 of TOP_MATCHES_PLAN.md: lazy invalidation + cache queries.
// No store sync — deferred to useTopMatchesStore (Phase 5).

import { supabase } from './supabase';
import { batchScoreHybrid, SCORING_COLUMNS } from './batchScoreOnDevice';
import { computeScore } from './scoring/engine';
import { hydrateIngredient } from './scoring/pipeline';
import { getPetAllergens, getPetConditions } from './petService';
import { isSupplementalByName } from '../utils/supplementalClassifier';
import { detectVarietyPack } from '../utils/varietyPackDetector';
import type { Pet } from '../types/pet';
import type { Product } from '../types';
import type { ProductIngredient, ScoredResult } from '../types/scoring';
import { deriveLifeStage, parseDateString } from '../utils/lifeStage';
import { CURRENT_SCORING_VERSION } from '../utils/constants';

// ─── Types ──────────────────────────────────────────────

export interface CachedScore {
  product_id: string;
  final_score: number;
  is_partial_score: boolean;
  is_supplemental: boolean;
  category: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
}

interface CachedRow {
  life_stage_at_scoring: string | null;
  pet_updated_at: string;
  pet_health_reviewed_at: string | null;
  scoring_version: string;
}

interface FetchFilters {
  category?: 'daily_food' | 'treat';
  searchQuery?: string;
}

// ─── Cache Freshness ────────────────────────────────────

/**
 * Sample one cached row for this pet and check 5 invalidation conditions.
 * Returns false (stale) if any check fails. Returns true only if all pass.
 */
export async function checkCacheFreshness(pet: Pet): Promise<boolean> {
  const { data, error } = await supabase
    .from('pet_product_scores')
    .select('life_stage_at_scoring, pet_updated_at, pet_health_reviewed_at, scoring_version')
    .eq('pet_id', pet.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const cached = data as CachedRow;

  // 1. Life stage drift
  const currentLifeStage = pet.date_of_birth
    ? deriveLifeStage(
        (() => {
          const p = parseDateString(pet.date_of_birth!);
          return new Date(p.year, p.month, p.day);
        })(),
        pet.species,
        pet.breed_size,
      )
    : null;

  if (currentLifeStage !== cached.life_stage_at_scoring) return false;

  // 2. Profile edit
  if (pet.updated_at > cached.pet_updated_at) return false;

  // 3. Health update
  if (
    pet.health_reviewed_at != null &&
    pet.health_reviewed_at > (cached.pet_health_reviewed_at ?? '')
  ) return false;

  // 4. Engine version
  if (cached.scoring_version !== CURRENT_SCORING_VERSION) return false;

  return true;
}

// ─── Cache Invalidation ────────────────────────────────

/**
 * Delete ALL cached scores for a pet. Called when checkCacheFreshness detects
 * staleness. Full wipe (not filtered by pet_updated_at) because life stage
 * drift and engine version bumps don't change pet_updated_at — a targeted
 * delete would miss those rows, leaving the cache appearing "mature" and
 * trapping batch scoring in delta mode.
 */
export async function invalidateStaleScores(petId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pet_product_scores')
    .delete({ count: 'exact' })
    .eq('pet_id', petId);

  if (error) {
    console.error('[invalidateStaleScores] DELETE failed:', error.message);
    return -1;
  }

  if (__DEV__ && (count ?? 0) > 0) {
    console.log(`[invalidateStaleScores] Deleted ${count} stale rows for pet ${petId}`);
  }

  return count ?? 0;
}

// In-memory lock prevents overlapping invalidation/scoring runs from rapid
// tab switching (useFocusEffect fires on every Home tab focus).
const updatingPets = new Set<string>();

/**
 * Check cache freshness → invalidate stale rows → re-score via Edge Function.
 * Called from HomeScreen useFocusEffect. Concurrency-safe per pet.
 */
export async function ensureCacheFresh(petId: string, pet: Pet): Promise<void> {
  if (updatingPets.has(petId)) return;
  updatingPets.add(petId);

  try {
    const fresh = await checkCacheFreshness(pet);
    if (fresh) return;

    await invalidateStaleScores(petId);
    await batchScoreHybrid(petId, pet);
  } finally {
    updatingPets.delete(petId);
  }
}

// ─── Fetch Top Matches ──────────────────────────────────

/**
 * Query cached scores for a pet, joined with product display data.
 * Optional category filter and client-side text search.
 */
export async function fetchTopMatches(
  petId: string,
  filters?: FetchFilters,
): Promise<CachedScore[]> {
  let query = supabase
    .from('pet_product_scores')
    .select('product_id, final_score, is_partial_score, is_supplemental, category, products(name, brand, image_url, product_form)')
    .eq('pet_id', petId)
    .order('final_score', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const rows = (data as Record<string, unknown>[]).map((row) => {
    const product = row.products as { name: string; brand: string; image_url: string | null; product_form: string | null } | null;
    return {
      product_id: row.product_id as string,
      final_score: row.final_score as number,
      is_partial_score: row.is_partial_score as boolean,
      is_supplemental: row.is_supplemental as boolean,
      category: row.category as string,
      product_name: product?.name ?? '',
      brand: product?.brand ?? '',
      image_url: product?.image_url ?? null,
      product_form: product?.product_form ?? null,
    };
  });

  // Client-side text search
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    return rows.filter(
      r => r.product_name.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }

  return rows;
}

// ─── Direct Product Search ──────────────────────────────

export interface ProductSearchResult {
  product_id: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  category: string;
  final_score: number | null;
  is_supplemental: boolean;
}

/**
 * Search products table directly by name/brand.
 * When `pet` is provided: enriches results with cached scores, then JIT-scores
 * any unscored products on-device and background-caches the results.
 */
export async function searchProducts(
  query: string,
  species: 'dog' | 'cat',
  filters?: {
    category?: 'daily_food' | 'treat';
    productForm?: string;
    isSupplemental?: boolean;
    isVetDiet?: boolean;
  },
  pet?: Pet,
): Promise<ProductSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed && !filters?.category) return [];

  const petId = pet?.id;

  // When pet is provided, fetch full scoring columns for JIT scoring
  const selectCols = pet
    ? SCORING_COLUMNS + ', image_url'
    : 'id, name, brand, image_url, product_form, category, is_supplemental';

  let q = supabase
    .from('products')
    .select(selectCols)
    .eq('target_species', species)
    .eq('is_vet_diet', filters?.isVetDiet ?? false)
    .eq('is_recalled', false)
    .eq('is_variety_pack', false)
    .neq('category', 'supplement');

  if (trimmed) {
    const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
    q = q.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`);
  }

  q = q.order('name', { ascending: true }).limit(50);

  if (filters?.category) {
    q = q.eq('category', filters.category);
  }

  if (filters?.productForm) {
    if (filters.productForm === 'freeze_dried') {
      q = q.in('product_form', ['freeze_dried', 'freeze-dried']);
    } else if (filters.productForm === 'other') {
      q = q.not('product_form', 'in', '("dry","wet","freeze_dried","freeze-dried")');
    } else {
      q = q.eq('product_form', filters.productForm);
    }
  }

  if (filters?.isSupplemental !== undefined) {
    q = q.eq('is_supplemental', filters.isSupplemental);
  }

  const { data, error } = await q;

  if (error || !data) return [];

  const rawData = data as unknown as Record<string, unknown>[];

  // Build lookup for JIT scoring (only when pet provided)
  const productDataMap = pet
    ? new Map(rawData.map((row) => [row.id as string, row]))
    : null;

  const results = rawData.map((row) => ({
    product_id: row.id as string,
    product_name: row.name as string,
    brand: row.brand as string,
    image_url: (row.image_url as string) ?? null,
    product_form: (row.product_form as string) ?? null,
    category: row.category as string,
    is_supplemental: (row.is_supplemental as boolean) ?? false,
    final_score: null as number | null,
  }));

  // ── 1. Enrich with cached scores ──
  if (petId && results.length > 0) {
    const productIds = results.map((r) => r.product_id);
    const { data: scores } = await supabase
      .from('pet_product_scores')
      .select('product_id, final_score')
      .eq('pet_id', petId)
      .in('product_id', productIds);

    if (scores) {
      const scoreMap = new Map<string, number>();
      for (const s of scores as { product_id: string; final_score: number }[]) {
        scoreMap.set(s.product_id, s.final_score);
      }
      for (const r of results) {
        r.final_score = scoreMap.get(r.product_id) ?? null;
      }
    }
  }

  // ── 2. JIT scoring for unscored results ──
  if (pet && productDataMap) {
    const missingProducts = results.filter((r) => r.final_score === null);

    if (missingProducts.length > 0) {
      try {
        // 2a. Fetch pet allergens + conditions in parallel
        const [allergenRows, conditionRows] = await Promise.all([
          getPetAllergens(pet.id),
          getPetConditions(pet.id),
        ]);
        const allergens = allergenRows.map((r) => r.allergen);
        const conditions = conditionRows.map((r) => r.condition_tag);

        // 2b. Fetch ingredients — paginated to avoid PostgREST 1,000-row limit
        const missingIds = missingProducts.map((r) => r.product_id);
        const ingRows: Array<Record<string, unknown>> = [];
        let ingFrom = 0;
        const PAGE_SIZE = 1000;
        while (true) {
          const { data: page, error: pageErr } = await supabase
            .from('product_ingredients')
            .select('product_id, position, ingredient_id, ingredients_dict(*)')
            .in('product_id', missingIds)
            .order('position')
            .range(ingFrom, ingFrom + PAGE_SIZE - 1);

          if (pageErr || !page || page.length === 0) break;
          ingRows.push(...(page as unknown as Record<string, unknown>[]));
          if (page.length < PAGE_SIZE) break;
          ingFrom += PAGE_SIZE;
        }

        // 2c. Hydrate + group by product_id
        const ingredientsByProduct = new Map<string, ProductIngredient[]>();
        for (const row of ingRows) {
          const hydrated = hydrateIngredient(
            row as unknown as Parameters<typeof hydrateIngredient>[0],
          );
          if (!hydrated) continue;
          const pid = row.product_id as string;
          const list = ingredientsByProduct.get(pid) ?? [];
          list.push(hydrated);
          ingredientsByProduct.set(pid, list);
        }

        // 2d. Score each missing product
        const jitScores = new Map<string, ScoredResult>();
        for (const r of missingProducts) {
          const rawProduct = productDataMap.get(r.product_id);
          const ingredients = ingredientsByProduct.get(r.product_id);
          if (!rawProduct || !ingredients?.length) continue;

          // D-145: algorithmic variety pack detection
          if (detectVarietyPack(rawProduct.name as string, ingredients)) continue;

          // D-136: runtime supplemental detection
          const scoringProduct =
            !rawProduct.is_supplemental &&
            isSupplementalByName(rawProduct.name as string)
              ? ({ ...rawProduct, is_supplemental: true } as unknown as Product)
              : (rawProduct as unknown as Product);

          const scored = computeScore(
            scoringProduct,
            ingredients,
            pet,
            allergens,
            conditions,
          );
          r.final_score = scored.finalScore;
          jitScores.set(r.product_id, scored);
        }

        // 2e. Background cache upsert (fire-and-forget)
        const cacheRows: Array<Record<string, unknown>> = [];
        const scoredAt = new Date().toISOString();
        for (const r of missingProducts) {
          const scored = jitScores.get(r.product_id);
          if (!scored) continue;
          const rawProduct = productDataMap.get(r.product_id)!;
          cacheRows.push({
            pet_id: pet.id,
            product_id: r.product_id,
            final_score: scored.finalScore,
            is_partial_score: scored.isPartialScore,
            is_supplemental: r.is_supplemental,
            category: rawProduct.category,
            product_form: rawProduct.product_form ?? null,
            life_stage_at_scoring: pet.life_stage ?? null,
            pet_updated_at: pet.updated_at,
            pet_health_reviewed_at: pet.health_reviewed_at ?? null,
            product_updated_at: rawProduct.updated_at,
            scored_at: scoredAt,
            scoring_version: CURRENT_SCORING_VERSION,
          });
        }

        if (cacheRows.length > 0) {
          supabase
            .from('pet_product_scores')
            .upsert(cacheRows, { onConflict: 'pet_id,product_id' })
            .then(({ error: upsertErr }) => {
              if (upsertErr)
                console.warn('[searchProducts] JIT cache upsert failed:', upsertErr);
            });
        }
      } catch (jitErr) {
        // JIT scoring is best-effort — return results with whatever scores we have
        console.warn('[searchProducts] JIT scoring failed:', jitErr);
      }
    }
  }

  return results;
}

