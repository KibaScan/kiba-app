// Real Data Trace — Pure Balance scored using EXACT Supabase seed data.
// This test mirrors what the pipeline produces at runtime:
// - All 15 ingredients from Supabase (product_id: afd04040-425b-5742-9100-9e370c1c3cc9)
// - is_protein_fat_source = false (M1 pipeline limitation, line 49 in pipeline.ts)
// - Product GA values from Supabase products table
//
// The app displays 69% — this test verifies that math.

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, Species, LifeStage } from '../../../src/types';

// ─── Product: exact Supabase row ────────────────────────────

const PURE_BALANCE_PRODUCT: Product = {
  id: 'afd04040-425b-5742-9100-9e370c1c3cc9',
  brand: 'Pure Balance',
  name: 'Grain-Free Salmon & Pea Formula',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'curated',
  aafco_statement: 'All Life Stages',
  life_stage_claim: null,
  preservative_type: 'natural',
  ga_protein_pct: 26.0,
  ga_fat_pct: 16.0,
  ga_fiber_pct: 4.0,
  ga_moisture_pct: 10.0,
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
  ingredients_raw: 'Salmon (Deboned), Salmon Meal, Peas, Dried Peas, Pea Protein, Canola Oil, Chicken Fat (preserved with Mixed Tocopherols), Dried Plain Beet Pulp, Natural Flavor, Flaxseed, Salt, Potassium Chloride, Taurine, L-Carnitine, Mixed Tocopherols',
  ingredients_hash: null,
  image_url: null,
  is_recalled: false,
  is_grain_free: true,
  score_confidence: 'high',
  needs_review: false,
  last_verified_at: null,
  formula_change_log: null,
  affiliate_links: null,
  created_at: '2026-02-27T12:33:11.001583+00:00',
  updated_at: '2026-02-27T12:33:11.001583+00:00',
};

// ─── Ingredients: exact Supabase rows, hydrated as pipeline.ts does ──

function makeIngredient(
  overrides: Partial<ProductIngredient> & { position: number; canonical_name: string },
): ProductIngredient {
  return {
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    // Pipeline hardcodes this to false (M1 limitation)
    is_protein_fat_source: false,
    ...overrides,
  };
}

const REAL_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1,  canonical_name: 'salmon',           dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
  makeIngredient({ position: 2,  canonical_name: 'salmon_meal',      dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
  makeIngredient({ position: 3,  canonical_name: 'peas',             dog_base_severity: 'caution', cat_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true }),
  makeIngredient({ position: 4,  canonical_name: 'dried_peas',       dog_base_severity: 'caution', cat_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true }),
  makeIngredient({ position: 5,  canonical_name: 'pea_protein',      dog_base_severity: 'caution', cat_base_severity: 'danger',  cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true }),
  makeIngredient({ position: 6,  canonical_name: 'canola_oil',       dog_base_severity: 'neutral', cat_base_severity: 'caution' }),
  makeIngredient({ position: 7,  canonical_name: 'chicken_fat',      dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_chicken', allergen_group: 'chicken' }),
  makeIngredient({ position: 8,  canonical_name: 'beet_pulp',        dog_base_severity: 'good',    cat_base_severity: 'good' }),
  makeIngredient({ position: 9,  canonical_name: 'natural_flavor',   dog_base_severity: 'caution', cat_base_severity: 'caution', is_unnamed_species: true, position_reduction_eligible: false, allergen_group_possible: ['chicken', 'beef', 'pork', 'lamb', 'fish'] }),
  makeIngredient({ position: 10, canonical_name: 'flaxseed',         dog_base_severity: 'good',    cat_base_severity: 'neutral', cluster_id: 'seed_flax' }),
  makeIngredient({ position: 11, canonical_name: 'salt',             dog_base_severity: 'caution', cat_base_severity: 'caution' }),
  makeIngredient({ position: 12, canonical_name: 'potassium_chloride', dog_base_severity: 'good',  cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 13, canonical_name: 'taurine',          dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 14, canonical_name: 'l_carnitine',      dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 15, canonical_name: 'mixed_tocopherols', dog_base_severity: 'good',   cat_base_severity: 'good',    position_reduction_eligible: false }),
];

// ─── Pet: default adult dog ──────────────────────────────────

const PET: PetProfile = {
  id: 'pet-1',
  user_id: 'user-1',
  name: 'Buster',
  species: Species.Dog,
  breed: null,
  date_of_birth: null,
  dob_is_approximate: false,
  weight_current_lbs: null,
  weight_goal_lbs: null,
  weight_updated_at: null,
  activity_level: 'moderate',
  is_neutered: true,
  sex: null,
  breed_size: null,
  life_stage: LifeStage.Adult,
  photo_url: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

// ─── Test ────────────────────────────────────────────────────

describe('Real Data Trace: Pure Balance Grain-Free Salmon & Pea (Dog)', () => {
  test('full pipeline trace → 69', () => {
    const result = computeScore(PURE_BALANCE_PRODUCT, REAL_INGREDIENTS, PET);

    const iq = result.layer1.ingredientQuality;
    const np = result.layer1.nutritionalProfile;
    const fc = result.layer1.formulation;
    const base = result.layer1.weightedComposite;
    const dcm = result.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
    const mit = result.layer2.appliedRules.find(r => r.ruleId === 'TAURINE_MITIGATION');
    const l2Net = dcm!.adjustment + mit!.adjustment;

    console.log('═══ REAL DATA TRACE: Pure Balance ═══');
    console.log('');
    console.log('Layer 1a — Ingredient Quality');
    console.log(`  IQ: ${iq}`);
    result.ingredientPenalties.forEach(p =>
      console.log(`    pos ${p.position}: ${p.ingredientName} → −${p.positionAdjustedPenalty} (raw ${p.rawPenalty}, ${p.reason})`),
    );
    console.log('');
    console.log('Layer 1b — Nutritional Profile');
    console.log(`  NP: ${np}`);
    console.log('');
    console.log('Layer 1c — Formulation');
    console.log(`  FC: ${fc}`);
    console.log('');
    console.log('Weighted Composite');
    console.log(`  IQ: ${iq} × 0.55 = ${(iq * 0.55).toFixed(2)}`);
    console.log(`  NP: ${np} × 0.30 = ${(np * 0.30).toFixed(2)}`);
    console.log(`  FC: ${fc} × 0.15 = ${(fc * 0.15).toFixed(2)}`);
    console.log(`  Base: ${base}`);
    console.log('');
    console.log('Layer 2 — Species Rules');
    console.log(`  DCM fired: ${dcm!.fired}, adjustment: ${dcm!.adjustment}`);
    console.log(`  Mitigation fired: ${mit!.fired}, adjustment: ${mit!.adjustment}`);
    console.log(`  L2 net: ${l2Net}`);
    console.log(`  Post-L2: ${base + l2Net}`);
    console.log('');
    console.log('Layer 3 — Personalization');
    result.layer3.personalizations.forEach(p =>
      console.log(`  ${p.type}: ${p.adjustment}`),
    );
    console.log('');
    console.log(`Final: ${result.finalScore}`);
    console.log(`Display: ${result.displayScore}% match for ${result.petName}`);

    // ─── Assertions ──────────────────────────────────────────

    // Layer 1a: IQ = 62.8
    //   peas (pos 3, caution, eligible):       −8 × 1.0 = −8
    //   dried_peas (pos 4, caution, eligible): −8 × 1.0 = −8
    //   pea_protein (pos 5, caution, eligible): −8 × 1.0 = −8
    //   natural_flavor (pos 9, caution, NOT eligible): −8 × 1.0 = −8
    //   natural_flavor (unnamed): −2
    //   salt (pos 11, caution, eligible): −8 × 0.4 = −3.2
    //   Total: −37.2 → IQ = 62.8
    expect(iq).toBeCloseTo(62.8, 1);

    // Layer 1b: NP = 85
    expect(np).toBe(85);

    // Layer 1c: FC = 88
    //   AAFCO "All Life Stages" → 100
    //   Preservative "natural" → 100
    //   Protein naming: no is_protein_fat_source flagged → returns 50 (M1 default)
    //   FC = round(100×0.50 + 100×0.25 + 50×0.25) = round(87.5) = 88
    expect(fc).toBe(88);

    // Weighted: (62.8×0.55) + (85×0.30) + (88×0.15) = 34.54 + 25.5 + 13.2 = 73.24 → 73.2
    expect(base).toBeCloseTo(73.2, 1);

    // DCM fires: grain-free + 3 legumes in top 7
    expect(dcm!.fired).toBe(true);
    expect(dcm!.adjustment).toBe(-Math.round(base * 0.08)); // -round(5.856) = -6
    expect(dcm!.adjustment).toBe(-6);

    // Mitigation fires: taurine (pos 13) + l_carnitine (pos 14)
    expect(mit!.fired).toBe(true);
    expect(mit!.adjustment).toBe(Math.round(base * 0.03)); // +round(2.196) = +2
    expect(mit!.adjustment).toBe(2);

    // L2 net: -6 + 2 = -4
    expect(l2Net).toBe(-4);

    // Layer 3: neutral (no allergens, no conditions, breed stub = 0)
    const l3Adjustment = result.layer3.personalizations.reduce((sum, p) => sum + p.adjustment, 0);
    expect(l3Adjustment).toBe(0);

    // Final: round(73.2 + (-4) + 0) = round(69.2) = 69
    expect(result.finalScore).toBe(69);
    expect(result.petName).toBe('Buster');
  });
});
