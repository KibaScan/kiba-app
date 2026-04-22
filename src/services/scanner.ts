// Kiba — Scanner Service
// UPC lookup: barcode → product_upcs (btree) → product_id → products row
// External UPC lookup via Edge Function (D-127)
// Zero scoring logic. This file only does database lookups and haptic feedback.

import { supabase } from './supabase';
import { Product } from '../types';
import * as Haptics from 'expo-haptics';
import { normalizeCanonicalName } from '../utils/ingredientNormalizer';

// ─── Constants ─────────────────────────────────────────

const LOOKUP_TIMEOUT_MS = 5000;

// ─── Result Types ──────────────────────────────────────

type LookupResult =
  | { status: 'found'; product: Product }
  | { status: 'not_found' }
  | { status: 'error'; code: 'NETWORK_TIMEOUT' | 'DB_ERROR'; message: string };

interface ExternalUpcResult {
  found: boolean;
  product_name: string | null;
  brand: string | null;
  image_url: string | null;
}

export interface ParseIngredientsResult {
  ingredients: string[];
  confidence: string;
  parsed_count: number;
  suggested_category: string;
  suggested_species: string;
  category_confidence: string;
  classification_signals: string;
}

// ─── Helpers ───────────────────────────────────────────

function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), LOOKUP_TIMEOUT_MS),
    ),
  ]);
}

// ─── UPC Lookup ────────────────────────────────────────

export async function lookupByUpc(upc: string): Promise<LookupResult> {
  try {
    // Step 1: Look up UPC in junction table (D-040: btree index)
    const { data: upcRow, error: upcError } = await withTimeout(
      supabase
        .from('product_upcs')
        .select('product_id')
        .eq('upc', upc)
        .maybeSingle(),
    );

    if (upcError) {
      console.error('Scanner DB error:', { upc, table: 'product_upcs', error: upcError });
      return { status: 'error', code: 'DB_ERROR', message: upcError.message };
    }

    if (!upcRow) {
      return { status: 'not_found' };
    }

    // Step 2: Fetch full product record by ID
    const { data: product, error: productError } = await withTimeout(
      supabase
        .from('products')
        .select('*')
        .eq('id', upcRow.product_id)
        .single(),
    );

    if (productError) {
      console.error('Scanner DB error:', { upc, table: 'products', error: productError });
      return { status: 'error', code: 'DB_ERROR', message: productError.message };
    }

    // Step 3: Orphaned UPC — junction row exists but product missing
    if (!product) {
      console.warn(`Orphaned UPC detected: ${upc}`);
      return { status: 'not_found' };
    }

    // Step 4: Haptic feedback on successful lookup
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    return { status: 'found', product: product as Product };
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT') {
      return { status: 'error', code: 'NETWORK_TIMEOUT', message: 'Request timed out' };
    }
    throw err;
  }
}

// ─── External UPC Lookup (D-127: via Edge Function) ───

export async function lookupExternalUpc(upc: string): Promise<ExternalUpcResult> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('upc-lookup', {
        body: { upc },
      }),
    );

    if (error) {
      console.error('[Scanner] External UPC lookup error:', error);
      return { found: false, product_name: null, brand: null, image_url: null };
    }

    return data as ExternalUpcResult;
  } catch (err) {
    console.error('[Scanner] External UPC lookup failed:', err);
    return { found: false, product_name: null, brand: null, image_url: null };
  }
}

// ─── Parse Ingredients (D-127, D-128: via Edge Function) ─

export async function parseIngredients(
  rawText: string,
  productName?: string,
  brand?: string,
): Promise<ParseIngredientsResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-ingredients', {
      body: {
        raw_text: rawText,
        product_name: productName,
        brand: brand,
      },
    });

    if (error) {
      console.error('[Scanner] Parse ingredients error:', error);
      return null;
    }

    return data as ParseIngredientsResult;
  } catch (err) {
    console.error('[Scanner] Parse ingredients failed:', err);
    return null;
  }
}

// ─── Community Product Save ───────────────────────────

interface CommunitySaveParams {
  upc: string;
  name: string;
  brand: string;
  category: string;
  targetSpecies: string;
  ingredientsRaw: string;
  parsedIngredients: string[];
  haikuSuggestedCategory: string;
  haikuSuggestedSpecies: string;
  userCorrectedCategory: boolean;
  userCorrectedSpecies: boolean;
}

interface CommunitySaveResult {
  status: 'saved' | 'error';
  productId: string | null;
  message?: string;
}

export async function saveCommunityProduct(
  params: CommunitySaveParams,
): Promise<CommunitySaveResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { status: 'error', productId: null, message: 'Not authenticated' };
    }

    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        brand: params.brand || 'Unknown',
        name: params.name || 'Unknown Product',
        category: params.category,
        target_species: params.targetSpecies === 'all' ? 'dog' : params.targetSpecies,
        source: 'community',
        needs_review: true,
        contributed_by: user.id,
        ingredients_raw: params.ingredientsRaw,
        score_confidence: 'partial',
        haiku_suggested_category: params.haikuSuggestedCategory,
        haiku_suggested_species: params.haikuSuggestedSpecies,
        user_corrected_category: params.userCorrectedCategory,
        user_corrected_species: params.userCorrectedSpecies,
      })
      .select('id')
      .single();

    if (productError || !product) {
      console.error('[Scanner] Community save error:', productError);
      return { status: 'error', productId: null, message: productError?.message };
    }

    // Insert UPC binding
    const { error: upcError } = await supabase
      .from('product_upcs')
      .insert({ upc: params.upc, product_id: product.id });

    if (upcError) {
      console.warn('[Scanner] UPC binding error (product saved):', upcError);
    }

    // Match parsed ingredients against ingredients_dict and create junction rows
    if (params.parsedIngredients.length > 0) {
      const lowerNames = params.parsedIngredients.map((n) =>
        normalizeCanonicalName(n.toLowerCase().trim()),
      );

      const { data: dictRows } = await supabase
        .from('ingredients_dict')
        .select('id, canonical_name')
        .in('canonical_name', lowerNames);

      if (dictRows && dictRows.length > 0) {
        const nameToId = new Map(
          dictRows.map((r: { id: string; canonical_name: string }) => [
            normalizeCanonicalName(r.canonical_name.toLowerCase()),
            r.id,
          ]),
        );

        const junctionRows = params.parsedIngredients
          .map((name, idx) => {
            const ingredientId = nameToId.get(normalizeCanonicalName(name.toLowerCase().trim()));
            if (!ingredientId) return null;
            return {
              product_id: product.id,
              ingredient_id: ingredientId,
              position: idx + 1,
            };
          })
          .filter(Boolean);

        if (junctionRows.length > 0) {
          const { error: junctionError } = await supabase
            .from('product_ingredients')
            .insert(junctionRows);

          if (junctionError) {
            console.warn('[Scanner] Junction insert error:', junctionError);
          }
        }
      }
    }

    return { status: 'saved', productId: product.id };
  } catch (err) {
    console.error('[Scanner] Community save failed:', err);
    return { status: 'error', productId: null, message: 'Unexpected error' };
  }
}
