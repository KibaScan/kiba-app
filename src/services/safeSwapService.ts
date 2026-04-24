// Kiba — Safe Swap Service (M6)
// Recommends higher-scoring alternatives for a scanned product.
// Pure functions exported for testability.
//
// Condition hard filters are deliberately MORE LENIENT than scoring penalty
// thresholds — the scoring engine handles graduated penalties, hard filters
// only catch clearly inappropriate products.
//
// D-094: suitability framing. D-095: UPVM compliance. D-020: brand-blind.

import { supabase } from './supabase';
import { getPetAllergens, getPetConditions } from './petService';
import { isSupplementalByName } from '../utils/supplementalClassifier';

// ─── Types ──────────────────────────────────────────────

export interface SwapCandidate {
  product_id: string;
  final_score: number;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  category: string;
  is_supplemental: boolean;
  reason: string | null;
  price_per_kg: number | null;
  is_fish_based: boolean;
  slot_label: string | null; // 'Top Pick' | 'Fish-Based' | 'Another Pick' | 'Great Value' | null
}

/** Wrapper returned by fetchSafeSwaps. */
export interface SafeSwapResult {
  candidates: SwapCandidate[];
  mode: 'curated' | 'generic';
  cacheEmpty?: boolean;
}

/** Intermediate row with GA fields needed for condition hard filters. */
export interface CandidateRow {
  product_id: string;
  final_score: number;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  category: string;
  is_supplemental: boolean;
  ga_fat_pct: number | null;
  ga_protein_pct: number | null;
  ga_fiber_pct: number | null;
  ga_phosphorus_pct: number | null;
  ga_moisture_pct: number | null;
  ga_kcal_per_kg: number | null;
  name: string;
  price: number | null;
  product_size_kg: number | null;
  life_stage_claim: string | null;
}

// ─── DMB Helpers ────────────────────────────────────────
// Mirrors conditionScoring.ts patterns — kept local to avoid coupling.

export function toDMB(asFed: number, moisture: number): number {
  return (asFed / (100 - moisture)) * 100;
}

export function inferMoisture(productForm: string | null, gaMoisture: number | null): number {
  if (gaMoisture !== null) return gaMoisture;
  switch (productForm) {
    case 'wet': return 78;
    case 'raw': return 70;
    case 'freeze_dried': return 7;
    case 'dehydrated': return 8;
    case 'dry': return 10;
    default: return 10;
  }
}

interface CandidateDmb {
  fatDmb: number | null;
  phosphorusDmb: number | null;
  carbDmb: number | null;
  kcalPerKgDmb: number | null;
  isDry: boolean;
  isWet: boolean;
}

function buildCandidateDmb(c: CandidateRow): CandidateDmb {
  const moisture = inferMoisture(c.product_form, c.ga_moisture_pct);
  const fatDmb = c.ga_fat_pct !== null ? toDMB(c.ga_fat_pct, moisture) : null;
  const proteinDmb = c.ga_protein_pct !== null ? toDMB(c.ga_protein_pct, moisture) : null;
  const fiberDmb = c.ga_fiber_pct !== null ? toDMB(c.ga_fiber_pct, moisture) : null;
  const phosphorusDmb = c.ga_phosphorus_pct !== null ? toDMB(c.ga_phosphorus_pct, moisture) : null;
  const kcalPerKgDmb = c.ga_kcal_per_kg !== null ? c.ga_kcal_per_kg / (1 - moisture / 100) : null;
  const isDry = c.product_form === 'dry' || moisture <= 12;
  const isWet = c.product_form === 'wet' || moisture > 50;

  // D-149 carb estimation: 100 - protein - fat - fiber - ash(7%)
  let carbDmb: number | null = null;
  if (proteinDmb !== null && fatDmb !== null && fiberDmb !== null) {
    carbDmb = Math.max(0, 100 - proteinDmb - fatDmb - fiberDmb - 7);
  }

  return { fatDmb, phosphorusDmb, carbDmb, kcalPerKgDmb, isDry, isWet };
}

// ─── Condition Hard Filters ─────────────────────────────
// Each filter returns true if the candidate should be EXCLUDED.
// If GA data is null, we cannot confirm a violation → keep the candidate.

type HardFilter = (c: CandidateRow, dmb: CandidateDmb) => boolean;

function pancreatitisFilter(species: 'dog' | 'cat'): HardFilter | null {
  // Dog pancreatitis: fat is THE trigger. Cat pancreatitis is IBD-linked, not fat-triggered.
  if (species !== 'dog') return null;
  return (_c, dmb) => dmb.fatDmb !== null && dmb.fatDmb > 15;
}

function ckdFilter(species: 'dog' | 'cat'): HardFilter {
  const threshold = species === 'cat' ? 1.2 : 1.5;
  return (_c, dmb) => dmb.phosphorusDmb !== null && dmb.phosphorusDmb > threshold;
}

function diabetesFilter(species: 'dog' | 'cat'): HardFilter | null {
  // Cat diabetes: carb-driven. Dog diabetes: fiber-based management, no carb hard filter.
  if (species !== 'cat') return null;
  return (_c, dmb) => dmb.carbDmb !== null && dmb.carbDmb > 25;
}

function obesityFilter(): HardFilter {
  return (_c, dmb) => {
    if (dmb.kcalPerKgDmb === null) return false;
    return dmb.isDry ? dmb.kcalPerKgDmb > 4500 : dmb.kcalPerKgDmb > 1400;
  };
}

function underweightFilter(): HardFilter {
  return (c, _dmb) => {
    const lower = c.name.toLowerCase();
    return lower.includes('lite') || lower.includes('light')
      || lower.includes('healthy weight') || lower.includes('weight management');
  };
}

// Cardiac dog: exclude products where DCM pulse rules would fire.
// Requires ingredient data — applied via fetchCardiacDcmExclusions().
export interface PulseIngredient {
  position: number;
  is_pulse: boolean;
  is_pulse_protein: boolean;
}

export function dcmPulsePatternFires(ingredients: PulseIngredient[]): boolean {
  const pulses = ingredients.filter(i => i.is_pulse);
  const heavyweight = pulses.some(p => p.position <= 3);
  const density = pulses.filter(p => p.position <= 10).length >= 2;
  const substitution = pulses.some(p => p.position <= 10 && p.is_pulse_protein);
  return heavyweight || density || substitution;
}

/**
 * Apply condition-aware hard filters to candidate pool.
 * Candidates that clearly violate a condition's dietary constraints are excluded.
 * If GA data is null for a given check, the candidate is kept (can't confirm violation).
 */
export function applyConditionHardFilters(
  candidates: CandidateRow[],
  conditionTags: string[],
  species: 'dog' | 'cat',
): CandidateRow[] {
  if (conditionTags.length === 0) return candidates;

  // Build filter list from active conditions
  const filters: HardFilter[] = [];

  for (const tag of conditionTags) {
    switch (tag) {
      case 'pancreatitis': {
        const f = pancreatitisFilter(species);
        if (f) filters.push(f);
        break;
      }
      case 'ckd':
        filters.push(ckdFilter(species));
        break;
      case 'diabetes': {
        const f = diabetesFilter(species);
        if (f) filters.push(f);
        break;
      }
      case 'obesity':
        filters.push(obesityFilter());
        break;
      case 'underweight':
        filters.push(underweightFilter());
        break;
      // cardiac dog DCM filtering requires ingredient data — handled in Phase 2
      // gi_sensitive, urinary, joint, skin, hypothyroid, hyperthyroid: no hard filters,
      // scoring engine handles these with graduated penalties
    }
  }

  if (filters.length === 0) return candidates;

  return candidates.filter(c => {
    const dmb = buildCandidateDmb(c);
    // Candidate must pass ALL filters (not excluded by any)
    return !filters.some(f => f(c, dmb));
  });
}

// ─── Life Stage Hard Filter ─────────────────────────────
// Exclude products whose life_stage_claim doesn't match the pet's life stage.
// "All Life Stages" and null claims always pass.

const GROWTH_CLAIMS = ['puppy', 'kitten', 'growth'];
const ADULT_SENIOR_CLAIMS = ['adult', 'maintenance', 'senior'];

function applyLifeStageFilter(
  candidates: CandidateRow[],
  petLifeStage: string | null,
): CandidateRow[] {
  if (!petLifeStage) return candidates;

  const isGrowthPet = petLifeStage === 'puppy' || petLifeStage === 'kitten';
  const isAdultPlusPet = ['junior', 'adult', 'mature', 'senior', 'geriatric'].includes(petLifeStage);

  return candidates.filter(c => {
    if (!c.life_stage_claim) return true;
    const claim = c.life_stage_claim.toLowerCase();

    if (claim.includes('all life stages')) return true;

    const isGrowthClaim = GROWTH_CLAIMS.some(k => claim.includes(k));
    const isAdultSeniorClaim = ADULT_SENIOR_CLAIMS.some(k => claim.includes(k));

    // Growth pet should not see adult/senior-only food
    if (isGrowthPet && isAdultSeniorClaim && !isGrowthClaim) return false;
    // Adult+ pet should not see growth-only food
    if (isAdultPlusPet && isGrowthClaim && !isAdultSeniorClaim) return false;

    return true;
  });
}

// ─── Swap Reason Generation ─────────────────────────────
// One reason per candidate. D-095 compliant — no "treat", "cure", "prevent", etc.
// Priority: condition-relevant > allergen-free > generic.

const CONDITION_REASONS: Record<string, { dog?: string; cat?: string; both?: string }> = {
  pancreatitis: { dog: 'Lower fat content' },
  ckd: { both: 'Lower phosphorus content' },
  diabetes: { cat: 'Lower carbohydrate content' },
  obesity: { both: 'Lower calorie density' },
  underweight: { both: 'Higher calorie density' },
  cardiac: { dog: 'Supports cardiac health', cat: 'Supports cardiac health' },
  gi_sensitive: { both: 'Gentler on digestion' },
  urinary: { both: 'Supports urinary health' },
  joint: { both: 'Supports joint health' },
  skin: { both: 'Supports skin and coat health' },
};

// Safety-critical conditions checked first
const CONDITION_PRIORITY: string[] = [
  'pancreatitis', 'ckd', 'diabetes', 'cardiac', 'obesity', 'underweight',
  'gi_sensitive', 'urinary', 'joint', 'skin',
];

export function generateSwapReason(
  _candidate: CandidateRow,
  conditionTags: string[],
  allergenGroups: string[],
  species: 'dog' | 'cat',
): string | null {
  // Check conditions in priority order
  for (const tag of CONDITION_PRIORITY) {
    if (!conditionTags.includes(tag)) continue;
    const reasons = CONDITION_REASONS[tag];
    if (!reasons) continue;
    const reason = (species === 'dog' ? reasons.dog : reasons.cat) ?? reasons.both;
    if (reason) return reason;
  }

  // Allergen-free note
  if (allergenGroups.length > 0) {
    const first = allergenGroups[0];
    return `Free from ${first} ingredients`;
  }

  // No honest generic reason — partial-data products can make "higher overall
  // match" factually wrong. Caller hides the reason line when null.
  return null;
}

// ─── Fish-Based Tagging ────────────────────────────────
// Uses allergen_group = 'fish' from ingredients_dict (not regex on product name).

async function tagFishBased(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();

  const data = await chunkedProductQuery<Record<string, unknown>>(
    'product_id, ingredients_dict(allergen_group)',
    candidateIds,
    (q) => q.lte('position', 3),
  );

  if (data.length === 0) return new Set();

  const fishIds = new Set<string>();
  for (const row of data as Record<string, unknown>[]) {
    const dict = row.ingredients_dict as { allergen_group: string | null } | null;
    if (dict?.allergen_group === 'fish') {
      fishIds.add(row.product_id as string);
    }
  }
  return fishIds;
}

// ─── Curated Slot Assignment ───────────────────────────
// Pure function: assigns Top Pick / Fish-Based (or Another Pick) / Great Value.
// Returns null if fewer than 2 slots can be filled → caller falls back to generic.

function candidateToPricePerKg(c: CandidateRow): number | null {
  if (c.price != null && c.product_size_kg != null && c.product_size_kg > 0) {
    return c.price / c.product_size_kg;
  }
  return null;
}

function candidateToSwap(
  c: CandidateRow,
  slotLabel: string | null,
  fishIds: Set<string>,
  conditionTags: string[],
  allergenGroups: string[],
  species: 'dog' | 'cat',
): SwapCandidate {
  return {
    product_id: c.product_id,
    final_score: c.final_score,
    product_name: c.product_name,
    brand: c.brand,
    image_url: c.image_url,
    product_form: c.product_form,
    category: c.category,
    is_supplemental: c.is_supplemental,
    reason: generateSwapReason(c, conditionTags, allergenGroups, species),
    price_per_kg: candidateToPricePerKg(c),
    is_fish_based: fishIds.has(c.product_id),
    slot_label: slotLabel,
  };
}

export function assignCuratedSlots(
  candidates: CandidateRow[],
  fishProductIds: Set<string>,
  petHasFishAllergy: boolean,
  conditionTags: string[],
  allergenGroups: string[],
  species: 'dog' | 'cat',
): SwapCandidate[] | null {
  if (candidates.length === 0) return null;

  const selected = new Set<string>(); // track selected product_ids
  const slots: SwapCandidate[] = [];

  // Slot 1: Top Pick — highest score
  const topPick = candidates[0]; // already sorted by score DESC
  if (topPick) {
    slots.push(candidateToSwap(topPick, 'Top Pick', fishProductIds, conditionTags, allergenGroups, species));
    selected.add(topPick.product_id);
  }

  // Slot 2: Fish-Based or Another Pick
  if (!petHasFishAllergy) {
    // Fish-Based: highest score among fish candidates not already selected
    const fishCandidate = candidates.find(c => fishProductIds.has(c.product_id) && !selected.has(c.product_id));
    if (fishCandidate) {
      slots.push(candidateToSwap(fishCandidate, 'Fish-Based', fishProductIds, conditionTags, allergenGroups, species));
      selected.add(fishCandidate.product_id);
    }
  } else {
    // Another Pick: second-highest score
    const anotherPick = candidates.find(c => !selected.has(c.product_id));
    if (anotherPick) {
      slots.push(candidateToSwap(anotherPick, 'Another Pick', fishProductIds, conditionTags, allergenGroups, species));
      selected.add(anotherPick.product_id);
    }
  }

  // Slot 3: Great Value — lowest price_per_kg among remaining
  const valueCandidate = candidates
    .filter(c => !selected.has(c.product_id) && c.price != null && c.product_size_kg != null && c.product_size_kg > 0)
    .sort((a, b) => (a.price! / a.product_size_kg!) - (b.price! / b.product_size_kg!))
    [0];

  if (valueCandidate) {
    slots.push(candidateToSwap(valueCandidate, 'Great Value', fishProductIds, conditionTags, allergenGroups, species));
    selected.add(valueCandidate.product_id);
  } else {
    // Fallback: no price data available — pick next highest scoring product
    const fallback = candidates.find(c => !selected.has(c.product_id));
    if (fallback) {
      slots.push(candidateToSwap(fallback, 'Another Pick', fishProductIds, conditionTags, allergenGroups, species));
      selected.add(fallback.product_id);
    }
  }

  // Need at least 2 slots for curated mode
  if (slots.length < 2) return null;

  return slots;
}

// ─── Fetch Parameters ───────────────────────────────────

interface FetchSafeSwapsParams {
  petId: string;
  species: 'dog' | 'cat';
  category: string;
  productForm: string | null;
  isSupplemental: boolean;
  scannedProductId: string;
  scannedScore: number;
  allergenGroups: string[];
  conditionTags: string[];
  petLifeStage: string | null;
}

const MIN_SCORE_THRESHOLD = 65;
const CANDIDATE_POOL_SIZE = 300;
const MIN_RESULTS = 3;
const EXCLUSION_CHUNK_SIZE = 100; // Avoid 414 URI Too Long with large .in() arrays

// ─── Exclusion Queries (run in parallel) ────────────────

/** Chunked .in() query — splits large ID arrays to avoid 414 URI Too Long. */
async function chunkedProductQuery<T>(
  selectCols: string,
  ids: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraFilters?: (q: any) => any,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += EXCLUSION_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + EXCLUSION_CHUNK_SIZE);
    let q = supabase
      .from('product_ingredients')
      .select(selectCols)
      .in('product_id', chunk);
    if (extraFilters) q = extraFilters(q);
    const { data } = await q;
    if (data) results.push(...(data as T[]));
  }
  return results;
}

/** Products whose ingredients match any of the pet's allergen groups. */
async function fetchAllergenExclusions(
  candidateIds: string[],
  allergenGroups: string[],
): Promise<Set<string>> {
  if (allergenGroups.length === 0 || candidateIds.length === 0) return new Set();

  // Query product_ingredients joined with ingredients_dict for allergen_group (chunked)
  const data = await chunkedProductQuery<Record<string, unknown>>(
    'product_id, ingredients_dict(allergen_group, allergen_group_possible)',
    candidateIds,
  );

  if (data.length === 0) return new Set();

  const allergenSet = new Set(allergenGroups);
  const excluded = new Set<string>();

  for (const row of data as Record<string, unknown>[]) {
    const dict = row.ingredients_dict as {
      allergen_group: string | null;
      allergen_group_possible: string[] | null;
    } | null;
    if (!dict) continue;

    // Direct match
    if (dict.allergen_group && allergenSet.has(dict.allergen_group)) {
      excluded.add(row.product_id as string);
      continue;
    }

    // Possible match (cross-reactivity)
    if (dict.allergen_group_possible) {
      for (const possible of dict.allergen_group_possible) {
        if (allergenSet.has(possible)) {
          excluded.add(row.product_id as string);
          break;
        }
      }
    }
  }

  return excluded;
}

/** Products with any danger-severity ingredient for this species. */
async function fetchSeverityExclusions(
  candidateIds: string[],
  species: 'dog' | 'cat',
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();

  const severityCol = species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';

  const data = await chunkedProductQuery<Record<string, unknown>>(
    `product_id, ingredients_dict(${severityCol})`,
    candidateIds,
  );

  if (data.length === 0) return new Set();

  const excluded = new Set<string>();
  for (const row of data as Record<string, unknown>[]) {
    const dict = row.ingredients_dict as Record<string, string | null> | null;
    if (dict && dict[severityCol] === 'danger') {
      excluded.add(row.product_id as string);
    }
  }

  return excluded;
}

/** Product IDs currently in the pet's active pantry. */
async function fetchPantryExclusions(petId: string): Promise<Set<string>> {
  // Get pantry item IDs assigned to this pet
  const { data: assignments, error: assignErr } = await supabase
    .from('pantry_pet_assignments')
    .select('pantry_item_id')
    .eq('pet_id', petId);

  if (assignErr || !assignments || assignments.length === 0) return new Set();

  const itemIds = (assignments as { pantry_item_id: string }[]).map(a => a.pantry_item_id);

  // Get product_ids for active pantry items
  const { data: items, error: itemErr } = await supabase
    .from('pantry_items')
    .select('product_id')
    .in('id', itemIds)
    .eq('is_active', true);

  if (itemErr || !items) return new Set();
  return new Set((items as { product_id: string }[]).map(i => i.product_id));
}

/** Product IDs scanned for this pet in the last 30 days. */
async function fetchRecentScanExclusions(petId: string): Promise<Set<string>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('scan_history')
    .select('product_id')
    .eq('pet_id', petId)
    .gte('scanned_at', thirtyDaysAgo);

  if (error || !data) return new Set();
  return new Set((data as { product_id: string }[]).map(d => d.product_id));
}

/** Product IDs where DCM pulse rules fire (cardiac dog exclusion). */
async function fetchCardiacDcmExclusions(
  candidateIds: string[],
  conditionTags: string[],
  species: 'dog' | 'cat',
): Promise<Set<string>> {
  // Only applies to dogs with cardiac condition
  if (species !== 'dog' || !conditionTags.includes('cardiac')) return new Set();
  if (candidateIds.length === 0) return new Set();

  const data = await chunkedProductQuery<Record<string, unknown>>(
    'product_id, position, ingredients_dict(is_pulse, is_pulse_protein)',
    candidateIds,
    (q) => q.lte('position', 10),
  );

  if (data.length === 0) return new Set();

  // Group ingredients by product
  const byProduct = new Map<string, PulseIngredient[]>();
  for (const row of data as Record<string, unknown>[]) {
    const pid = row.product_id as string;
    const dict = row.ingredients_dict as { is_pulse: boolean; is_pulse_protein: boolean } | null;
    if (!dict) continue;
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid)!.push({
      position: row.position as number,
      is_pulse: dict.is_pulse ?? false,
      is_pulse_protein: dict.is_pulse_protein ?? false,
    });
  }

  const excluded = new Set<string>();
  byProduct.forEach((ingredients, pid) => {
    if (dcmPulsePatternFires(ingredients)) excluded.add(pid);
  });
  return excluded;
}

// ─── Cache Existence Check ────────────────────────────
// Lightweight check: does pet_product_scores have ANY rows for this pet?
// Used to distinguish "empty cache" from "all candidates filtered out."

async function isCachePopulated(petId: string): Promise<boolean> {
  const { count } = await supabase
    .from('pet_product_scores')
    .select('product_id', { count: 'exact', head: true })
    .eq('pet_id', petId);
  return (count ?? 0) > 0;
}

// ─── Base Pool Query ───────────────────────────────────
// Shared by single-pet and group-mode fetchers.

async function fetchBasePool(
  petId: string,
  category: string,
  productForm: string | null,
  isSupplemental: boolean,
  species: 'dog' | 'cat',
  scannedProductId: string,
  minScore: number,
): Promise<CandidateRow[]> {
  const query = supabase
    .from('pet_product_scores')
    .select(`
      product_id, final_score, is_supplemental, category,
      products(
        name, brand, image_url, product_form, is_vet_diet, is_recalled,
        target_species, is_supplemental,
        ga_fat_pct, ga_protein_pct, ga_fiber_pct, ga_phosphorus_pct,
        ga_moisture_pct, ga_kcal_per_kg,
        price, product_size_kg, life_stage_claim
      )
    `)
    .eq('pet_id', petId)
    .eq('category', category)
    .eq('is_supplemental', isSupplemental)
    .gt('final_score', minScore)
    .neq('product_id', scannedProductId)
    .order('final_score', { ascending: false })
    .limit(CANDIDATE_POOL_SIZE);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return [];

  const candidates: CandidateRow[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const product = row.products as Record<string, unknown> | null;
    if (!product) continue;

    if (product.is_vet_diet) continue;
    if (product.is_recalled) continue;
    if (product.target_species !== species) continue;
    // D-096: supplement category products are not scored (M16+)
    if ((row.category as string) === 'supplement') continue;
    // Use cached is_supplemental (includes D-146 runtime detection), not raw DB value
    if ((row.is_supplemental as boolean) !== isSupplemental) continue;
    if (productForm && product.product_form !== productForm) continue;
    // D-146 safety net: catch future data gaps where DB flag is wrong but name reveals supplemental
    if (!isSupplemental && isSupplementalByName((product.name as string) ?? null)) continue;

    candidates.push({
      product_id: row.product_id as string,
      final_score: row.final_score as number,
      product_name: (product.name as string) ?? '',
      brand: (product.brand as string) ?? '',
      image_url: (product.image_url as string) ?? null,
      product_form: (product.product_form as string) ?? null,
      category: row.category as string,
      is_supplemental: (row.is_supplemental as boolean) ?? false,
      ga_fat_pct: (product.ga_fat_pct as number) ?? null,
      ga_protein_pct: (product.ga_protein_pct as number) ?? null,
      ga_fiber_pct: (product.ga_fiber_pct as number) ?? null,
      ga_phosphorus_pct: (product.ga_phosphorus_pct as number) ?? null,
      ga_moisture_pct: (product.ga_moisture_pct as number) ?? null,
      ga_kcal_per_kg: (product.ga_kcal_per_kg as number) ?? null,
      name: (product.name as string) ?? '',
      price: (product.price as number) ?? null,
      product_size_kg: (product.product_size_kg as number) ?? null,
      life_stage_claim: (product.life_stage_claim as string) ?? null,
    });
  }

  return candidates;
}

// ─── Pool Intersection (Group Mode) ────────────────────
// Intersects candidate pools across multiple pets.
// Uses floor score (lowest across all pets) for ranking.

export function intersectCandidatePools(pools: CandidateRow[][]): CandidateRow[] {
  if (pools.length === 0) return [];
  if (pools.length === 1) return pools[0];

  // Build map from first pool
  const map = new Map<string, { candidate: CandidateRow; floorScore: number }>();
  for (const c of pools[0]) {
    map.set(c.product_id, { candidate: c, floorScore: c.final_score });
  }

  // Intersect with remaining pools
  for (let i = 1; i < pools.length; i++) {
    const poolIds = new Set(pools[i].map(c => c.product_id));
    // Remove products not in this pool
    map.forEach((_, pid) => { if (!poolIds.has(pid)) map.delete(pid); });
    // Update floor scores
    for (const c of pools[i]) {
      const entry = map.get(c.product_id);
      if (entry) entry.floorScore = Math.min(entry.floorScore, c.final_score);
    }
  }

  // Build result with floor scores, sorted DESC
  const result: CandidateRow[] = [];
  map.forEach(({ candidate, floorScore }) => {
    result.push({ ...candidate, final_score: floorScore });
  });
  result.sort((a, b) => b.final_score - a.final_score);

  return result;
}


// ─── Main Fetcher (Single Pet) ─────────────────────────

/**
 * Fetch safe swap alternatives for a scanned product (single pet).
 * Daily dry food: tries curated 3-pick layout (Top Pick / Fish-Based / Great Value).
 * All other categories: generic top 3 by score.
 * Falls back to generic if curated can't fill 2+ slots.
 */
export async function fetchSafeSwaps(params: FetchSafeSwapsParams): Promise<SafeSwapResult> {
  const {
    petId, species, category, productForm, isSupplemental,
    scannedProductId, scannedScore, allergenGroups, conditionTags, petLifeStage,
  } = params;

  const isCurated = category === 'daily_food' && productForm === 'dry' && !isSupplemental;
  const minScore = MIN_SCORE_THRESHOLD;

  // Stage 1: Base pool
  const candidates = await fetchBasePool(petId, category, productForm, isSupplemental, species, scannedProductId, minScore);
  if (candidates.length === 0) {
    const populated = await isCachePopulated(petId);
    return { candidates: [], mode: 'generic', cacheEmpty: !populated };
  }

  // Stages 2-5: Exclusion filters (parallel)
  const candidateIds = candidates.map(c => c.product_id);

  const [allergenExcl, severityExcl, pantryExcl, scanExcl, cardiacExcl] = await Promise.all([
    fetchAllergenExclusions(candidateIds, allergenGroups),
    fetchSeverityExclusions(candidateIds, species),
    fetchPantryExclusions(petId),
    fetchRecentScanExclusions(petId),
    fetchCardiacDcmExclusions(candidateIds, conditionTags, species),
  ]);

  const allExcluded = new Set<string>();
  allergenExcl.forEach(id => allExcluded.add(id));
  severityExcl.forEach(id => allExcluded.add(id));
  pantryExcl.forEach(id => allExcluded.add(id));
  scanExcl.forEach(id => allExcluded.add(id));
  cardiacExcl.forEach(id => allExcluded.add(id));

  let filtered = candidates.filter(c => !allExcluded.has(c.product_id));

  // Stage 6: Condition hard filters + life stage filter
  filtered = applyConditionHardFilters(filtered, conditionTags, species);
  filtered = applyLifeStageFilter(filtered, petLifeStage);

  // Stage 7: Build results
  if (filtered.length < MIN_RESULTS) return { candidates: [], mode: 'generic' };

  if (isCurated) {
    const fishIds = await tagFishBased(filtered.map(c => c.product_id));
    const petHasFishAllergy = allergenGroups.includes('fish');
    const curated = assignCuratedSlots(filtered, fishIds, petHasFishAllergy, conditionTags, allergenGroups, species);
    if (curated) return { candidates: curated, mode: 'curated' };
  }

  const top = filtered.slice(0, MIN_RESULTS);
  const noFish = new Set<string>();
  return {
    candidates: top.map(c => candidateToSwap(c, null, noFish, conditionTags, allergenGroups, species)),
    mode: 'generic',
  };
}

