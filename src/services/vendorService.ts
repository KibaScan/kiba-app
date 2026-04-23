// Kiba — M9 Community Vendor Service
// Backs the vendor directory + the bundled is-published synchronous check
// used by ResultScreen to badge cards without a network round-trip.
//
// vendors table: migration 044 (RLS = public read where is_published=true).
// Bundled list: src/data/published_vendor_slugs.json (kept in sync via
// scripts/seedVendors.ts after admin adds rows in Studio).

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import publishedSlugs from '../data/published_vendor_slugs.json';

export interface Vendor {
  id: string;
  brand_slug: string;
  brand_name: string;
  contact_email: string | null;
  website_url: string | null;
  parent_company: string | null;
  headquarters_country: string | null;
  is_published: boolean;
}

const PUBLISHED_SLUG_SET: ReadonlySet<string> = new Set(publishedSlugs as string[]);

/**
 * Synchronous check against the bundled slug list — no network, no
 * Supabase. Use from ResultScreen and other render-path callers that
 * can't await. Bundled list rebuilt by scripts/seedVendors.ts.
 */
export function isPublishedSlug(slug: string): boolean {
  return PUBLISHED_SLUG_SET.has(slug);
}

export async function fetchPublishedVendors(): Promise<Vendor[]> {
  if (!(await isOnline())) return [];

  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, brand_slug, brand_name, contact_email, website_url, parent_company, headquarters_country, is_published')
      .eq('is_published', true)
      .order('brand_name', { ascending: true });

    if (error || !data) return [];
    return data as Vendor[];
  } catch (e) {
    console.error('[fetchPublishedVendors] FAILED:', e);
    return [];
  }
}

export async function fetchVendorBySlug(slug: string): Promise<Vendor | null> {
  if (!(await isOnline())) return null;

  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, brand_slug, brand_name, contact_email, website_url, parent_company, headquarters_country, is_published')
      .eq('brand_slug', slug)
      .maybeSingle();

    if (error || !data) return null;
    return data as Vendor;
  } catch (e) {
    console.error('[fetchVendorBySlug] FAILED:', e);
    return null;
  }
}
