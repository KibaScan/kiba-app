// M6 Safe Swap Service — Curated alternatives for scanned products.
// Queries pet_product_scores for higher-scoring same-form products,
// applies hard filters (no severe, no allergens, no pantry/recent scans),
// and implements daily-seed rotation for freshness.
//
// Spec: M6_SAFE_SWAP_COMPARE_SPEC.md
// Integration: SafeSwapSection component on ResultScreen

import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────

export interface SafeSwapCandidate {
  product_id: string;
  final_score: number;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  price_per_kg: number | null;
  /** True if any of first 3 ingredients have a fish allergen_group */
  is_fish_based: boolean;
}

export interface CuratedPicks {
  topPick: SafeSwapCandidate | null;
  fishBased: SafeSwapCandidate | null;
  greatValue: SafeSwapCandidate | null;
}

export interface SafeSwapResult {
  /** Curated 3-pick (daily dry only), null for other forms */
  curated: CuratedPicks | null;
  /** Generic top alternatives (all non-daily-dry forms) */
  generic: SafeSwapCandidate[];
  /** Full pool before rotation selection (for client-side refresh) */
  pool: SafeSwapCandidate[];
  /** Whether this is a curated (3-pick) or generic (scroll) layout */
  mode: 'curated' | 'generic';
}

export type GroupMode = 'single' | 'group';

interface SwapQueryParams {
  petId: string;
  species: 'dog' | 'cat';
  scannedProductId: string;
  scannedCategory: string;
  scannedForm: string | null;
  scannedIsSupplemental: boolean;
  scannedScore: number;
  allergenGroups: string[];
  userId: string;
}

// ─── Daily Seed Rotation ────────────────────────────────

/**
 * Deterministic daily seed from petId + date.
 * Same pet + same date = same picks all day.
 */
function dailySeed(petId: string, date: string): number {
  let hash = 0;
  const input = petId + date;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Fisher-Yates shuffle with LCG seed, return first `count` items.
 * Deterministic: same seed = same order.
 */
function selectFromPool<T>(pool: T[], count: number, seed: number): T[] {
  if (pool.length <= count) return [...pool];
  const shuffled = [...pool];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    const j = Math.abs(s) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Pool Query ─────────────────────────────────────────

/**
 * Fetch the candidate pool from pet_product_scores + products,
 * applying all hard filters. Returns up to `limit` candidates
 * sorted by score DESC.
 */
async function fetchCandidatePool(
  params: SwapQueryParams,
  scoreThreshold: number,
  limit: number,
): Promise<SafeSwapCandidate[]> {
  // Step 1: Get scored products for this pet matching category/form
  // We join products for display data and filtering
  let query = supabase
    .from('pet_product_scores')
    .select(`
      product_id,
      final_score,
      products!inner(
        name, brand, image_url, product_form,
        price, product_size_kg,
        is_vet_diet, is_recalled, is_supplemental,
        target_species
      )
    `)
    .eq('pet_id', params.petId)
    .eq('category', params.scannedCategory)
    .gte('final_score', scoreThreshold)
    .neq('product_id', params.scannedProductId)
    .order('final_score', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error || !data) {
    console.warn('[safeSwapService] Pool query failed:', error?.message);
    return [];
  }

  // Step 2: Client-side filtering (complex joins that Supabase REST can't do)
  const candidates: SafeSwapCandidate[] = [];

  for (const row of data as any[]) {
    const p = row.products;
    if (!p) continue;

    // Hard filter: form match
    if (params.scannedForm && p.product_form !== params.scannedForm) continue;

    // Hard filter: supplemental ↔ supplemental only
    if (p.is_supplemental !== params.scannedIsSupplemental) continue;

    // Hard filter: no vet diets, no recalled
    if (p.is_vet_diet || p.is_recalled) continue;

    // Hard filter: same species
    if (p.target_species !== params.species) continue;

    // Must score higher than what was scanned (for generic mode)
    // For curated mode the threshold handles this
    const finalScore = row.final_score as number;

    const pricePerKg =
      p.price != null && p.product_size_kg != null && p.product_size_kg > 0
        ? p.price / p.product_size_kg
        : null;

    candidates.push({
      product_id: row.product_id,
      final_score: finalScore,
      product_name: p.name ?? '',
      brand: p.brand ?? '',
      image_url: p.image_url ?? null,
      product_form: p.product_form ?? null,
      price_per_kg: pricePerKg,
      is_fish_based: false, // Set in a second pass below
    });
  }

  return candidates;
}

/**
 * Apply allergen and pantry/scan exclusion filters.
 * These require separate queries, so done as a post-filter step.
 */
async function applyExclusionFilters(
  candidates: SafeSwapCandidate[],
  params: SwapQueryParams,
): Promise<SafeSwapCandidate[]> {
  if (candidates.length === 0) return [];

  const productIds = candidates.map(c => c.product_id);

  // Fetch excluded product IDs in parallel
  const [allergenExclusions, pantryExclusions, recentScanExclusions] = await Promise.all([
    // Allergen filter: exclude products containing pet's allergens
    params.allergenGroups.length > 0
      ? fetchAllergenExclusions(productIds, params.allergenGroups)
      : new Set<string>(),

    // Pantry exclusion: products already in user's pantry
    fetchPantryExclusions(params.userId),

    // Recent scan exclusion: products scanned in last 30 days
    fetchRecentScanExclusions(params.userId),
  ]);

  return candidates.filter(c =>
    !allergenExclusions.has(c.product_id) &&
    !pantryExclusions.has(c.product_id) &&
    !recentScanExclusions.has(c.product_id)
  );
}

async function fetchAllergenExclusions(
  productIds: string[],
  allergenGroups: string[],
): Promise<Set<string>> {
  const excluded = new Set<string>();

  // Query in batches of 100 product IDs
  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100);
    const { data } = await supabase
      .from('product_ingredients')
      .select('product_id, ingredients_dict!inner(allergen_group)')
      .in('product_id', batch)
      .in('ingredients_dict.allergen_group', allergenGroups);

    if (data) {
      for (const row of data as any[]) {
        excluded.add(row.product_id);
      }
    }
  }

  return excluded;
}

/**
 * Also fetches severity='danger' exclusions (no severe ingredients).
 */
async function fetchSevereExclusions(
  productIds: string[],
  species: 'dog' | 'cat',
): Promise<Set<string>> {
  const excluded = new Set<string>();
  const severityCol = species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';

  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100);
    const { data } = await supabase
      .from('product_ingredients')
      .select(`product_id, ingredients_dict!inner(${severityCol})`)
      .in('product_id', batch)
      .eq(`ingredients_dict.${severityCol}`, 'danger');

    if (data) {
      for (const row of data as any[]) {
        excluded.add(row.product_id);
      }
    }
  }

  return excluded;
}

async function fetchPantryExclusions(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('pantry_items')
    .select('product_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  return new Set((data ?? []).map((r: any) => r.product_id));
}

async function fetchRecentScanExclusions(userId: string): Promise<Set<string>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('scan_history')
    .select('product_id')
    .eq('user_id', userId)
    .gte('scanned_at', thirtyDaysAgo);

  return new Set((data ?? []).map((r: any) => r.product_id));
}

/**
 * Tag fish-based candidates by checking if any of first 3 ingredients
 * have a fish-family allergen_group.
 */
async function tagFishBased(
  candidates: SafeSwapCandidate[],
): Promise<void> {
  if (candidates.length === 0) return;

  const productIds = candidates.map(c => c.product_id);

  // Fetch top-3 ingredients with allergen_group for these products
  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100);
    const { data } = await supabase
      .from('product_ingredients')
      .select('product_id, position, ingredients_dict!inner(allergen_group)')
      .in('product_id', batch)
      .lte('position', 3)
      .not('ingredients_dict.allergen_group', 'is', null);

    if (data) {
      const fishByProduct = new Map<string, boolean>();
      for (const row of data as any[]) {
        const ag = row.ingredients_dict?.allergen_group;
        if (ag && /fish|salmon|tuna|whitefish|trout|herring|anchov|sardine|pollock|cod|haddock|mackerel|catfish|tilapia/i.test(ag)) {
          fishByProduct.set(row.product_id, true);
        }
      }
      for (const c of candidates) {
        if (fishByProduct.has(c.product_id)) {
          c.is_fish_based = true;
        }
      }
    }
  }
}

// ─── Multi-Pet Group Mode ───────────────────────────────

/**
 * For "All Dogs" / "All Cats" mode: find products scoring >= threshold
 * for ALL pets, using the floor score. Allergen groups are the union
 * of all pets' allergens.
 */
export async function fetchGroupSwaps(
  petIds: string[],
  params: Omit<SwapQueryParams, 'petId' | 'allergenGroups'>,
  allAllergenGroups: string[],
  scoreThreshold: number,
): Promise<SafeSwapCandidate[]> {
  // Fetch pools per pet, then intersect
  const poolsPerPet = await Promise.all(
    petIds.map(petId =>
      fetchCandidatePool({ ...params, petId, allergenGroups: allAllergenGroups }, scoreThreshold, 200)
    )
  );

  if (poolsPerPet.length === 0) return [];

  // Intersect: only products present in ALL pet pools
  const productScores = new Map<string, { minScore: number; candidate: SafeSwapCandidate }>();

  // Start with first pet's pool
  for (const c of poolsPerPet[0]) {
    productScores.set(c.product_id, { minScore: c.final_score, candidate: c });
  }

  // Intersect with remaining pets
  for (let i = 1; i < poolsPerPet.length; i++) {
    const petPool = new Map(poolsPerPet[i].map(c => [c.product_id, c]));
    for (const [pid, entry] of productScores) {
      const match = petPool.get(pid);
      if (!match) {
        productScores.delete(pid);
      } else {
        // Floor score: use the lowest across all pets
        entry.minScore = Math.min(entry.minScore, match.final_score);
      }
    }
  }

  // Convert back to candidates with floor scores
  const results: SafeSwapCandidate[] = [];
  for (const [, entry] of productScores) {
    results.push({ ...entry.candidate, final_score: entry.minScore });
  }

  // Sort by floor score DESC
  results.sort((a, b) => b.final_score - a.final_score);

  // Apply exclusion filters using union allergens
  return applyExclusionFilters(
    results,
    { ...params, petId: petIds[0], allergenGroups: allAllergenGroups },
  );
}

// ─── Main Query ─────────────────────────────────────────

/**
 * Fetch safe swap alternatives for a scanned product.
 *
 * Daily dry food: curated 3-pick (Top Pick / Fish-Based / Great Value)
 * All other forms: generic top-5 sorted by score
 *
 * Results rotate daily via deterministic seed.
 */
export async function fetchSafeSwaps(
  params: SwapQueryParams,
  refreshCount: number = 0,
): Promise<SafeSwapResult> {
  const isCurated = params.scannedCategory === 'daily_food'
    && params.scannedForm === 'dry'
    && !params.scannedIsSupplemental;

  const scoreThreshold = isCurated ? 80 : 65;
  const poolSize = isCurated ? 50 : 30;

  // 1. Fetch candidate pool
  let pool = await fetchCandidatePool(params, scoreThreshold, poolSize);

  // 2. Apply hard filters (allergens, severity, pantry, recent scans)
  const severeExclusions = await fetchSevereExclusions(
    pool.map(c => c.product_id),
    params.species,
  );
  pool = pool.filter(c => !severeExclusions.has(c.product_id));
  pool = await applyExclusionFilters(pool, params);

  // 3. For generic: also require score > scanned score
  if (!isCurated) {
    pool = pool.filter(c => c.final_score > params.scannedScore);
  }

  // 4. Tag fish-based
  await tagFishBased(pool);

  // 5. Rotation seed
  const seed = dailySeed(params.petId, todayString()) + refreshCount;

  if (isCurated) {
    return buildCuratedResult(pool, seed);
  } else {
    return buildGenericResult(pool, seed);
  }
}

function buildCuratedResult(pool: SafeSwapCandidate[], seed: number): SafeSwapResult {
  // Split into sub-pools
  const nonFishPool = pool.filter(c => !c.is_fish_based);
  const fishPool = pool.filter(c => c.is_fish_based);
  const valuePool = pool
    .filter(c => c.price_per_kg != null)
    .sort((a, b) => (a.price_per_kg ?? Infinity) - (b.price_per_kg ?? Infinity));

  // Select one from each sub-pool using rotation
  const topPicks = selectFromPool(nonFishPool, 5, seed);
  const fishPicks = selectFromPool(fishPool, 5, seed + 1);
  const valuePicks = selectFromPool(valuePool.slice(0, 10), 3, seed + 2);

  const curated: CuratedPicks = {
    topPick: topPicks[0] ?? null,
    fishBased: fishPicks[0] ?? null,
    greatValue: valuePicks[0] ?? null,
  };

  // Fallback: if fewer than 2 curated slots filled, fall back to generic
  const filledSlots = [curated.topPick, curated.fishBased, curated.greatValue].filter(Boolean).length;
  if (filledSlots < 1) {
    // Lower threshold to 65 and try generic
    return {
      curated: null,
      generic: selectFromPool(pool, 5, seed),
      pool,
      mode: 'generic',
    };
  }

  return {
    curated,
    generic: [],
    pool,
    mode: 'curated',
  };
}

function buildGenericResult(pool: SafeSwapCandidate[], seed: number): SafeSwapResult {
  const selected = selectFromPool(pool, 5, seed);

  return {
    curated: null,
    generic: selected,
    pool,
    mode: 'generic',
  };
}

// ─── Header Copy ────────────────────────────────────────

export function getSwapHeaderCopy(
  scannedScore: number,
  petName: string,
): { title: string; subtitle: string } {
  if (scannedScore <= 64) {
    return {
      title: `Higher-scoring alternatives for ${petName}`,
      subtitle: scannedScore <= 50
        ? `Products in the same category that score higher for ${petName}'s profile.`
        : `A few options that may be a better match for ${petName}.`,
    };
  }
  if (scannedScore <= 79) {
    return {
      title: `Similar options for ${petName}`,
      subtitle: `A few options that may be a better match for ${petName}.`,
    };
  }
  return {
    title: `Other top picks for ${petName}`,
    subtitle: `${petName} already has a solid match. Here are some other high-scoring options.`,
  };
}

// ─── Client-Side Refresh ────────────────────────────────

/**
 * Re-select from the existing pool without re-querying the DB.
 * Uses refreshCount to shift the seed.
 */
export function refreshFromPool(
  pool: SafeSwapCandidate[],
  petId: string,
  refreshCount: number,
  isCurated: boolean,
): SafeSwapResult {
  const seed = dailySeed(petId, todayString()) + refreshCount;

  if (isCurated) {
    return buildCuratedResult(pool, seed);
  }
  return buildGenericResult(pool, seed);
}
