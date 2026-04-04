// M5 Top Matches Service — Cache freshness, query, and batch trigger.
// Phase 3 of TOP_MATCHES_PLAN.md: lazy invalidation + cache queries.
// No store sync — deferred to useTopMatchesStore (Phase 5).

import { supabase } from './supabase';
import type { Pet } from '../types/pet';
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
}

/**
 * Search products table directly by name/brand.
 * Independent of batch-score cache — works even when pet_product_scores is empty.
 */
export async function searchProducts(
  query: string,
  species: 'dog' | 'cat',
  filters?: {
    category?: 'daily_food' | 'treat';
    productForm?: string;
    isSupplemental?: boolean;
  },
): Promise<ProductSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed && !filters?.category) return [];

  let q = supabase
    .from('products')
    .select('id, name, brand, image_url, product_form, category, is_supplemental')
    .eq('target_species', species)
    .eq('is_vet_diet', false)
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

  return (data as Record<string, unknown>[]).map((row) => ({
    product_id: row.id as string,
    product_name: row.name as string,
    brand: row.brand as string,
    image_url: (row.image_url as string) ?? null,
    product_form: (row.product_form as string) ?? null,
    category: row.category as string,
  }));
}

