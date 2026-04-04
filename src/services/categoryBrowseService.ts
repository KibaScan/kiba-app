// Kiba — Category Browse Service
// Queries pet_product_scores + products for filtered browsing.
// Supplements and vet diets query products directly (unscored).
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements unscored.

import { supabase } from './supabase';
import type {
  BrowseCategory,
  BrowseProduct,
  BrowsePage,
  BrowseCounts,
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
    .order('final_score', { ascending: false })
    .limit(pageSize * 3); // overfetch to absorb client-side filter losses

  if (isSupplemental !== null) {
    q = q.eq('is_supplemental', isSupplemental);
  }

  // Cursor-based pagination: get items with lower score (or same score, later id)
  if (cursor) {
    q = q.or(`final_score.lt.${cursor.score},and(final_score.eq.${cursor.score},product_id.gt.${cursor.id})`);
  }

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
  const dbHadMore = (data as unknown[]).length >= pageSize * 3;
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
      return fetchScoredResults(petId, species, 'daily_food', false, form, null, pageSize, parseScoredCursor(cursor));
    }

    case 'toppers_mixers': {
      const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried' };
      const form = subFilterKey ? formMap[subFilterKey] ?? null : null;
      return fetchScoredResults(petId, species, 'daily_food', true, form, null, pageSize, parseScoredCursor(cursor));
    }

    case 'treat': {
      const patterns = subFilterKey ? TREAT_NAME_PATTERNS[subFilterKey] ?? null : null;
      // Freeze-dried treats: also match by product_form
      if (subFilterKey === 'freeze_dried') {
        return fetchScoredResults(petId, species, 'treat', null, 'freeze_dried', patterns, pageSize, parseScoredCursor(cursor));
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
 * Stub for future Top Picks screen.
 * Fetches the top N products for a category + sub-filter.
 */
export async function fetchCategoryTopPicks(
  petId: string,
  category: BrowseCategory,
  subFilterKey: string | null,
  species: 'dog' | 'cat',
  limit: number = 50,
): Promise<BrowseProduct[]> {
  const result = await fetchBrowseResults(petId, category, subFilterKey, species, null, limit);
  return result.products;
}
