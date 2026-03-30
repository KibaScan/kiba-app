// Safe Swap Service Tests — condition hard filters, swap reason generation,
// DMB helpers, DCM pulse detection.

import {
  applyConditionHardFilters,
  generateSwapReason,
  dcmPulsePatternFires,
  assignCuratedSlots,
  intersectCandidatePools,
  toDMB,
  inferMoisture,
} from '../../src/services/safeSwapService';

import type {
  CandidateRow,
  PulseIngredient,
} from '../../src/services/safeSwapService';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Test Helpers ───────────────────────────────────────

function makeCandidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    product_id: 'prod-1',
    final_score: 85,
    product_name: 'Test Product',
    brand: 'Test Brand',
    image_url: null,
    product_form: 'dry',
    category: 'daily_food',
    is_supplemental: false,
    ga_fat_pct: 8,       // 8% as-fed → ~8.89% DMB (dry, 10% moisture)
    ga_protein_pct: 25,
    ga_fiber_pct: 4,
    ga_phosphorus_pct: 0.8,
    ga_moisture_pct: 10,
    ga_kcal_per_kg: 3500,
    name: 'Test Product',
    price: null,
    product_size_kg: null,
    life_stage_claim: null,
    ...overrides,
  };
}

// ─── toDMB ──────────────────────────────────────────────

describe('toDMB', () => {
  it('converts as-fed to dry matter basis', () => {
    // 8% fat at 10% moisture → 8 / (100-10) * 100 = 8.89%
    expect(toDMB(8, 10)).toBeCloseTo(8.89, 1);
  });

  it('handles wet food moisture', () => {
    // 5% fat at 78% moisture → 5 / (100-78) * 100 = 22.73%
    expect(toDMB(5, 78)).toBeCloseTo(22.73, 1);
  });
});

// ─── inferMoisture ──────────────────────────────────────

describe('inferMoisture', () => {
  it('returns GA moisture when available', () => {
    expect(inferMoisture('dry', 12)).toBe(12);
  });

  it('defaults dry to 10%', () => {
    expect(inferMoisture('dry', null)).toBe(10);
  });

  it('defaults wet to 78%', () => {
    expect(inferMoisture('wet', null)).toBe(78);
  });

  it('defaults unknown form to 10%', () => {
    expect(inferMoisture(null, null)).toBe(10);
  });
});

// ─── applyConditionHardFilters ──────────────────────────

describe('applyConditionHardFilters', () => {
  // ── No conditions ─────────────────────────────────────

  it('passes all through when no conditions', () => {
    const candidates = [makeCandidate(), makeCandidate({ product_id: 'prod-2' })];
    const result = applyConditionHardFilters(candidates, [], 'dog');
    expect(result).toHaveLength(2);
  });

  // ── Pancreatitis (dog only) ───────────────────────────

  it('pancreatitis dog: excludes fat DMB > 15%', () => {
    const candidates = [
      makeCandidate({ product_id: 'high-fat', ga_fat_pct: 16, ga_moisture_pct: 10 }),
      // 16 / 90 * 100 = 17.78% DMB → excluded
      makeCandidate({ product_id: 'low-fat', ga_fat_pct: 8, ga_moisture_pct: 10 }),
      // 8 / 90 * 100 = 8.89% DMB → kept
    ];
    const result = applyConditionHardFilters(candidates, ['pancreatitis'], 'dog');
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('low-fat');
  });

  it('pancreatitis dog: keeps at exactly 15% DMB (> not >=)', () => {
    // 13.5% as-fed at 10% moisture → 13.5/90*100 = 15.0% DMB
    const candidates = [makeCandidate({ ga_fat_pct: 13.5, ga_moisture_pct: 10 })];
    const result = applyConditionHardFilters(candidates, ['pancreatitis'], 'dog');
    expect(result).toHaveLength(1);
  });

  it('pancreatitis cat: does NOT apply fat filter', () => {
    const candidates = [
      makeCandidate({ ga_fat_pct: 20, ga_moisture_pct: 10 }),
      // 22.22% DMB fat — would be excluded for dogs, kept for cats
    ];
    const result = applyConditionHardFilters(candidates, ['pancreatitis'], 'cat');
    expect(result).toHaveLength(1);
  });

  // ── CKD ───────────────────────────────────────────────

  it('ckd cat: excludes phosphorus DMB > 1.2%', () => {
    const candidates = [
      makeCandidate({ product_id: 'high-p', ga_phosphorus_pct: 1.5, ga_moisture_pct: 10 }),
      // 1.5/90*100 = 1.67% DMB → excluded
      makeCandidate({ product_id: 'low-p', ga_phosphorus_pct: 0.8, ga_moisture_pct: 10 }),
      // 0.8/90*100 = 0.89% DMB → kept
    ];
    const result = applyConditionHardFilters(candidates, ['ckd'], 'cat');
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('low-p');
  });

  it('ckd dog: uses higher threshold (1.5% DMB)', () => {
    const candidates = [
      makeCandidate({ product_id: 'mid-p', ga_phosphorus_pct: 1.2, ga_moisture_pct: 10 }),
      // 1.2/90*100 = 1.33% DMB → under 1.5 → kept for dogs
    ];
    const result = applyConditionHardFilters(candidates, ['ckd'], 'dog');
    expect(result).toHaveLength(1);
  });

  // ── Diabetes (cat only) ───────────────────────────────

  it('diabetes cat: excludes carb DMB > 25%', () => {
    // Carb = 100 - protein_dmb - fat_dmb - fiber_dmb - 7 (ash)
    // protein=20/90*100=22.2, fat=5/90*100=5.56, fiber=2/90*100=2.22
    // carb = 100 - 22.2 - 5.56 - 2.22 - 7 = 63.02% → excluded
    const candidates = [
      makeCandidate({
        product_id: 'high-carb',
        ga_protein_pct: 20,
        ga_fat_pct: 5,
        ga_fiber_pct: 2,
        ga_moisture_pct: 10,
      }),
    ];
    const result = applyConditionHardFilters(candidates, ['diabetes'], 'cat');
    expect(result).toHaveLength(0);
  });

  it('diabetes cat: keeps low-carb wet food', () => {
    // Wet food: protein=12/22*100=54.5, fat=8/22*100=36.4, fiber=1/22*100=4.5
    // carb = 100 - 54.5 - 36.4 - 4.5 - 7 = 0 (clamped) → kept
    const candidates = [
      makeCandidate({
        product_form: 'wet',
        ga_protein_pct: 12,
        ga_fat_pct: 8,
        ga_fiber_pct: 1,
        ga_moisture_pct: 78,
      }),
    ];
    const result = applyConditionHardFilters(candidates, ['diabetes'], 'cat');
    expect(result).toHaveLength(1);
  });

  it('diabetes dog: no carb filter applied', () => {
    // Same high-carb product, but dog diabetes is fiber-based, no carb hard filter
    const candidates = [
      makeCandidate({
        ga_protein_pct: 20,
        ga_fat_pct: 5,
        ga_fiber_pct: 2,
        ga_moisture_pct: 10,
      }),
    ];
    const result = applyConditionHardFilters(candidates, ['diabetes'], 'dog');
    expect(result).toHaveLength(1);
  });

  // ── Obesity ───────────────────────────────────────────

  it('obesity: excludes high kcal dry food (> 4500 DMB)', () => {
    // 4200 kcal/kg at 10% moisture → 4200 / 0.9 = 4667 DMB → excluded
    const candidates = [
      makeCandidate({ product_id: 'dense', ga_kcal_per_kg: 4200, product_form: 'dry', ga_moisture_pct: 10 }),
    ];
    const result = applyConditionHardFilters(candidates, ['obesity'], 'dog');
    expect(result).toHaveLength(0);
  });

  it('obesity: excludes high kcal wet food (> 1400 DMB)', () => {
    // 350 kcal/kg at 78% moisture → 350 / 0.22 = 1591 DMB → excluded
    const candidates = [
      makeCandidate({ product_id: 'dense-wet', ga_kcal_per_kg: 350, product_form: 'wet', ga_moisture_pct: 78 }),
    ];
    const result = applyConditionHardFilters(candidates, ['obesity'], 'dog');
    expect(result).toHaveLength(0);
  });

  it('obesity: keeps moderate kcal dry food', () => {
    // 3500 kcal/kg at 10% moisture → 3500 / 0.9 = 3889 DMB → under 4500 → kept
    const candidates = [makeCandidate({ ga_kcal_per_kg: 3500, product_form: 'dry', ga_moisture_pct: 10 })];
    const result = applyConditionHardFilters(candidates, ['obesity'], 'dog');
    expect(result).toHaveLength(1);
  });

  // ── Underweight ───────────────────────────────────────

  it('underweight: excludes "lite" in name', () => {
    const candidates = [makeCandidate({ name: 'Chicken Lite Recipe' })];
    const result = applyConditionHardFilters(candidates, ['underweight'], 'dog');
    expect(result).toHaveLength(0);
  });

  it('underweight: excludes "weight management" in name', () => {
    const candidates = [makeCandidate({ name: 'Healthy Weight Management Formula' })];
    const result = applyConditionHardFilters(candidates, ['underweight'], 'dog');
    expect(result).toHaveLength(0);
  });

  it('underweight: excludes "light" in name', () => {
    const candidates = [makeCandidate({ name: 'Turkey Light Dinner' })];
    const result = applyConditionHardFilters(candidates, ['underweight'], 'cat');
    expect(result).toHaveLength(0);
  });

  it('underweight: keeps normal product names', () => {
    const candidates = [makeCandidate({ name: 'Chicken & Rice Recipe' })];
    const result = applyConditionHardFilters(candidates, ['underweight'], 'dog');
    expect(result).toHaveLength(1);
  });

  // ── Missing GA data ───────────────────────────────────

  it('missing GA data: does NOT exclude (cannot confirm violation)', () => {
    const candidates = [
      makeCandidate({
        ga_fat_pct: null,
        ga_phosphorus_pct: null,
        ga_protein_pct: null,
        ga_fiber_pct: null,
        ga_kcal_per_kg: null,
      }),
    ];
    // All conditions active — but all GA null, so nothing can be confirmed
    const result = applyConditionHardFilters(
      candidates,
      ['pancreatitis', 'ckd', 'diabetes', 'obesity'],
      'dog',
    );
    expect(result).toHaveLength(1);
  });

  // ── Multiple conditions ───────────────────────────────

  it('multiple conditions: intersects all filters', () => {
    const candidates = [
      // High fat (pancreatitis) AND high phosphorus (ckd) → excluded by both
      makeCandidate({ product_id: 'bad', ga_fat_pct: 16, ga_phosphorus_pct: 1.5, ga_moisture_pct: 10 }),
      // Low fat, low phosphorus → passes both
      makeCandidate({ product_id: 'good', ga_fat_pct: 6, ga_phosphorus_pct: 0.5, ga_moisture_pct: 10 }),
      // Low fat but high phosphorus → excluded by ckd
      makeCandidate({ product_id: 'mid', ga_fat_pct: 6, ga_phosphorus_pct: 1.5, ga_moisture_pct: 10 }),
    ];
    const result = applyConditionHardFilters(candidates, ['pancreatitis', 'ckd'], 'dog');
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('good');
  });

  // ── Conditions with no hard filter ────────────────────

  it('conditions without hard filters pass all through', () => {
    const candidates = [makeCandidate(), makeCandidate({ product_id: 'prod-2' })];
    const result = applyConditionHardFilters(
      candidates,
      ['gi_sensitive', 'urinary', 'joint', 'skin', 'hypothyroid'],
      'dog',
    );
    expect(result).toHaveLength(2);
  });
});

// ─── dcmPulsePatternFires ───────────────────────────────

describe('dcmPulsePatternFires', () => {
  it('fires on heavyweight pulse (position <= 3)', () => {
    const ingredients: PulseIngredient[] = [
      { position: 2, is_pulse: true, is_pulse_protein: false },
      { position: 5, is_pulse: false, is_pulse_protein: false },
    ];
    expect(dcmPulsePatternFires(ingredients)).toBe(true);
  });

  it('fires on density (2+ pulses in top 10)', () => {
    const ingredients: PulseIngredient[] = [
      { position: 5, is_pulse: true, is_pulse_protein: false },
      { position: 8, is_pulse: true, is_pulse_protein: false },
    ];
    expect(dcmPulsePatternFires(ingredients)).toBe(true);
  });

  it('fires on pulse protein substitution in top 10', () => {
    const ingredients: PulseIngredient[] = [
      { position: 7, is_pulse: true, is_pulse_protein: true },
    ];
    expect(dcmPulsePatternFires(ingredients)).toBe(true);
  });

  it('does not fire on single non-heavyweight pulse', () => {
    const ingredients: PulseIngredient[] = [
      { position: 6, is_pulse: true, is_pulse_protein: false },
    ];
    expect(dcmPulsePatternFires(ingredients)).toBe(false);
  });

  it('does not fire on empty ingredients', () => {
    expect(dcmPulsePatternFires([])).toBe(false);
  });

  it('does not fire on non-pulse ingredients only', () => {
    const ingredients: PulseIngredient[] = [
      { position: 1, is_pulse: false, is_pulse_protein: false },
      { position: 2, is_pulse: false, is_pulse_protein: false },
    ];
    expect(dcmPulsePatternFires(ingredients)).toBe(false);
  });
});

// ─── generateSwapReason ─────────────────────────────────

describe('generateSwapReason', () => {
  const candidate = makeCandidate();

  it('pancreatitis dog: returns fat reason', () => {
    expect(generateSwapReason(candidate, ['pancreatitis'], [], 'dog'))
      .toBe('Lower fat content');
  });

  it('pancreatitis cat: no reason (cat pancreatitis has no dog-specific reason)', () => {
    // Falls through to generic since pancreatitis only has dog reason
    expect(generateSwapReason(candidate, ['pancreatitis'], [], 'cat'))
      .toBe('Higher overall match');
  });

  it('ckd: returns phosphorus reason', () => {
    expect(generateSwapReason(candidate, ['ckd'], [], 'dog'))
      .toBe('Lower phosphorus content');
  });

  it('diabetes cat: returns carb reason', () => {
    expect(generateSwapReason(candidate, ['diabetes'], [], 'cat'))
      .toBe('Lower carbohydrate content');
  });

  it('obesity: returns calorie density reason', () => {
    expect(generateSwapReason(candidate, ['obesity'], [], 'dog'))
      .toBe('Lower calorie density');
  });

  it('allergen-free when no conditions', () => {
    expect(generateSwapReason(candidate, [], ['chicken'], 'dog'))
      .toBe('Free from chicken ingredients');
  });

  it('generic fallback when no conditions or allergens', () => {
    expect(generateSwapReason(candidate, [], [], 'dog'))
      .toBe('Higher overall match');
  });

  it('multiple conditions: picks highest priority (safety-critical first)', () => {
    // pancreatitis is higher priority than obesity
    expect(generateSwapReason(candidate, ['obesity', 'pancreatitis'], [], 'dog'))
      .toBe('Lower fat content');
  });

  it('condition takes priority over allergen', () => {
    expect(generateSwapReason(candidate, ['ckd'], ['chicken'], 'dog'))
      .toBe('Lower phosphorus content');
  });

  it('D-095 compliance: no prohibited terms', () => {
    const prohibited = ['prescribe', 'treat', 'cure', 'prevent', 'diagnose'];
    const allConditions = [
      'pancreatitis', 'ckd', 'diabetes', 'cardiac', 'obesity',
      'underweight', 'gi_sensitive', 'urinary', 'joint', 'skin',
    ];
    for (const condition of allConditions) {
      for (const species of ['dog', 'cat'] as const) {
        const reason = generateSwapReason(candidate, [condition], [], species);
        for (const term of prohibited) {
          expect(reason.toLowerCase()).not.toContain(term);
        }
      }
    }
  });
});

// ─── assignCuratedSlots ────────────────────────────────

describe('assignCuratedSlots', () => {
  // Candidates sorted by score DESC (as they would be from the DB query)
  const candidates: CandidateRow[] = [
    makeCandidate({ product_id: 'top-score', final_score: 95 }),
    makeCandidate({ product_id: 'fish-product', final_score: 90 }),
    makeCandidate({ product_id: 'value-product', final_score: 85, price: 25, product_size_kg: 5 }), // $5/kg
    makeCandidate({ product_id: 'another', final_score: 80 }),
    makeCandidate({ product_id: 'cheap', final_score: 78, price: 10, product_size_kg: 5 }), // $2/kg
  ];

  const fishIds = new Set(['fish-product']);
  const noFish = new Set<string>();

  it('Top Pick = highest score candidate', () => {
    const result = assignCuratedSlots(candidates, fishIds, false, [], [], 'dog');
    expect(result).not.toBeNull();
    expect(result![0].slot_label).toBe('Top Pick');
    expect(result![0].product_id).toBe('top-score');
  });

  it('Fish-Based = highest score fish candidate (no fish allergy)', () => {
    const result = assignCuratedSlots(candidates, fishIds, false, [], [], 'dog');
    expect(result).not.toBeNull();
    const fishSlot = result!.find(c => c.slot_label === 'Fish-Based');
    expect(fishSlot).toBeDefined();
    expect(fishSlot!.product_id).toBe('fish-product');
    expect(fishSlot!.is_fish_based).toBe(true);
  });

  it('pet has fish allergy → slot 2 becomes Another Pick', () => {
    const result = assignCuratedSlots(candidates, fishIds, true, [], ['fish'], 'dog');
    expect(result).not.toBeNull();
    const slot2 = result!.find(c => c.slot_label === 'Another Pick');
    expect(slot2).toBeDefined();
    expect(slot2!.product_id).toBe('fish-product'); // 2nd highest score
    // No Fish-Based slot
    expect(result!.find(c => c.slot_label === 'Fish-Based')).toBeUndefined();
  });

  it('Great Value = lowest price_per_kg (excluding already-selected)', () => {
    const result = assignCuratedSlots(candidates, fishIds, false, [], [], 'dog');
    expect(result).not.toBeNull();
    const valueSlot = result!.find(c => c.slot_label === 'Great Value');
    expect(valueSlot).toBeDefined();
    expect(valueSlot!.product_id).toBe('cheap'); // $2/kg is cheapest
    expect(valueSlot!.price_per_kg).toBeCloseTo(2, 1);
  });

  it('no fish candidates + no fish allergy → 2 slots (Top Pick + Great Value)', () => {
    const result = assignCuratedSlots(candidates, noFish, false, [], [], 'dog');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].slot_label).toBe('Top Pick');
    expect(result![1].slot_label).toBe('Great Value');
  });

  it('no price data → 3 slots (Top Pick + Fish-Based + Another Pick fallback)', () => {
    const noPriceCandidates = candidates.map(c => ({ ...c, price: null, product_size_kg: null }));
    const result = assignCuratedSlots(noPriceCandidates, fishIds, false, [], [], 'dog');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0].slot_label).toBe('Top Pick');
    expect(result![1].slot_label).toBe('Fish-Based');
    expect(result![2].slot_label).toBe('Another Pick');
  });

  it('neither fish nor price + no fish allergy → 2 slots (Top Pick + Another Pick)', () => {
    const noPriceCandidates = candidates.map(c => ({ ...c, price: null, product_size_kg: null }));
    const result = assignCuratedSlots(noPriceCandidates, noFish, false, [], [], 'dog');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].slot_label).toBe('Top Pick');
    expect(result![1].slot_label).toBe('Another Pick');
  });

  it('fish allergy + no price data → 3 slots (Top Pick + Another Pick + Another Pick)', () => {
    const noPriceCandidates = candidates.map(c => ({ ...c, price: null, product_size_kg: null }));
    const result = assignCuratedSlots(noPriceCandidates, fishIds, true, [], ['fish'], 'dog');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0].slot_label).toBe('Top Pick');
    expect(result![1].slot_label).toBe('Another Pick');
    expect(result![2].slot_label).toBe('Another Pick');
  });

  it('Great Value cannot be same product as Top Pick or Fish-Based', () => {
    // Make the cheapest product also be the top score and fish-based
    const tricky: CandidateRow[] = [
      makeCandidate({ product_id: 'top-fish-cheap', final_score: 95, price: 5, product_size_kg: 5 }),
      makeCandidate({ product_id: 'second', final_score: 88, price: 20, product_size_kg: 5 }),
      makeCandidate({ product_id: 'third', final_score: 82, price: 15, product_size_kg: 5 }),
    ];
    const trickyFish = new Set(['top-fish-cheap']);
    const result = assignCuratedSlots(tricky, trickyFish, false, [], [], 'dog');
    expect(result).not.toBeNull();
    // Top Pick and Fish-Based are the same product? No — Top Pick takes it first,
    // then Fish-Based is the same product but already selected, so no Fish-Based slot.
    // Actually: Top Pick = top-fish-cheap, Fish-Based looks for fish not already selected = none.
    // So we get Top Pick + Great Value (second cheapest that's not selected)
    expect(result).toHaveLength(2);
    expect(result![0].product_id).toBe('top-fish-cheap');
    expect(result![1].slot_label).toBe('Great Value');
    expect(result![1].product_id).toBe('third'); // $3/kg is cheaper than $4/kg
  });

  it('all 3 slots filled → returns 3 candidates with correct labels', () => {
    const result = assignCuratedSlots(candidates, fishIds, false, [], [], 'dog');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    const labels = result!.map(c => c.slot_label);
    expect(labels).toContain('Top Pick');
    expect(labels).toContain('Fish-Based');
    expect(labels).toContain('Great Value');
  });

  it('each candidate has a reason from generateSwapReason', () => {
    const result = assignCuratedSlots(candidates, fishIds, false, ['obesity'], [], 'dog');
    expect(result).not.toBeNull();
    for (const c of result!) {
      expect(c.reason).toBe('Lower calorie density');
    }
  });

  it('empty candidates returns null', () => {
    const result = assignCuratedSlots([], fishIds, false, [], [], 'dog');
    expect(result).toBeNull();
  });
});

// ─── intersectCandidatePools ───────────────────────────

describe('intersectCandidatePools', () => {
  it('two pools, full overlap → uses floor scores', () => {
    const pool1 = [
      makeCandidate({ product_id: 'A', final_score: 90 }),
      makeCandidate({ product_id: 'B', final_score: 85 }),
    ];
    const pool2 = [
      makeCandidate({ product_id: 'A', final_score: 80 }),
      makeCandidate({ product_id: 'B', final_score: 92 }),
    ];
    const result = intersectCandidatePools([pool1, pool2]);
    expect(result).toHaveLength(2);
    // A: floor = min(90,80) = 80, B: floor = min(85,92) = 85
    // Sorted DESC by floor: B(85), A(80)
    expect(result[0].product_id).toBe('B');
    expect(result[0].final_score).toBe(85);
    expect(result[1].product_id).toBe('A');
    expect(result[1].final_score).toBe(80);
  });

  it('two pools, partial overlap → only intersected products', () => {
    const pool1 = [
      makeCandidate({ product_id: 'A', final_score: 90 }),
      makeCandidate({ product_id: 'B', final_score: 85 }),
    ];
    const pool2 = [
      makeCandidate({ product_id: 'B', final_score: 88 }),
      makeCandidate({ product_id: 'C', final_score: 95 }),
    ];
    const result = intersectCandidatePools([pool1, pool2]);
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('B');
    expect(result[0].final_score).toBe(85); // floor
  });

  it('three pools, one has no overlap → empty result', () => {
    const pool1 = [makeCandidate({ product_id: 'A', final_score: 90 })];
    const pool2 = [makeCandidate({ product_id: 'A', final_score: 85 })];
    const pool3 = [makeCandidate({ product_id: 'X', final_score: 95 })];
    const result = intersectCandidatePools([pool1, pool2, pool3]);
    expect(result).toHaveLength(0);
  });

  it('single pool → pass-through unchanged', () => {
    const pool = [
      makeCandidate({ product_id: 'A', final_score: 90 }),
      makeCandidate({ product_id: 'B', final_score: 85 }),
    ];
    const result = intersectCandidatePools([pool]);
    expect(result).toHaveLength(2);
    expect(result[0].product_id).toBe('A');
    expect(result[0].final_score).toBe(90);
  });

  it('empty pools array → empty result', () => {
    expect(intersectCandidatePools([])).toHaveLength(0);
  });

  it('floor score with 3 pools: 90/85/92 → 85', () => {
    const pool1 = [makeCandidate({ product_id: 'X', final_score: 90 })];
    const pool2 = [makeCandidate({ product_id: 'X', final_score: 85 })];
    const pool3 = [makeCandidate({ product_id: 'X', final_score: 92 })];
    const result = intersectCandidatePools([pool1, pool2, pool3]);
    expect(result).toHaveLength(1);
    expect(result[0].final_score).toBe(85);
  });
});
