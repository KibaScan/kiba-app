// Kiba — M9 Community Recipe Service
// User-submitted "Kiba Kitchen" recipes with moderation. community_recipes:
// migration 041 (RLS pins inserts to status='pending'). Storage bucket
// 'recipe-images': migration 047, path `{userId}/{recipeId}.jpg`.
//
// Submission order (spec §6.1): client UUID → upload image → insert row →
// invoke validate-recipe Edge Function. The DB column has NO default UUID —
// client must supply `id` before storage upload so the path is deterministic.
//
// Writes throw RecipeOfflineError offline (pantryService convention).
// Reads return [] / null offline.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import {
  RecipeOfflineError,
  type CommunityRecipe,
  type SubmitRecipeInput,
  type SubmitRecipeResult,
} from '../types/recipe';

const BUCKET = 'recipe-images';
const TABLE = 'community_recipes';
const COLUMNS = 'id, user_id, title, subtitle, species, life_stage, ingredients, prep_steps, cover_image_url, status, rejection_reason, is_killed, created_at, reviewed_at';
const DEFAULT_LIMIT = 20;

// ─── Internal ───────────────────────────────────────────

/**
 * RFC 4122 v4 UUID generator. Prefers `globalThis.crypto.randomUUID` (native
 * in Hermes / RN 0.74+) so we don't pull in the `expo-crypto` native module —
 * adding it forces a dev-client rebuild ("Cannot find native module
 * 'ExpoCrypto'"). Falls back to `Math.random()` only on platforms missing the
 * Web Crypto API; collision risk is acceptable for a recipe submission ID
 * (single-user write, immediately consumed by the upload+insert pair).
 */
function randomUUID(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new RecipeOfflineError();
}

/**
 * Upload the local cover image to the recipe-images bucket and return the
 * public URL. Uses arrayBuffer() — petService.uploadPetPhoto switched to this
 * because Blob is unreliable in React Native.
 */
async function uploadCoverImage(
  userId: string,
  recipeId: string,
  localUri: string,
): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/${recipeId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload recipe cover: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

interface ValidateRecipeResponse {
  status: 'auto_rejected' | 'pending_review';
  reason?: string;
}

// ─── Write Functions ────────────────────────────────────

export async function submitRecipe(
  input: SubmitRecipeInput,
): Promise<SubmitRecipeResult> {
  await requireOnline();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not authenticated — cannot submit recipe.');

  // Client-supplied UUID lets the storage path be deterministic before the
  // INSERT, keeping upload + insert atomic from the client's perspective.
  const recipeId = randomUUID();

  const coverImageUrl = await uploadCoverImage(userId, recipeId, input.cover_image_uri);

  // RLS (migration 041) only permits status='pending', is_killed=false,
  // rejection_reason=null, reviewed_at=null on insert. We rely on the column
  // defaults rather than setting them explicitly.
  const { error: insertErr } = await supabase
    .from(TABLE)
    .insert({
      id: recipeId,
      user_id: userId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      species: input.species,
      life_stage: input.life_stage,
      ingredients: input.ingredients,
      prep_steps: input.prep_steps,
      cover_image_url: coverImageUrl,
    });

  if (insertErr) {
    throw new Error(`Failed to insert recipe: ${insertErr.message}`);
  }

  // validate-recipe runs server-side validators (toxic ingredients, profanity,
  // etc.) and updates status to either auto_rejected or pending_review.
  const { data, error } = await supabase.functions.invoke('validate-recipe', {
    body: { recipe_id: recipeId },
  });

  if (error) {
    throw new Error(`validate-recipe failed: ${error.message}`);
  }

  const response = data as ValidateRecipeResponse;
  if (response?.status === 'auto_rejected') {
    return {
      status: 'auto_rejected',
      reason: response.reason ?? 'Recipe failed automatic safety checks.',
      recipe_id: recipeId,
    };
  }

  return { status: 'pending_review', recipe_id: recipeId };
}

// ─── Read Functions ─────────────────────────────────────

export async function fetchApprovedRecipes(
  limit: number = DEFAULT_LIMIT,
): Promise<CommunityRecipe[]> {
  if (!(await isOnline())) return [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('status', 'approved')
      .eq('is_killed', false)
      .order('reviewed_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as CommunityRecipe[];
  } catch (e) {
    console.error('[fetchApprovedRecipes] FAILED:', e);
    return [];
  }
}

export async function fetchRecipeById(id: string): Promise<CommunityRecipe | null> {
  if (!(await isOnline())) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as CommunityRecipe;
  } catch (e) {
    console.error('[fetchRecipeById] FAILED:', e);
    return null;
  }
}

export async function fetchMyRecipes(): Promise<CommunityRecipe[]> {
  if (!(await isOnline())) return [];

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return [];

    // Index community_recipes_user_idx is (user_id, created_at DESC) — match
    // it so PostgREST scans the index.
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as CommunityRecipe[];
  } catch (e) {
    console.error('[fetchMyRecipes] FAILED:', e);
    return [];
  }
}
