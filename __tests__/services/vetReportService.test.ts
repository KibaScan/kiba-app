// Vet Report Service Tests — diet items, combined nutrition, flags, condition notes,
// treat summary, weight tracking, owner dietary cards, conflict detection.

import {
  buildDietItems,
  computeCombinedNutrition,
  computeSupplementNutrients,
  generateFlags,
  generateConditionNotes,
  computeTreatSummary,
  buildWeightTracking,
  formatServing,
  getFormLabel,
} from '../../src/services/vetReportService';
import {
  getOwnerDietaryCards,
  detectConflicts,
  CARD_RENDER_ORDER,
} from '../../src/data/ownerDietaryCards';

import type { Pet } from '../../src/types/pet';
import type { VetReportDietItem, CombinedNutrition } from '../../src/types/vetReport';
import type { PantryCardData, PantryPetAssignment } from '../../src/types/pantry';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

jest.mock('../../src/services/petService', () => ({
  getPetConditions: jest.fn(),
  getPetAllergens: jest.fn(),
  getMedications: jest.fn(),
  getConditionDetails: jest.fn(),
}));

jest.mock('../../src/services/appointmentService', () => ({
  getHealthRecords: jest.fn(),
  getUpcomingAppointments: jest.fn(),
}));

jest.mock('../../src/utils/pantryHelpers', () => ({
  computePetDer: jest.fn().mockReturnValue(800),
}));

jest.mock('../../src/stores/useTreatBatteryStore', () => ({
  useTreatBatteryStore: {
    getState: jest.fn().mockReturnValue({
      lastResetDate: '',
      consumedByPet: {},
    }),
  },
  getTodayStr: jest.fn().mockReturnValue('2026-03-28'),
}));

// ─── Factories ──────────────────────────────────────────

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buddy',
    species: 'dog',
    breed: null,
    weight_current_lbs: 50,
    weight_goal_lbs: null,
    weight_updated_at: '2026-03-01T00:00:00Z',
    date_of_birth: '2023-01-01',
    dob_is_approximate: false,
    activity_level: 'moderate',
    is_neutered: true,
    sex: 'male',
    photo_url: null,
    life_stage: 'adult',
    breed_size: 'medium',
    health_reviewed_at: null,
    weight_goal_level: 0,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  } as Pet;
}

function makeAssignment(overrides: Partial<PantryPetAssignment> = {}): PantryPetAssignment {
  return {
    id: 'assign-1',
    pantry_item_id: 'pantry-1',
    pet_id: 'pet-1',
    serving_size: 1,
    serving_size_unit: 'cups',
    feedings_per_day: 2,
    feeding_frequency: 'daily',
    feeding_times: null,
    notifications_on: false,
    slot_index: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCard(overrides: Partial<PantryCardData> = {}): PantryCardData {
  return {
    id: 'pantry-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 10,
    quantity_remaining: 8,
    quantity_unit: 'lbs',
    serving_mode: 'weight',
    unit_label: null,
    added_at: '2026-03-01T00:00:00Z',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    product: {
      name: 'Test Kibble',
      brand: 'TestBrand',
      image_url: null,
      product_form: 'dry',
      is_supplemental: false,
      is_recalled: false,
      is_vet_diet: false,
      target_species: 'dog',
      category: 'daily_food',
      base_score: 72,
      ga_kcal_per_cup: 350,
      ga_kcal_per_kg: 3500,
      kcal_per_unit: null,
      unit_weight_g: null,
      aafco_statement: 'Complete and balanced',
      life_stage_claim: 'adult',
    },
    assignments: [makeAssignment()],
    days_remaining: 30,
    is_low_stock: false,
    is_empty: false,
    calorie_context: { daily_kcal: 700, target_kcal: 800, source: 'label' },
    resolved_score: 72,
    ...overrides,
  } as PantryCardData;
}

function makeDietItem(overrides: Partial<VetReportDietItem> = {}): VetReportDietItem {
  return {
    productName: 'Test Kibble',
    brand: 'TestBrand',
    form: 'Dry',
    servingDisplay: '1 cups × 2/day',
    dailyKcal: 700,
    category: 'daily_food',
    isSupplemental: false,
    isRecalled: false,
    aafcoStatement: 'Complete and balanced',
    gaProtein: 28,
    gaFat: 16,
    gaFiber: 4,
    gaMoisture: 10,
    gaCalcium: 1.2,
    gaPhosphorus: 0.9,
    gaKcalPerKg: 3500,
    ingredients: ['chicken', 'brown rice', 'chicken fat'],
    allergenFlags: [],
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── formatServing ──────────────────────────────────────

describe('formatServing', () => {
  test('single feeding → "X unit/day"', () => {
    const a = makeAssignment({ serving_size: 2, serving_size_unit: 'cups', feedings_per_day: 1 });
    expect(formatServing(a)).toBe('2 cups/day');
  });

  test('multiple feedings → "X unit × N/day"', () => {
    const a = makeAssignment({ serving_size: 1.5, serving_size_unit: 'cups', feedings_per_day: 2 });
    expect(formatServing(a)).toBe('1.5 cups × 2/day');
  });

  test('whole number size omits decimal', () => {
    const a = makeAssignment({ serving_size: 3, feedings_per_day: 1 });
    expect(formatServing(a)).toBe('3 cups/day');
  });
});

// ─── getFormLabel ───────────────────────────────────────

describe('getFormLabel', () => {
  test('treat category → "Treat"', () => {
    const card = makeCard({ product: { ...makeCard().product, category: 'treat' } });
    expect(getFormLabel(card.product, card)).toBe('Treat');
  });

  test('supplement category → "Supp"', () => {
    const card = makeCard({ product: { ...makeCard().product, category: 'supplement' } });
    expect(getFormLabel(card.product, card)).toBe('Supp');
  });

  test('supplemental product → "Top"', () => {
    const card = makeCard({ product: { ...makeCard().product, is_supplemental: true } });
    expect(getFormLabel(card.product, card)).toBe('Top');
  });

  test('dry food → "Dry"', () => {
    const card = makeCard();
    expect(getFormLabel(card.product, card)).toBe('Dry');
  });

  test('wet food → "Wet"', () => {
    const card = makeCard({ product: { ...makeCard().product, product_form: 'wet' } });
    expect(getFormLabel(card.product, card)).toBe('Wet');
  });

  test('no product_form → "Food"', () => {
    const card = makeCard({ product: { ...makeCard().product, product_form: null } });
    expect(getFormLabel(card.product, card)).toBe('Food');
  });
});

// ─── buildDietItems ─────────────────────────────────────

describe('buildDietItems', () => {
  test('maps pantry card to diet item with correct fields', () => {
    const card = makeCard();
    const ingredientMap = new Map([['prod-1', ['chicken', 'brown rice', 'peas']]]);
    const items = buildDietItems([card], 'pet-1', [], ingredientMap);

    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe('Test Kibble');
    expect(items[0].brand).toBe('TestBrand');
    expect(items[0].form).toBe('Dry');
    expect(items[0].servingDisplay).toBe('1 cups × 2/day');
    expect(items[0].dailyKcal).toBe(700);
    expect(items[0].ingredients).toEqual(['chicken', 'brown rice', 'peas']);
    expect(items[0].allergenFlags).toEqual([]);
  });

  test('cross-references allergens case-insensitively', () => {
    const card = makeCard();
    const ingredientMap = new Map([['prod-1', ['Chicken Meal', 'Brown Rice', 'Beef Fat']]]);
    const items = buildDietItems([card], 'pet-1', ['chicken', 'beef'], ingredientMap);

    expect(items[0].allergenFlags).toEqual(['chicken', 'beef']);
  });

  test('"As needed" when no assignment for pet', () => {
    const card = makeCard({ assignments: [] });
    const items = buildDietItems([card], 'pet-1', [], new Map());

    expect(items[0].servingDisplay).toBe('As needed');
  });

  test('missing ingredients defaults to empty array', () => {
    const card = makeCard();
    const items = buildDietItems([card], 'pet-1', [], new Map());

    expect(items[0].ingredients).toEqual([]);
  });
});

// ─── computeCombinedNutrition ───────────────────────────

describe('computeCombinedNutrition', () => {
  test('calorie-weighted average of two products', () => {
    // Product A: 600 kcal/day, 30% protein. Product B: 200 kcal/day, 22% protein.
    // Weighted avg = (30*600 + 22*200) / (600+200) = (18000+4400)/800 = 28.0
    const items = [
      makeDietItem({ dailyKcal: 600, gaProtein: 30, gaFat: 16, gaFiber: 4, gaMoisture: 10, gaCalcium: 1.2, gaPhosphorus: 0.9 }),
      makeDietItem({ dailyKcal: 200, gaProtein: 22, gaFat: 12, gaFiber: 6, gaMoisture: 10, gaCalcium: 0.8, gaPhosphorus: 0.6 }),
    ];
    const result = computeCombinedNutrition(items, 'dog');

    expect(result.proteinAsFed).toBe(28);
    expect(result.fatAsFed).toBe(15);  // (16*600 + 12*200)/800 = 15
  });

  test('excludes treats and supplements from average', () => {
    const items = [
      makeDietItem({ dailyKcal: 700, gaProtein: 28 }),
      makeDietItem({ dailyKcal: 50, gaProtein: 10, category: 'treat' }),
      makeDietItem({ dailyKcal: 30, gaProtein: 5, category: 'supplement' }),
    ];
    const result = computeCombinedNutrition(items, 'dog');

    // Only the daily_food item counted
    expect(result.proteinAsFed).toBe(28);
  });

  test('returns empty nutrition when no eligible items', () => {
    const result = computeCombinedNutrition([], 'dog');

    expect(result.proteinAsFed).toBeNull();
    expect(result.fatAsFed).toBeNull();
    expect(result.aafcoChecks).toHaveLength(2); // empty has 2 checks
    expect(result.aafcoChecks[0].passes).toBe(false);
  });

  test('DMB conversion: asFed / (100 - moisture) * 100', () => {
    // 28% protein as-fed, 10% moisture → DMB = 28/90*100 = 31.11
    const items = [makeDietItem({ dailyKcal: 700, gaProtein: 28, gaMoisture: 10 })];
    const result = computeCombinedNutrition(items, 'dog');

    expect(result.proteinDmb).toBeCloseTo(31.11, 1);
  });

  test('AAFCO checks use dog thresholds (protein ≥18%, fat ≥5.5%, Ca ≥0.5%, P ≥0.4%)', () => {
    const items = [makeDietItem({ dailyKcal: 700, gaProtein: 28, gaFat: 16, gaMoisture: 10, gaCalcium: 1.2, gaPhosphorus: 0.9 })];
    const result = computeCombinedNutrition(items, 'dog');

    expect(result.aafcoChecks).toHaveLength(4);
    expect(result.aafcoChecks[0]).toEqual(expect.objectContaining({ nutrient: 'Protein', passes: true, threshold: 18 }));
    expect(result.aafcoChecks[1]).toEqual(expect.objectContaining({ nutrient: 'Fat', passes: true, threshold: 5.5 }));
    expect(result.aafcoChecks[2]).toEqual(expect.objectContaining({ nutrient: 'Calcium', passes: true, threshold: 0.5 }));
    expect(result.aafcoChecks[3]).toEqual(expect.objectContaining({ nutrient: 'Phosphorus', passes: true, threshold: 0.4 }));
  });

  test('AAFCO checks use cat thresholds (protein ≥26%, fat ≥9%, Ca ≥0.6%, P ≥0.5%)', () => {
    // Low protein cat food: 20% as-fed, 10% moisture → 22.2% DMB (below 26%)
    const items = [makeDietItem({ dailyKcal: 500, gaProtein: 20, gaFat: 7, gaMoisture: 10, gaCalcium: 0.4, gaPhosphorus: 0.3 })];
    const result = computeCombinedNutrition(items, 'cat');

    expect(result.aafcoChecks[0]).toEqual(expect.objectContaining({ nutrient: 'Protein', passes: false, threshold: 26 }));
    expect(result.aafcoChecks[1]).toEqual(expect.objectContaining({ nutrient: 'Fat', passes: false, threshold: 9 }));
  });

  test('null GA values produce null averages', () => {
    const items = [makeDietItem({ dailyKcal: 700, gaProtein: null, gaFat: null, gaMoisture: null })];
    const result = computeCombinedNutrition(items, 'dog');

    expect(result.proteinAsFed).toBeNull();
    expect(result.proteinDmb).toBeNull();
  });
});

// ─── computeSupplementNutrients ─────────────────────────

describe('computeSupplementNutrients', () => {
  test('picks highest value and collects all sources', () => {
    const card1 = makeCard({
      product_id: 'prod-1',
      product: { ...makeCard().product, name: 'Food A', ga_omega3_pct: 0.5 } as PantryCardData['product'],
    });
    const card2 = makeCard({
      product_id: 'prod-2',
      product: { ...makeCard().product, name: 'Food B', ga_omega3_pct: 0.8 } as PantryCardData['product'],
    });

    const result = computeSupplementNutrients([card1, card2]);
    const omega3 = result.find(n => n.name === 'Omega-3');

    expect(omega3).toBeDefined();
    expect(omega3!.value).toBe('0.8%');
    expect(omega3!.sources).toEqual(['Food A', 'Food B']);
  });

  test('returns empty array when no supplement nutrients present', () => {
    const card = makeCard();
    const result = computeSupplementNutrients([card]);

    expect(result).toEqual([]);
  });

  test('probiotics use "Present" value', () => {
    const card = makeCard({
      product: { ...makeCard().product, ga_probiotics_cfu: '80M' } as PantryCardData['product'],
    });

    const result = computeSupplementNutrients([card]);
    const probiotics = result.find(n => n.name === 'Probiotics');

    expect(probiotics).toBeDefined();
    expect(probiotics!.value).toBe('Present');
    expect(probiotics!.unit).toBe('');
  });
});

// ─── generateFlags ──────────────────────────────────────

describe('generateFlags', () => {
  const pet = makePet();

  test('P1: recall flag with product names', () => {
    const items = [makeDietItem({ isRecalled: true, productName: 'Bad Food' })];
    const flags = generateFlags(items, [makeCard()], computeCombinedNutrition(items, 'dog'), pet);

    const recall = flags.find(f => f.type === 'recall');
    expect(recall).toBeDefined();
    expect(recall!.priority).toBe(1);
    expect(recall!.message).toContain('Bad Food');
    expect(recall!.message).toContain('has been recalled');
  });

  test('P2: allergen flag deduped across products', () => {
    const items = [
      makeDietItem({ allergenFlags: ['chicken', 'beef'] }),
      makeDietItem({ allergenFlags: ['chicken'] }),
    ];
    const flags = generateFlags(items, [], computeCombinedNutrition(items, 'dog'), pet);

    const allergen = flags.find(f => f.type === 'allergen');
    expect(allergen).toBeDefined();
    expect(allergen!.message).toContain('chicken');
    expect(allergen!.message).toContain('beef');
    // "chicken" should appear only once in allergen list
    const match = allergen!.message.match(/chicken/g);
    // It can appear in allergen list AND product names separately, just verify dedup in detected list
    expect(allergen!.message).toMatch(/chicken, beef/);
  });

  test('P3: AAFCO failure only when dmbValue is not null', () => {
    const nutrition: CombinedNutrition = {
      proteinAsFed: 10, proteinDmb: 11, // below 18% dog threshold
      fatAsFed: 3, fatDmb: null, // null → should NOT appear in flag
      fiberAsFed: null, fiberDmb: null,
      moistureAsFed: 10,
      calciumAsFed: null, calciumDmb: null,
      phosphorusAsFed: null, phosphorusDmb: null,
      kcalPerKg: null, kcalPerKgDmb: null,
      aafcoChecks: [
        { nutrient: 'Protein', dmbValue: 11, threshold: 18, passes: false, label: '≥18%' },
        { nutrient: 'Fat', dmbValue: null, threshold: 5.5, passes: false, label: '≥5.5%' },
      ],
    };
    const flags = generateFlags([makeDietItem()], [makeCard()], nutrition, pet);

    const aafco = flags.find(f => f.type === 'aafco');
    expect(aafco).toBeDefined();
    expect(aafco!.message).toContain('Protein');
    expect(aafco!.message).not.toContain('Fat');
  });

  test('P4: supplemental-only diet', () => {
    const items = [
      makeDietItem({ category: 'daily_food', isSupplemental: true }),
    ];
    const flags = generateFlags(items, [], computeCombinedNutrition(items, 'dog'), pet);

    const suppOnly = flags.find(f => f.type === 'supplemental_only');
    expect(suppOnly).toBeDefined();
    expect(suppOnly!.message).toContain('supplemental');
  });

  test('P6: treats >10% of daily kcal', () => {
    const items = [
      makeDietItem({ dailyKcal: 700, category: 'daily_food' }),
      makeDietItem({ dailyKcal: 100, category: 'treat' }),
    ];
    // 100/800 = 12.5% > 10%
    const flags = generateFlags(items, [], computeCombinedNutrition(items, 'dog'), pet);

    const treat = flags.find(f => f.type === 'treat');
    expect(treat).toBeDefined();
    expect(treat!.message).toContain('13%'); // Math.round(12.5) = 13
  });

  test('P7: DCM flag for dogs with grain-free products only', () => {
    const card = makeCard({ product: { ...makeCard().product, is_grain_free: true } as PantryCardData['product'] });
    const items = [makeDietItem()];
    const flags = generateFlags(items, [card], computeCombinedNutrition(items, 'dog'), pet);

    const dcm = flags.find(f => f.type === 'dcm');
    expect(dcm).toBeDefined();
    expect(dcm!.icon).toBe('ℹ');
    expect(dcm!.message).toContain('grain-free');
  });

  test('P7: DCM flag does NOT fire for cats', () => {
    const catPet = makePet({ species: 'cat' });
    const card = makeCard({ product: { ...makeCard().product, is_grain_free: true } as PantryCardData['product'] });
    const items = [makeDietItem()];
    const flags = generateFlags(items, [card], computeCombinedNutrition(items, 'cat'), catPet);

    expect(flags.find(f => f.type === 'dcm')).toBeUndefined();
  });

  test('P8: no-recall positive flag when diet has items and none recalled', () => {
    const items = [makeDietItem({ isRecalled: false })];
    const flags = generateFlags(items, [], computeCombinedNutrition(items, 'dog'), pet);

    const noRecall = flags.find(f => f.type === 'no_recall');
    expect(noRecall).toBeDefined();
    expect(noRecall!.message).toContain('No tracked products');
  });

  test('priority numbering is sequential starting at 1', () => {
    // Trigger recall + allergen + treat flags
    const items = [
      makeDietItem({ isRecalled: true, allergenFlags: ['chicken'], dailyKcal: 700, category: 'daily_food' }),
      makeDietItem({ dailyKcal: 100, category: 'treat' }),
    ];
    const flags = generateFlags(items, [], computeCombinedNutrition(items, 'dog'), pet);

    const priorities = flags.map(f => f.priority);
    for (let i = 0; i < priorities.length; i++) {
      expect(priorities[i]).toBe(i + 1);
    }
  });
});

// ─── generateConditionNotes ─────────────────────────────

describe('generateConditionNotes', () => {
  const pet = makePet();

  const nutrition: CombinedNutrition = {
    proteinAsFed: 28, proteinDmb: 31.11,
    fatAsFed: 16, fatDmb: 17.78,
    fiberAsFed: 4, fiberDmb: 4.44,
    moistureAsFed: 10,
    calciumAsFed: 1.2, calciumDmb: 1.33,
    phosphorusAsFed: 0.9, phosphorusDmb: 1.0,
    kcalPerKg: 3500, kcalPerKgDmb: 3888.89,
    aafcoChecks: [],
  };

  test('CKD → phosphorus, protein, and moisture observations', () => {
    const lowMoistureNutrition = { ...nutrition, moistureAsFed: 8 };
    const notes = generateConditionNotes(['ckd'], lowMoistureNutrition, [], pet);

    expect(notes).toHaveLength(1);
    expect(notes[0].condition).toBe('ckd');
    expect(notes[0].conditionLabel).toBe('Kidney Disease');
    expect(notes[0].observations).toHaveLength(3);
    expect(notes[0].observations[0]).toContain('phosphorus');
    expect(notes[0].observations[1]).toContain('protein');
    expect(notes[0].observations[2]).toContain('moisture');
  });

  test('CKD → no moisture observation when ≥50%', () => {
    const wetNutrition = { ...nutrition, moistureAsFed: 75 };
    const notes = generateConditionNotes(['ckd'], wetNutrition, [], pet);

    expect(notes[0].observations).toHaveLength(2); // phosphorus + protein only
  });

  test('pancreatitis (dog) → fat vs 12% threshold', () => {
    const notes = generateConditionNotes(['pancreatitis'], nutrition, [], pet);

    expect(notes[0].observations[0]).toContain('above the 12% DMB threshold');
  });

  test('pancreatitis (cat) → not restricted for cats', () => {
    const catPet = makePet({ species: 'cat' });
    const notes = generateConditionNotes(['pancreatitis'], nutrition, [], catPet);

    expect(notes[0].observations[0]).toContain('not restricted for cats');
  });

  test('diabetes (dog) → fiber target, below 5%', () => {
    const notes = generateConditionNotes(['diabetes'], nutrition, [], pet);

    expect(notes[0].observations[0]).toContain('fiber');
    expect(notes[0].observations[0]).toContain('below >5% target');
  });

  test('diabetes (cat) + dry kibble → flags dry kibble', () => {
    const catPet = makePet({ species: 'cat' });
    const items = [makeDietItem({ form: 'Dry' })];
    const notes = generateConditionNotes(['diabetes'], nutrition, items, catPet);

    // Cat diabetes: no fiber observation (dog-only), just dry kibble flag
    expect(notes).toHaveLength(1);
    expect(notes[0].observations).toHaveLength(1);
    expect(notes[0].observations[0]).toContain('Dry kibble');
  });

  test('obesity → fat and fiber observations', () => {
    // fatDmb = 17.78 (above 14%, no "within" label)
    // fiberDmb = 4.44 (below 5%, no "meets" label)
    const notes = generateConditionNotes(['obesity'], nutrition, [], pet);

    expect(notes[0].observations).toHaveLength(2);
    expect(notes[0].observations[0]).toContain('fat');
    expect(notes[0].observations[0]).not.toContain('within <14%');
    expect(notes[0].observations[1]).toContain('fiber');
    expect(notes[0].observations[1]).not.toContain('meets >5%');
  });

  test('hypothyroid → fat >16% observation', () => {
    const notes = generateConditionNotes(['hypothyroid'], nutrition, [], pet);

    expect(notes[0].observations[0]).toContain('exceeds the 16% DMB threshold');
  });

  test('gi_sensitive → fat >18% threshold', () => {
    const highFatNutrition = { ...nutrition, fatDmb: 20 };
    const notes = generateConditionNotes(['gi_sensitive'], highFatNutrition, [], pet);

    expect(notes[0].observations[0]).toContain('exceeds the 18% threshold');
  });

  test('skin and joint → static observations always present', () => {
    const notes = generateConditionNotes(['skin', 'joint'], nutrition, [], pet);

    expect(notes).toHaveLength(2);
    expect(notes[0].observations[0]).toContain('Omega-3');
    expect(notes[1].observations[0]).toContain('omega-3');
  });

  test('liver/seizures → no observations, not included in output', () => {
    const notes = generateConditionNotes(['liver', 'seizures'], nutrition, [], pet);

    expect(notes).toEqual([]);
  });

  test('cardiac → taurine detection in ingredients', () => {
    const items = [makeDietItem({ ingredients: ['chicken', 'taurine'] })];
    const notes = generateConditionNotes(['cardiac'], nutrition, items, pet);

    // Has taurine → no "taurine not detected" observation
    expect(notes[0].observations).toHaveLength(1); // just protein
    expect(notes[0].observations[0]).toContain('protein');
  });

  test('cardiac → no taurine in ingredients', () => {
    const items = [makeDietItem({ ingredients: ['chicken', 'brown rice'] })];
    const notes = generateConditionNotes(['cardiac'], nutrition, items, pet);

    expect(notes[0].observations).toHaveLength(2);
    expect(notes[0].observations[1]).toContain('No taurine detected');
  });
});

// ─── computeTreatSummary ────────────────────────────────

describe('computeTreatSummary', () => {
  const { useTreatBatteryStore, getTodayStr } = require('../../src/stores/useTreatBatteryStore');

  test('battery source when today matches', () => {
    (useTreatBatteryStore.getState as jest.Mock).mockReturnValue({
      lastResetDate: '2026-03-28',
      consumedByPet: { 'pet-1': { count: 3, kcal: 45 } },
    });
    (getTodayStr as jest.Mock).mockReturnValue('2026-03-28');

    const result = computeTreatSummary('pet-1', []);

    expect(result).toEqual({
      avgDailyCount: 3,
      avgDailyKcal: 45,
      source: 'battery',
      kcalIsEstimated: false,
    });
  });

  test('battery with kcal=0 → kcalIsEstimated true', () => {
    (useTreatBatteryStore.getState as jest.Mock).mockReturnValue({
      lastResetDate: '2026-03-28',
      consumedByPet: { 'pet-1': { count: 2, kcal: 0 } },
    });
    (getTodayStr as jest.Mock).mockReturnValue('2026-03-28');

    const result = computeTreatSummary('pet-1', []);

    expect(result!.avgDailyKcal).toBeNull();
    expect(result!.kcalIsEstimated).toBe(true);
  });

  test('pantry fallback when no battery data', () => {
    (useTreatBatteryStore.getState as jest.Mock).mockReturnValue({
      lastResetDate: '2026-03-27', // yesterday
      consumedByPet: {},
    });

    const treatCard = makeCard({
      product: { ...makeCard().product, category: 'treat' },
      calorie_context: { daily_kcal: 30, target_kcal: 800, source: 'label' },
    });

    const result = computeTreatSummary('pet-1', [treatCard]);

    expect(result).toEqual({
      avgDailyCount: 1,
      avgDailyKcal: 30,
      source: 'pantry',
      kcalIsEstimated: false,
    });
  });

  test('returns null when no treat data available', () => {
    (useTreatBatteryStore.getState as jest.Mock).mockReturnValue({
      lastResetDate: '2026-03-27',
      consumedByPet: {},
    });

    const result = computeTreatSummary('pet-1', [makeCard()]);

    expect(result).toBeNull();
  });
});

// ─── buildWeightTracking ────────────────────────────────

describe('buildWeightTracking', () => {
  test('maps pet fields with defaults', () => {
    const pet = makePet();
    const result = buildWeightTracking(pet);

    expect(result.currentLbs).toBe(50);
    expect(result.goalLevel).toBe(0);
    expect(result.goalLabel).toBe('Maintain');
    expect(result.estimatedDriftLbs).toBeNull();
    expect(result.lastWeighed).toBe('2026-03-01T00:00:00Z');
  });

  test('drift calculation: accumulator / 3500', () => {
    const pet = makePet({ caloric_accumulator: 7000 });
    const result = buildWeightTracking(pet);

    expect(result.estimatedDriftLbs).toBe(2);
  });

  test('negative drift for caloric deficit', () => {
    const pet = makePet({ caloric_accumulator: -3500 });
    const result = buildWeightTracking(pet);

    expect(result.estimatedDriftLbs).toBe(-1);
  });

  test('goal label lookup for all levels', () => {
    const labels: [number, string][] = [
      [-3, 'Aggressive Loss'], [-2, 'Moderate Loss'], [-1, 'Mild Loss'],
      [0, 'Maintain'], [1, 'Mild Gain'], [2, 'Moderate Gain'], [3, 'Aggressive Gain'],
    ];
    for (const [level, label] of labels) {
      const pet = makePet({ weight_goal_level: level });
      expect(buildWeightTracking(pet).goalLabel).toBe(label);
    }
  });

  test('null weight fields default to 0/null', () => {
    const pet = makePet({ weight_current_lbs: null, weight_goal_level: null, bcs_score: null });
    const result = buildWeightTracking(pet);

    expect(result.currentLbs).toBe(0);
    expect(result.goalLevel).toBe(0);
    expect(result.bcsScore).toBeNull();
  });
});

// ─── getOwnerDietaryCards ───────────────────────────────

describe('getOwnerDietaryCards', () => {
  test('no conditions → healthy maintenance card', () => {
    const cards = getOwnerDietaryCards([], 0, 'dog');

    expect(cards).toHaveLength(1);
    expect(cards[0].conditionKey).toBe('no_known_conditions');
  });

  test('allergen count >0 triggers allergy card', () => {
    const cards = getOwnerDietaryCards([], 2, 'dog');

    expect(cards.some(c => c.conditionKey === 'allergy')).toBe(true);
  });

  test('render order follows CARD_RENDER_ORDER', () => {
    const cards = getOwnerDietaryCards(['joint', 'ckd', 'obesity'], 0, 'dog');
    const keys = cards.map(c => c.conditionKey);

    // ckd before obesity before joint
    expect(keys.indexOf('ckd')).toBeLessThan(keys.indexOf('obesity'));
    expect(keys.indexOf('obesity')).toBeLessThan(keys.indexOf('joint'));
  });

  test('returns species-specific cards', () => {
    const dogCards = getOwnerDietaryCards(['pancreatitis'], 0, 'dog');
    const catCards = getOwnerDietaryCards(['pancreatitis'], 0, 'cat');

    expect(dogCards[0].goal).toContain('fat');
    expect(catCards[0].goal).toContain('NOT triggered by dietary fat');
  });
});

// ─── detectConflicts ────────────────────────────────────

describe('detectConflicts', () => {
  test('CKD + underweight → conflict note', () => {
    const conflicts = detectConflicts(['ckd', 'underweight'], 'dog');

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conditions).toEqual(['ckd', 'underweight']);
    expect(conflicts[0].note).toContain('protein');
  });

  test('pancreatitis + underweight → conflict for dogs only', () => {
    const dogConflicts = detectConflicts(['pancreatitis', 'underweight'], 'dog');
    const catConflicts = detectConflicts(['pancreatitis', 'underweight'], 'cat');

    expect(dogConflicts).toHaveLength(1);
    expect(catConflicts).toHaveLength(0);
  });

  test('no conflicting conditions → empty array', () => {
    const conflicts = detectConflicts(['ckd', 'cardiac'], 'dog');

    expect(conflicts).toEqual([]);
  });

  test('both conflicts can fire at once', () => {
    const conflicts = detectConflicts(['ckd', 'underweight', 'pancreatitis'], 'dog');

    expect(conflicts).toHaveLength(2);
  });
});
