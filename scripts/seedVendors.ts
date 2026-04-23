import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname shim for Node ESM mode (matches syncToxicFoods.ts pattern)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VENDORS_JSON = resolve(__dirname, '..', 'docs', 'data', 'vendors.json');
const SLUGS_OUT = resolve(__dirname, '..', 'src', 'data', 'published_vendor_slugs.json');

interface VendorInput {
  brand_name: string;
  contact_email?: string;
  website_url?: string;
  parent_company?: string;
  headquarters_country?: string;
  is_published?: boolean;
}

function brandSlugify(brand: string): string {
  // Mirrors src/utils/brandSlugify.ts — duplicated here because scripts/ runs
  // under raw Node and importing across the src boundary requires path
  // acrobatics. Same drift-risk class as the validate-recipe Edge Function.
  return brand
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  const file = JSON.parse(readFileSync(VENDORS_JSON, 'utf-8')) as { vendors: VendorInput[] };
  const rows = file.vendors.map((v) => ({
    brand_slug: brandSlugify(v.brand_name),
    brand_name: v.brand_name,
    contact_email: v.contact_email ?? null,
    website_url: v.website_url ?? null,
    parent_company: v.parent_company ?? null,
    headquarters_country: v.headquarters_country ?? null,
    is_published: v.is_published ?? false,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    // Only require/validate Supabase credentials when we actually have rows
    // to upsert. Lets the script run end-to-end with an empty placeholder
    // file (smoke test path) without needing real env vars.
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
      process.exit(1);
    }
    const sb = createClient(url, key);
    const { error } = await sb.from('vendors').upsert(rows, { onConflict: 'brand_slug' });
    if (error) {
      console.error('Upsert failed:', error);
      process.exit(1);
    }
    console.log(`Upserted ${rows.length} vendors.`);
  } else {
    console.log('vendors.json is empty — skipping DB upsert.');
  }

  const publishedSlugs = rows.filter((r) => r.is_published).map((r) => r.brand_slug);
  writeFileSync(SLUGS_OUT, JSON.stringify(publishedSlugs, null, 2));
  console.log(`Wrote ${publishedSlugs.length} published slugs to ${SLUGS_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
