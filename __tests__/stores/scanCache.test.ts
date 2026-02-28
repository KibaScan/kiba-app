// Kiba — Scan Cache Tests
// Covers: add, dedup, cap at 10, most-recent-first ordering

import { useScanStore } from '../../src/stores/useScanStore';
import { Product, Category, Species, PreservativeType } from '../../src/types';

// ─── Helpers ───────────────────────────────────────────

function makeProduct(id: string): Product {
  return {
    id,
    brand: 'TestBrand',
    name: `Product ${id}`,
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
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
    is_recalled: false,
    is_grain_free: false,
    score_confidence: 'full',
    needs_review: false,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ─── Tests ─────────────────────────────────────────────

describe('scanCache', () => {
  beforeEach(() => {
    useScanStore.setState({ scanCache: [] });
  });

  it('adds a product to the cache', () => {
    const p = makeProduct('p1');
    useScanStore.getState().addToScanCache(p);

    const { scanCache } = useScanStore.getState();
    expect(scanCache).toHaveLength(1);
    expect(scanCache[0].id).toBe('p1');
  });

  it('deduplicates — same product added twice appears once at position 0', () => {
    const p1 = makeProduct('p1');
    const p2 = makeProduct('p2');

    useScanStore.getState().addToScanCache(p1);
    useScanStore.getState().addToScanCache(p2);
    useScanStore.getState().addToScanCache(p1);

    const { scanCache } = useScanStore.getState();
    expect(scanCache).toHaveLength(2);
    expect(scanCache[0].id).toBe('p1');
    expect(scanCache[1].id).toBe('p2');
  });

  it('caps at 10 entries — oldest dropped when 11th added', () => {
    for (let i = 1; i <= 11; i++) {
      useScanStore.getState().addToScanCache(makeProduct(`p${i}`));
    }

    const { scanCache } = useScanStore.getState();
    expect(scanCache).toHaveLength(10);
    // First added (p1) should be gone
    expect(scanCache.find((p) => p.id === 'p1')).toBeUndefined();
    // Most recent (p11) at front
    expect(scanCache[0].id).toBe('p11');
  });

  it('orders most-recent-first (index 0 = last added)', () => {
    useScanStore.getState().addToScanCache(makeProduct('a'));
    useScanStore.getState().addToScanCache(makeProduct('b'));
    useScanStore.getState().addToScanCache(makeProduct('c'));

    const { scanCache } = useScanStore.getState();
    expect(scanCache.map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});
