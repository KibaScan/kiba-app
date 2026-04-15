// Scan history query service — recent scans per pet, joined with product data.

import { supabase } from './supabase';
import type { ScanHistoryItem } from '../types/scanHistory';

/**
 * Fetch recent scans for a pet, deduplicated by product_id (most recent kept).
 * Joins with products table for display data. Returns [] on error (graceful read).
 * Only non-bypass scans exist in scan_history — bypassed products (vet diet,
 * species mismatch, variety pack, recalled) are never inserted.
 */
export async function getRecentScans(
  petId: string,
  limit: number = 5,
): Promise<ScanHistoryItem[]> {
  if (!petId) return [];

  const { data, error } = await supabase
    .from('scan_history')
    .select(
      'id, product_id, pet_id, final_score, scanned_at, products(name, brand, image_url, category, is_supplemental, is_recalled, is_vet_diet)',
    )
    .eq('pet_id', petId)
    .order('scanned_at', { ascending: false })
    .limit(20);

  console.log('[getRecentScans] query result:', { error, rowCount: data?.length ?? 0, data });
  if (error || !data) return [];

  // Map + deduplicate by product_id (first occurrence = most recent)
  const seen = new Set<string>();
  const results: ScanHistoryItem[] = [];

  for (const row of data as Record<string, unknown>[]) {
    const productId = row.product_id as string;
    if (seen.has(productId)) continue;

    const product = row.products as ScanHistoryItem['product'] | null;
    if (!product) continue; // deleted product guard

    seen.add(productId);
    results.push({
      id: row.id as string,
      product_id: productId,
      pet_id: row.pet_id as string,
      final_score: row.final_score as number | null,
      scanned_at: row.scanned_at as string,
      product,
    });

    if (results.length >= limit) break;
  }

  return results;
}
