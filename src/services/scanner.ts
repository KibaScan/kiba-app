// Kiba — Scanner Service
// UPC lookup: barcode → product_upcs (btree) → product_id → products row
// Zero scoring logic. This file only does database lookups and haptic feedback.

import { supabase } from './supabase';
import { Product } from '../types';
import * as Haptics from 'expo-haptics';

// ─── Constants ─────────────────────────────────────────

const LOOKUP_TIMEOUT_MS = 5000;

// ─── Result Type ───────────────────────────────────────

export type LookupResult =
  | { status: 'found'; product: Product }
  | { status: 'not_found' }
  | { status: 'error'; code: 'NETWORK_TIMEOUT' | 'DB_ERROR'; message: string };

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
