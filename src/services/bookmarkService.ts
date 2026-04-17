// Bookmark Service — Supabase CRUD + 20-cap enforcement + card hydration.
// Follows pantryService.ts patterns. Offline = throw/empty-read.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import { batchScoreHybrid } from './batchScoreOnDevice';
import {
  type Bookmark,
  type BookmarkCardData,
  BookmarkOfflineError,
  BookmarksFullError,
  MAX_BOOKMARKS_PER_PET,
} from '../types/bookmark';
import type { Pet } from '../types/pet';

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new BookmarkOfflineError();
}

async function getActiveUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');
  return session.user.id;
}

/**
 * True if a row exists for (petId, productId).
 */
export async function isBookmarked(petId: string, productId: string): Promise<boolean> {
  if (!(await isOnline())) return false;
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('pet_id', petId)
    .eq('product_id', productId)
    .maybeSingle();
  return data !== null;
}

/**
 * Returns all bookmarks for a pet, newest first.
 * Score is NOT included here — resolve via pet_product_scores cache at the caller.
 */
export async function getBookmarksForPet(petId: string): Promise<Bookmark[]> {
  if (!(await isOnline())) return [];
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(MAX_BOOKMARKS_PER_PET);
  if (error) throw new Error(`Failed to load bookmarks: ${error.message}`);
  return (data ?? []) as Bookmark[];
}

/**
 * Insert a bookmark. Throws BookmarksFullError if pet has already hit cap.
 * Returns the new row.
 */
export async function addBookmark(petId: string, productId: string): Promise<Bookmark> {
  await requireOnline();
  const userId = await getActiveUserId();

  const { count } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId);

  if ((count ?? 0) >= MAX_BOOKMARKS_PER_PET) throw new BookmarksFullError();

  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, pet_id: petId, product_id: productId })
    .select()
    .single();

  if (error) throw new Error(`Failed to add bookmark: ${error.message}`);
  return data as Bookmark;
}

/**
 * Delete by (petId, productId). Idempotent — no error if row missing.
 */
export async function removeBookmark(petId: string, productId: string): Promise<void> {
  await requireOnline();
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('pet_id', petId)
    .eq('product_id', productId);
  if (error) throw new Error(`Failed to remove bookmark: ${error.message}`);
}

/**
 * Toggle: delete if exists, otherwise add. Returns the new state (true = now bookmarked).
 */
export async function toggleBookmark(petId: string, productId: string): Promise<boolean> {
  const currently = await isBookmarked(petId, productId);
  if (currently) {
    await removeBookmark(petId, productId);
    return false;
  }
  await addBookmark(petId, productId);
  return true;
}

/**
 * Hydrated bookmark list — bookmarks joined with product data + live scores.
 * Uses PostgREST nested select for the product join (single round-trip).
 * If any bookmark lacks a cached score, fires `batchScoreHybrid` in the background
 * to hydrate the cache for next render (fire-and-forget).
 */
export async function fetchBookmarkCards(pet: Pet): Promise<BookmarkCardData[]> {
  if (!(await isOnline())) return [];

  const { data, error } = await supabase
    .from('bookmarks')
    .select(
      '*, product:products(id, brand, name, image_url, is_recalled, is_vet_diet, is_variety_pack, is_supplemental, target_species)',
    )
    .eq('pet_id', pet.id)
    .order('created_at', { ascending: false })
    .limit(MAX_BOOKMARKS_PER_PET);

  if (error) throw new Error(`Failed to load bookmark cards: ${error.message}`);
  const rows = (data ?? []) as Array<Bookmark & { product: BookmarkCardData['product'] | null }>;
  const withProduct = rows.filter(
    (r): r is Bookmark & { product: BookmarkCardData['product'] } => r.product !== null,
  );

  const productIds = withProduct.map((r) => r.product.id);
  if (productIds.length === 0) return [];

  const { data: scoreRows } = await supabase
    .from('pet_product_scores')
    .select('product_id, final_score')
    .eq('pet_id', pet.id)
    .in('product_id', productIds);

  const scoreMap = new Map<string, number>(
    (scoreRows ?? []).map((s: { product_id: string; final_score: number }) => [s.product_id, s.final_score]),
  );

  const cards: BookmarkCardData[] = withProduct.map((r) => ({
    bookmark: {
      id: r.id,
      user_id: r.user_id,
      pet_id: r.pet_id,
      product_id: r.product.id,
      created_at: r.created_at,
    },
    product: r.product,
    final_score: scoreMap.get(r.product.id) ?? null,
  }));

  // JIT cache hydration: fire-and-forget if any card is unscored.
  if (cards.some((c) => c.final_score === null)) {
    void batchScoreHybrid(pet.id, pet).catch((err) => {
      console.warn('[fetchBookmarkCards] JIT batchScoreHybrid failed:', err);
    });
  }

  return cards;
}
