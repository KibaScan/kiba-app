// Kiba — affiliateService tests
// Verifies link generation, score gating compliance, and D-020 isolation.

import { getAffiliateLinks, hasAffiliateLinks, getFirstAffiliateLink } from '../../src/services/affiliateService';
import type { Product } from '../../src/types';

// ─── Test Helpers ────────────────────────────────────────

/** Minimal Product with affiliate-relevant fields. */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product-1',
    brand: 'TestBrand',
    name: 'Test Dog Food',
    category: 'daily_food' as any,
    target_species: 'dog' as any,
    source: 'scraped' as any,
    aafco_statement: null,
    life_stage_claim: null,
    preservative_type: null,
    ga_protein_pct: null,
    ga_fat_pct: null,
    ga_fiber_pct: null,
    ga_moisture_pct: null,
    ga_calcium_pct: null,
    ga_phosphorus_pct: null,
    ga_kcal_per_cup: null,
    ga_kcal_per_kg: null,
    kcal_per_unit: null,
    unit_weight_g: null,
    default_serving_format: null,
    ga_taurine_pct: null,
    ga_l_carnitine_mg: null,
    ga_dha_pct: null,
    ga_omega3_pct: null,
    ga_omega6_pct: null,
    ga_zinc_mg_kg: null,
    ga_probiotics_cfu: null,
    nutritional_data_source: null,
    ingredients_raw: null,
    ingredients_hash: null,
    image_url: null,
    product_form: null,
    is_recalled: false,
    is_grain_free: false,
    is_supplemental: false,
    is_vet_diet: false,
    score_confidence: 'high',
    needs_review: false,
    base_score: null,
    base_score_computed_at: null,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    source_url: null,
    chewy_sku: null,
    asin: null,
    walmart_id: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Mock Config ────────────────────────────────────────

// We need to mock the config to test enabled/disabled states
jest.mock('../../src/config/affiliateConfig', () => ({
  AFFILIATE_CONFIG: {
    chewy: {
      tag: 'test-chewy-tag',
      baseUrl: 'https://www.chewy.com',
      enabled: true,
    },
    amazon: {
      tag: 'test-amazon-tag',
      baseUrl: 'https://www.amazon.com',
      enabled: true,
    },
  },
}));

// ─── D-020 Isolation Verification ────────────────────────

describe('D-020: Affiliate isolation from scoring', () => {
  it('affiliateService.ts does not import any scoring modules', () => {
    // Read the source file and verify no scoring imports
    const fs = require('fs');
    const source = fs.readFileSync(
      require.resolve('../../src/services/affiliateService'),
      'utf-8',
    );
    expect(source).not.toContain("from '../services/scoring");
    expect(source).not.toContain("from './scoring");
    expect(source).not.toContain('scoreProduct');
    expect(source).not.toContain('computeScore');
    expect(source).not.toContain("from '../services/scoring/engine");
    expect(source).not.toContain("from './scoring/engine");
  });
});

// ─── Link Generation ────────────────────────────────────

describe('getAffiliateLinks', () => {
  it('returns empty array when product has no retailer data', () => {
    const product = makeProduct();
    const links = getAffiliateLinks(product);
    expect(links).toEqual([]);
  });

  it('generates Chewy link from source_url', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/firstmate-grain-friendly/dp/123456',
    });
    const links = getAffiliateLinks(product);
    expect(links).toHaveLength(1);
    expect(links[0].retailer).toBe('chewy');
    expect(links[0].url).toContain('chewy.com');
    expect(links[0].url).toContain('test-chewy-tag');
    expect(links[0].label).toBe('View on Chewy');
  });

  it('generates Chewy link from chewy_sku when no source_url', () => {
    const product = makeProduct({ chewy_sku: '987654' });
    const links = getAffiliateLinks(product);
    expect(links).toHaveLength(1);
    expect(links[0].retailer).toBe('chewy');
    expect(links[0].url).toContain('/dp/987654');
  });

  it('generates Amazon link from asin', () => {
    const product = makeProduct({ asin: 'B07ABCDEFG' });
    const links = getAffiliateLinks(product);
    expect(links).toHaveLength(1);
    expect(links[0].retailer).toBe('amazon');
    expect(links[0].url).toContain('/dp/B07ABCDEFG');
    expect(links[0].url).toContain('tag=test-amazon-tag');
    expect(links[0].label).toBe('Check Price on Amazon');
  });

  it('generates both links when product has Chewy + Amazon data', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/example/dp/111',
      asin: 'B07XXXXXX',
    });
    const links = getAffiliateLinks(product);
    expect(links).toHaveLength(2);
    expect(links[0].retailer).toBe('chewy');
    expect(links[1].retailer).toBe('amazon');
  });

  it('D-053: Chewy shows estimated price, Amazon does not', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/example/dp/111',
      asin: 'B07XXXXXX',
      price: 45.99,
    });
    const links = getAffiliateLinks(product);
    const chewy = links.find(l => l.retailer === 'chewy')!;
    const amazon = links.find(l => l.retailer === 'amazon')!;

    expect(chewy.estimatedPrice).toBe(45.99);
    expect(chewy.priceLabel).toBe('Est. ~$45.99');

    expect(amazon.estimatedPrice).toBeNull();
    expect(amazon.priceLabel).toBeNull();
  });

  it('Chewy price label is null when no price data', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/example/dp/111',
      price: null,
    });
    const links = getAffiliateLinks(product);
    expect(links[0].priceLabel).toBeNull();
  });

  it('prioritizes affiliate_links JSONB over source_url/sku', () => {
    const product = makeProduct({
      affiliate_links: { chewy: 'https://custom-chewy-link.com/tracked' },
      source_url: 'https://www.chewy.com/generic/dp/999',
    });
    const links = getAffiliateLinks(product);
    expect(links[0].url).toBe('https://custom-chewy-link.com/tracked');
  });

  it('appends affiliate tag correctly to source_url with existing query params', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/product?color=red',
    });
    const links = getAffiliateLinks(product);
    expect(links[0].url).toContain('&utm_source=partner');
  });

  it('appends affiliate tag correctly to source_url without query params', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/product',
    });
    const links = getAffiliateLinks(product);
    expect(links[0].url).toContain('?utm_source=partner');
  });
});

// ─── Availability Check ─────────────────────────────────

describe('hasAffiliateLinks', () => {
  it('returns true when product has source_url', () => {
    expect(hasAffiliateLinks(makeProduct({
      source_url: 'https://www.chewy.com/test',
    }))).toBe(true);
  });

  it('returns true when product has asin', () => {
    expect(hasAffiliateLinks(makeProduct({ asin: 'B07XXX' }))).toBe(true);
  });

  it('returns false when product has no retailer data', () => {
    expect(hasAffiliateLinks(makeProduct())).toBe(false);
  });

  it('returns true when product has curated affiliate_links', () => {
    expect(hasAffiliateLinks(makeProduct({
      affiliate_links: { amazon: 'https://amazon.com/tracked' },
    }))).toBe(true);
  });
});

// ─── First Link ─────────────────────────────────────────

describe('getFirstAffiliateLink', () => {
  it('returns Chewy link when both available (Chewy preferred)', () => {
    const product = makeProduct({
      source_url: 'https://www.chewy.com/test',
      asin: 'B07XXXXXX',
    });
    const first = getFirstAffiliateLink(product);
    expect(first).not.toBeNull();
    expect(first!.retailer).toBe('chewy');
  });

  it('returns Amazon when only Amazon available', () => {
    const first = getFirstAffiliateLink(makeProduct({ asin: 'B07XXX' }));
    expect(first).not.toBeNull();
    expect(first!.retailer).toBe('amazon');
  });

  it('returns null when no affiliate data', () => {
    expect(getFirstAffiliateLink(makeProduct())).toBeNull();
  });
});
