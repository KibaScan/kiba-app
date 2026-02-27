// Kiba — Scanner Service
// UPC lookup: barcode → product_upcs (btree) → product_id → products row
// Zero scoring logic. This file only does database lookups and haptic feedback.

import { supabase } from './supabase';
import { Product } from '../types';
import * as Haptics from 'expo-haptics';

// ─── Result Type ───────────────────────────────────────

export type LookupResult =
  | { status: 'found'; product: Product }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

// ─── UPC Lookup ────────────────────────────────────────

export async function lookupByUpc(upc: string): Promise<LookupResult> {
  // Step 1: Look up UPC in junction table (D-040: btree index)
  const { data: upcRow, error: upcError } = await supabase
    .from('product_upcs')
    .select('product_id')
    .eq('upc', upc)
    .maybeSingle();

  if (upcError) {
    console.error('[scanner] UPC lookup error:', upcError.message);
    return { status: 'error', message: upcError.message };
  }

  if (!upcRow) {
    return { status: 'not_found' };
  }

  // Step 2: Fetch full product record by ID
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', upcRow.product_id)
    .single();

  if (productError) {
    console.error('[scanner] Product lookup error:', productError.message);
    return { status: 'error', message: productError.message };
  }

  // Step 3: Haptic feedback on successful lookup
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  return { status: 'found', product: product as Product };
}
