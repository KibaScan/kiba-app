// Kiba — Scanner Service Tests
// Covers: happy path, not_found, orphaned UPC, DB errors, network timeout

import { lookupByUpc } from '../../src/services/scanner';

// ─── Mocks ─────────────────────────────────────────────

// Chain builder for Supabase query mocking
interface MockQueryResult {
  data: unknown;
  error: { message: string } | null;
}

let upcQueryResult: MockQueryResult | null = null;
let productQueryResult: MockQueryResult | null = null;
let upcQueryPromise: Promise<MockQueryResult> | null = null;
let productQueryPromise: Promise<MockQueryResult> | null = null;

const mockMaybeSingle = jest.fn(() =>
  upcQueryPromise ?? Promise.resolve(upcQueryResult!),
);
const mockSingle = jest.fn(() =>
  productQueryPromise ?? Promise.resolve(productQueryResult!),
);

const mockUpcEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockProductEq = jest.fn(() => ({ single: mockSingle }));

const mockUpcSelect = jest.fn(() => ({ eq: mockUpcEq }));
const mockProductSelect = jest.fn(() => ({ eq: mockProductEq }));

const mockFrom = jest.fn((table: string) => {
  if (table === 'product_upcs') {
    return { select: mockUpcSelect };
  }
  return { select: mockProductSelect };
});

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...(args as [string])) },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

// ─── Helpers ───────────────────────────────────────────

const MOCK_PRODUCT = {
  id: 'prod-001',
  brand: 'TestBrand',
  name: 'TestFood',
  category: 'daily_food',
  target_species: 'dog',
};

function resetMocks() {
  upcQueryResult = null;
  productQueryResult = null;
  upcQueryPromise = null;
  productQueryPromise = null;
  jest.clearAllMocks();
}

// ─── Tests ─────────────────────────────────────────────

describe('lookupByUpc', () => {
  beforeEach(resetMocks);

  it('returns found with product on happy path', async () => {
    upcQueryResult = { data: { product_id: 'prod-001' }, error: null };
    productQueryResult = { data: MOCK_PRODUCT, error: null };

    const result = await lookupByUpc('012345678901');

    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.product.id).toBe('prod-001');
    }
    expect(mockFrom).toHaveBeenCalledWith('product_upcs');
    expect(mockFrom).toHaveBeenCalledWith('products');
  });

  it('returns not_found when UPC is not in database', async () => {
    upcQueryResult = { data: null, error: null };

    const result = await lookupByUpc('000000000000');

    expect(result.status).toBe('not_found');
    expect(mockFrom).toHaveBeenCalledWith('product_upcs');
    expect(mockFrom).not.toHaveBeenCalledWith('products');
  });

  it('returns not_found and warns on orphaned UPC', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    upcQueryResult = { data: { product_id: 'prod-orphan' }, error: null };
    productQueryResult = { data: null, error: null };

    const result = await lookupByUpc('111111111111');

    expect(result.status).toBe('not_found');
    expect(warnSpy).toHaveBeenCalledWith('Orphaned UPC detected: 111111111111');

    warnSpy.mockRestore();
  });

  it('returns DB_ERROR on product_upcs query error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    upcQueryResult = { data: null, error: { message: 'relation not found' } };

    const result = await lookupByUpc('222222222222');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('DB_ERROR');
      expect(result.message).toBe('relation not found');
    }
    expect(errorSpy).toHaveBeenCalledWith(
      'Scanner DB error:',
      expect.objectContaining({ upc: '222222222222', table: 'product_upcs' }),
    );

    errorSpy.mockRestore();
  });

  it('returns DB_ERROR on products query error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    upcQueryResult = { data: { product_id: 'prod-001' }, error: null };
    productQueryResult = { data: null, error: { message: 'permission denied' } };

    const result = await lookupByUpc('333333333333');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('DB_ERROR');
      expect(result.message).toBe('permission denied');
    }
    expect(errorSpy).toHaveBeenCalledWith(
      'Scanner DB error:',
      expect.objectContaining({ upc: '333333333333', table: 'products' }),
    );

    errorSpy.mockRestore();
  });

  it('returns NETWORK_TIMEOUT when query never resolves', async () => {
    // Promise that never resolves — timeout will fire first
    upcQueryPromise = new Promise<MockQueryResult>(() => {});

    const result = await lookupByUpc('444444444444');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('NETWORK_TIMEOUT');
      expect(result.message).toBe('Request timed out');
    }
  }, 10000);
});
