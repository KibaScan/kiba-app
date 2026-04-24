// vendorService — fetchPublishedVendors + fetchVendorBySlug + isPublishedSlug.
// Bundled-list mock keeps isPublishedSlug deterministic (live JSON is empty).

jest.mock('../../src/data/published_vendor_slugs.json', () => ['acme-pet', 'fluffy-co'], { virtual: false });

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import {
  fetchPublishedVendors,
  fetchVendorBySlug,
  isPublishedSlug,
} from '../../src/services/vendorService';
import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

// ─── isPublishedSlug ────────────────────────────────────

describe('isPublishedSlug', () => {
  test('returns true for slug present in bundled list', () => {
    expect(isPublishedSlug('acme-pet')).toBe(true);
    expect(isPublishedSlug('fluffy-co')).toBe(true);
  });

  test('returns false for slug not in bundled list', () => {
    expect(isPublishedSlug('unknown-brand')).toBe(false);
  });

  test('does not call supabase (sync, no network)', () => {
    isPublishedSlug('acme-pet');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─── fetchPublishedVendors ──────────────────────────────

describe('fetchPublishedVendors', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchPublishedVendors()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries vendors table filtered + ordered, returns rows', async () => {
    const rows = [
      {
        id: 'v-1', brand_slug: 'acme-pet', brand_name: 'Acme Pet',
        contact_email: 'hi@acme.test', website_url: 'https://acme.test',
        parent_company: null, headquarters_country: 'US', is_published: true,
      },
    ];
    const chain = mockChain({ data: rows, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchPublishedVendors();

    expect(supabase.from).toHaveBeenCalledWith('vendors');
    expect(chain.eq).toHaveBeenCalledWith('is_published', true);
    expect(chain.order).toHaveBeenCalledWith('brand_name', { ascending: true });
    expect(result).toEqual(rows);
  });

  test('returns [] on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchPublishedVendors()).resolves.toEqual([]);
  });
});

// ─── fetchVendorBySlug ──────────────────────────────────

describe('fetchVendorBySlug', () => {
  test('returns null when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchVendorBySlug('acme-pet')).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns single row when found', async () => {
    const row = {
      id: 'v-1', brand_slug: 'acme-pet', brand_name: 'Acme Pet',
      contact_email: 'hi@acme.test', website_url: 'https://acme.test',
      parent_company: null, headquarters_country: 'US', is_published: true,
    };
    const chain = mockChain({ data: row, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchVendorBySlug('acme-pet');

    expect(supabase.from).toHaveBeenCalledWith('vendors');
    expect(chain.eq).toHaveBeenCalledWith('brand_slug', 'acme-pet');
    expect(result).toEqual(row);
  });

  test('returns null when no row matches', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchVendorBySlug('nope')).resolves.toBeNull();
  });

  test('returns null on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchVendorBySlug('acme-pet')).resolves.toBeNull();
  });
});
