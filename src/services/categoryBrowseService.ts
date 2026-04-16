// Kiba — Category Browse Service
// Queries pet_product_scores + products for filtered browsing.
// Supplements and vet diets query products directly (unscored).
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements unscored.

import { supabase } from './supabase';
import { batchScoreHybrid } from './batchScoreOnDevice';
import type { Pet } from '../types/pet';
import type {
  BrowseCategory,
  BrowseProduct,
  BrowsePage,
  BrowseCounts,
  TopPickEntry,
} from '../types/categoryBrowse';

// ─── Constants ─────────────────────────────────────────

const PAGE_SIZE = 20;

// Name patterns for treat sub-filters (ILIKE)
const TREAT_NAME_PATTERNS: Record<string, string[]> = {
  crunchy_biscuits: ['%biscuit%', '%cookie%', '%crunchy%', '%crispy%'],
  jerky_chews: ['%jerky%', '%chew%', '%chewy%', '%stick%', '%stix%', '%bone%', '%bully%'],
  freeze_dried: ['%freeze-dried%', '%freeze dried%'],
  lickables: ['%lickable%', '%puree%', '%squeez%', '%lick%', '%tube%', '%bisque%'],
  dental: ['%dental%', '%teeth%', '%tooth%', '%oral%'],
};

// Name patterns for supplement sub-filters (ILIKE)
const SUPPLEMENT_NAME_PATTERNS: Record<string, string[]> = {
  joint_hip: ['%joint%', '%hip%', '%glucosamine%', '%chondroitin%', '%mobility%', '%msm%'],
  skin_coat: ['%skin%', '%coat%', '%omega%', '%fish oil%', '%biotin%', '%allergy%'],
  digestive: ['%digestive%', '%probiotic%', '%prebiotic%', '%gut%', '%enzyme%', '%fiber%'],
  calming: ['%calming%', '%calm%', '%anxiety%', '%stress%', '%melatonin%', '%relaxation%'],
};

// ─── Scored browse (daily food, toppers, treats) ───────

async function fetchScoredResults(
  petId: string,
  species: 'dog' | 'cat',
  dbCategory: 'daily_food' | 'treat',
  isSupplemental: boolean | null,
  productFormFilter: string | null,
  namePatterns: string[] | null,
  pageSize: number,
  cursor: { score: number; id: string } | null,
): Promise<BrowsePage> {
  let q = supabase
    .from('pet_product_scores')
    .select(`
      product_id, final_score, is_supplemental, category,
      products!inner(
        name, brand, image_url, product_form, is_vet_diet,
        is_recalled, target_species, is_supplemental,
        is_variety_pack, needs_review
      )
    `)
    .eq('pet_id', petId)
    .eq('category', dbCategory)
    .order('final_score', { ascending: false });

  if (isSupplemental !== null) {
    q = q.eq('is_supplemental', isSupplemental);
  }

  // Cursor-based pagination: get items with lower score (or same score, later id)
  if (cursor) {
    q = q.or(`final_score.lt.${cursor.score},and(final_score.eq.${cursor.score},product_id.gt.${cursor.id})`);
  }

  // When filtering by product form or name patterns, the target subset may be
  // a small fraction of the category (e.g. freeze-dried = ~11% of daily food).
  // Overfetch aggressively so the client-side filter has enough to fill a page.
  const fetchLimit = (productFormFilter || namePatterns) ? pageSize * 50 : pageSize * 3;
  q = q.limit(fetchLimit);

  const { data, error } = await q;
  if (error || !data) return { products: [], nextCursor: null };

  const products: BrowseProduct[] = [];

  for (const row of data as Record<string, unknown>[]) {
    const p = row.products as Record<string, unknown> | null;
    if (!p) continue;

    // Post-query filters (can't all be expressed in Supabase PostgREST)
    if (p.is_vet_diet) continue;
    if (p.is_recalled) continue;
    if (p.is_variety_pack) continue;
    if (p.needs_review) continue;
    if (p.target_species !== species) continue;

    if (productFormFilter) {
      const form = p.product_form as string | null;
      if (productFormFilter === 'other') {
        if (form && ['dry', 'wet', 'freeze_dried', 'freeze-dried'].includes(form)) continue;
      } else if (productFormFilter === 'freeze_dried') {
        if (form !== 'freeze_dried' && form !== 'freeze-dried') continue;
      } else {
        if (form !== productFormFilter) continue;
      }
    }

    if (namePatterns) {
      const nameLower = ((p.name as string) ?? '').toLowerCase();
      const matches = namePatterns.some((pat) => {
        const clean = pat.replace(/%/g, '').toLowerCase();
        return nameLower.includes(clean);
      });
      if (!matches) continue;
    }

    products.push({
      product_id: row.product_id as string,
      product_name: (p.name as string) ?? '',
      brand: (p.brand as string) ?? '',
      image_url: (p.image_url as string) ?? null,
      product_form: (p.product_form as string) ?? null,
      final_score: row.final_score as number,
      is_supplemental: (row.is_supplemental as boolean) ?? false,
      is_vet_diet: false,
    });

    if (products.length >= pageSize) break;
  }

  // If we got a full buffer from DB, there are likely more results
  const dbHadMore = (data as unknown[]).length >= fetchLimit;
  // If we filled a page from the buffer, offer a cursor for the next page
  const last = products[products.length - 1];
  const nextCursor = (dbHadMore || products.length >= pageSize) && last
    ? `${last.final_score}:${last.product_id}`
    : null;

  return { products: products.slice(0, pageSize), nextCursor };
}

// ─── Unscored browse (supplements, vet diets) ─────────

async function fetchUnscoredResults(
  species: 'dog' | 'cat',
  dbCategory: string | null,
  isVetDiet: boolean,
  namePatterns: string[] | null,
  pageSize: number,
  cursor: { brand: string; name: string; id: string } | null,
  opts?: { productFormFilter?: string; isSupplemental?: boolean },
): Promise<BrowsePage> {
  let q = supabase
    .from('products')
    .select('id, name, brand, image_url, product_form, is_supplemental, is_vet_diet')
    .in('target_species', [species, 'all'])
    .eq('is_recalled', false)
    .eq('is_variety_pack', false)
    .eq('needs_review', false)
    .order('brand', { ascending: true })
    .order('name', { ascending: true })
    .limit(pageSize + 1);

  if (isVetDiet) {
    q = q.eq('is_vet_diet', true);
  } else if (dbCategory) {
    q = q.eq('category', dbCategory);
    q = q.eq('is_vet_diet', false);
  }

  if (opts?.isSupplemental !== undefined) {
    q = q.eq('is_supplemental', opts.isSupplemental);
  }

  if (opts?.productFormFilter) {
    if (opts.productFormFilter === 'freeze_dried') {
      q = q.in('product_form', ['freeze_dried', 'freeze-dried']);
    } else if (opts.productFormFilter === 'other') {
      q = q.not('product_form', 'in', '("dry","wet","freeze_dried","freeze-dried")');
    } else {
      q = q.eq('product_form', opts.productFormFilter);
    }
  }

  // Name-pattern filtering via Supabase .or() for supplement sub-filters
  if (namePatterns && namePatterns.length > 0) {
    const orChain = namePatterns.map((pat) => `name.ilike.${pat}`).join(',');
    q = q.or(orChain);
  }

  // Cursor-based pagination for alphabetical sort
  if (cursor) {
    q = q.or(
      `brand.gt.${cursor.brand},and(brand.eq.${cursor.brand},name.gt.${cursor.name}),and(brand.eq.${cursor.brand},name.eq.${cursor.name},id.gt.${cursor.id})`,
    );
  }

  const { data, error } = await q;
  if (error || !data) return { products: [], nextCursor: null };

  const products: BrowseProduct[] = [];
  for (const row of data as Record<string, unknown>[]) {
    products.push({
      product_id: row.id as string,
      product_name: (row.name as string) ?? '',
      brand: (row.brand as string) ?? '',
      image_url: (row.image_url as string) ?? null,
      product_form: (row.product_form as string) ?? null,
      final_score: null,
      is_supplemental: (row.is_supplemental as boolean) ?? false,
      is_vet_diet: (row.is_vet_diet as boolean) ?? false,
    });
    if (products.length >= pageSize) break;
  }

  const hasMore = (data as unknown[]).length > pageSize;
  const last = products[products.length - 1];
  const nextCursor = hasMore && last
    ? `${last.brand}::${last.product_name}::${last.product_id}`
    : null;

  return { products, nextCursor };
}

// ─── Form-specific scoring trigger ────────────────────

/**
 * Checks if a specific product form has any cached scores for this pet.
 * If not, triggers batch scoring for that form so the browse screen
 * can show scored results instead of falling back to unscored products.
 * Returns true if scoring was triggered, false if cache already had scores.
 */
export async function ensureFormScored(
  petId: string,
  petProfile: Pet,
  category: string,
  productForm: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('pet_product_scores')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId)
    .eq('category', category)
    .eq('product_form', productForm);

  if (error || (count ?? 0) > 0) return false;

  try {
    await batchScoreHybrid(petId, petProfile, category, productForm);
    return true;
  } catch {
    return false;
  }
}

// ─── Public API ────────────────────────────────────────

function parseScoredCursor(raw: string | null): { score: number; id: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx === -1) return null;
  return { score: Number(raw.slice(0, idx)), id: raw.slice(idx + 1) };
}

function parseUnscoredCursor(raw: string | null): { brand: string; name: string; id: string } | null {
  if (!raw) return null;
  const parts = raw.split('::');
  if (parts.length !== 3) return null;
  return { brand: parts[0], name: parts[1], id: parts[2] };
}

/**
 * Fetch a page of browse results for a category + optional sub-filter.
 */
export async function fetchBrowseResults(
  petId: string,
  category: BrowseCategory,
  subFilterKey: string | null,
  species: 'dog' | 'cat',
  cursor: string | null = null,
  pageSize: number = PAGE_SIZE,
): Promise<BrowsePage> {
  switch (category) {
    case 'daily_food': {
      if (subFilterKey === 'vet_diet') {
        return fetchUnscoredResults(species, null, true, null, pageSize, parseUnscoredCursor(cursor));
      }
      const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried', other: 'other' };
      const form = subFilterKey ? formMap[subFilterKey] ?? null : null;
      const scored = await fetchScoredResults(petId, species, 'daily_food', false, form, null, pageSize, parseScoredCursor(cursor));
      // Fallback: if batch scoring cache has no results for this form,
      // query products directly (unscored) so the user sees something
      if (scored.products.length === 0 && form && !cursor) {
        return fetchUnscoredResults(species, 'daily_food', false, null, pageSize, parseUnscoredCursor(null),
          { productFormFilter: form, isSupplemental: false });
      }
      return scored;
    }

    case 'toppers_mixers': {
      const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried' };
      const form = subFilterKey ? formMap[subFilterKey] ?? null : null;
      const scored = await fetchScoredResults(petId, species, 'daily_food', true, form, null, pageSize, parseScoredCursor(cursor));
      if (scored.products.length === 0 && form && !cursor) {
        return fetchUnscoredResults(species, 'daily_food', false, null, pageSize, parseUnscoredCursor(null),
          { productFormFilter: form, isSupplemental: true });
      }
      return scored;
    }

    case 'treat': {
      const patterns = subFilterKey ? TREAT_NAME_PATTERNS[subFilterKey] ?? null : null;
      // Freeze-dried treats: also match by product_form
      if (subFilterKey === 'freeze_dried') {
        const scored = await fetchScoredResults(petId, species, 'treat', null, 'freeze_dried', patterns, pageSize, parseScoredCursor(cursor));
        if (scored.products.length === 0 && !cursor) {
          return fetchUnscoredResults(species, 'treat', false, patterns, pageSize, parseUnscoredCursor(null),
            { productFormFilter: 'freeze_dried' });
        }
        return scored;
      }
      return fetchScoredResults(petId, species, 'treat', null, null, patterns, pageSize, parseScoredCursor(cursor));
    }

    case 'supplement': {
      const patterns = subFilterKey ? SUPPLEMENT_NAME_PATTERNS[subFilterKey] ?? null : null;
      return fetchUnscoredResults(species, 'supplement', false, patterns, pageSize, parseUnscoredCursor(cursor));
    }
  }
}

/**
 * Fetch badge counts for all categories and sub-filters.
 * Call once per pet change, cache the result.
 */
export async function fetchBrowseCounts(species: 'dog' | 'cat'): Promise<BrowseCounts | null> {
  const { data, error } = await supabase.rpc('get_browse_counts', { p_species: species });
  if (error || !data) return null;
  return data as BrowseCounts;
}

/**
 * Fetches the top N scored products for a category + optional sub-filter,
 * enriched with insight-source fields (macros, AAFCO, preservative,
 * top-10 ingredient preview). One-shot — no pagination.
 *
 * Supplements return [] (caller should route to CategoryBrowseScreen instead).
 * Inherits bypass filters from fetchScoredResults: vet_diet, recalled,
 * variety_pack, needs_review, species mismatch.
 */
export async function fetchCategoryTopPicks(
  petId: string,
  category: BrowseCategory,
  subFilterKey: string | null,
  species: 'dog' | 'cat',
  limit: number = 20,
): Promise<TopPickEntry[]> {
  if (category === 'supplement') return [];

  const dbCategory: 'daily_food' | 'treat' =
    category === 'treat' ? 'treat' : 'daily_food';
  const isSupplemental: boolean | null =
    category === 'toppers_mixers' ? true : category === 'daily_food' ? false : null;

  // Resolve product_form filter from sub-filter (same mapping as fetchScoredResults)
  let productFormFilter: string | null = null;
  if (category === 'daily_food' || category === 'toppers_mixers') {
    const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried', other: 'other' };
    productFormFilter = subFilterKey ? formMap[subFilterKey] ?? null : null;
  } else if (category === 'treat' && subFilterKey === 'freeze_dried') {
    productFormFilter = 'freeze_dried';
  }

  // Treat name patterns for treats + other sub-filters
  let namePatterns: string[] | null = null;
  if (category === 'treat' && subFilterKey && subFilterKey !== 'freeze_dried') {
    namePatterns = TREAT_NAME_PATTERNS[subFilterKey] ?? null;
  }

  // ── Query 1: pet_product_scores !inner products with expanded SELECT ──
  let q = supabase
    .from('pet_product_scores')
    .select(`
      product_id, final_score, is_supplemental, category,
      products!inner(
        name, brand, image_url, product_form, is_vet_diet, is_recalled,
        target_species, is_supplemental, is_variety_pack, needs_review,
        ga_protein_pct, ga_fat_pct, ga_moisture_pct,
        ga_protein_dmb_pct, ga_fat_dmb_pct,
        preservative_type, aafco_statement, life_stage_claim
      )
    `)
    .eq('pet_id', petId)
    .eq('category', dbCategory);

  if (isSupplemental !== null) {
    q = q.eq('is_supplemental', isSupplemental);
  }

  q = q.order('final_score', { ascending: false });

  // Overfetch 3x to survive post-query filters (vet_diet, variety_pack, etc.)
  const fetchLimit = (productFormFilter || namePatterns) ? limit * 10 : limit * 3;
  q = q.limit(fetchLimit);

  const { data, error } = await q;
  if (error || !data) return [];

  // ── Post-query filtering ──
  const filtered: TopPickEntry[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const p = row.products as Record<string, unknown> | null;
    if (!p) continue;
    if (p.is_vet_diet) continue;
    if (p.is_recalled) continue;
    if (p.is_variety_pack) continue;
    if (p.needs_review) continue;
    if (p.target_species !== species) continue;

    if (productFormFilter) {
      const form = p.product_form as string | null;
      if (productFormFilter === 'other') {
        if (form && ['dry', 'wet', 'freeze_dried', 'freeze-dried'].includes(form)) continue;
      } else if (productFormFilter === 'freeze_dried') {
        if (form !== 'freeze_dried' && form !== 'freeze-dried') continue;
      } else if (form !== productFormFilter) {
        continue;
      }
    }

    if (namePatterns) {
      const nameLower = ((p.name as string) ?? '').toLowerCase();
      const matches = namePatterns.some((pat) =>
        nameLower.includes(pat.replace(/%/g, '').toLowerCase()),
      );
      if (!matches) continue;
    }

    filtered.push({
      product_id: row.product_id as string,
      product_name: (p.name as string) ?? '',
      brand: (p.brand as string) ?? '',
      image_url: (p.image_url as string) ?? null,
      product_form: (p.product_form as string) ?? null,
      final_score: row.final_score as number,
      is_supplemental: (row.is_supplemental as boolean) ?? false,
      is_vet_diet: false,
      ga_protein_pct: (p.ga_protein_pct as number) ?? null,
      ga_fat_pct: (p.ga_fat_pct as number) ?? null,
      ga_moisture_pct: (p.ga_moisture_pct as number) ?? null,
      ga_protein_dmb_pct: (p.ga_protein_dmb_pct as number) ?? null,
      ga_fat_dmb_pct: (p.ga_fat_dmb_pct as number) ?? null,
      preservative_type: (p.preservative_type as TopPickEntry['preservative_type']) ?? null,
      aafco_statement: (p.aafco_statement as string) ?? null,
      life_stage_claim: (p.life_stage_claim as string) ?? null,
      top_ingredients: [],
    });

    if (filtered.length >= limit) break;
  }

  if (filtered.length === 0) return [];

  // ── Query 2: ingredient preview (top 10 per product, allergen_group) ──
  const productIds = filtered.map((e) => e.product_id);
  const { data: ingData } = await supabase
    .from('product_ingredients')
    .select('product_id, position, canonical_name, ingredients_dict!inner(allergen_group)')
    .in('product_id', productIds)
    .lte('position', 10)
    .order('position', { ascending: true });

  if (ingData) {
    for (const row of ingData as Record<string, unknown>[]) {
      const pid = row.product_id as string;
      const target = filtered.find((e) => e.product_id === pid);
      if (!target) continue;
      const dict = row.ingredients_dict as { allergen_group: string | null } | null;
      target.top_ingredients.push({
        position: row.position as number,
        canonical_name: (row.canonical_name as string) ?? '',
        allergen_group: dict?.allergen_group ?? null,
      });
    }
  }

  return filtered;
}
