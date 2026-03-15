// Real Data Trace — Pure Balance scored using Walmart bag data.
// Product not on Chewy; manually inserted into v6 pipeline.
// product_id: 557b94d9-9d26-4cd3-83d5-05eb4dacb5db
//
// The app displays 62% — this test verifies that math. (D-137: DCM fires → 65 → 62)

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, Species, LifeStage } from '../../../src/types';

// ─── Product: Walmart bag GA data ────────────────────────────

const PURE_BALANCE_PRODUCT: Product = {
  id: '557b94d9-9d26-4cd3-83d5-05eb4dacb5db',
  brand: 'Pure Balance',
  name: 'Wild & Free Salmon & Pea Recipe Dry Dog Food, Grain Free, 24 lbs',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'curated',
  aafco_statement: 'yes',
  life_stage_claim: 'All Life Stages',
  preservative_type: 'natural',
  ga_protein_pct: 24.0,
  ga_fat_pct: 15.0,
  ga_fiber_pct: 5.0,
  ga_moisture_pct: 10.0,
  ga_calcium_pct: null,
  ga_phosphorus_pct: null,
  ga_kcal_per_cup: null,
  ga_kcal_per_kg: null,
  kcal_per_unit: null,
  unit_weight_g: null,
  default_serving_format: null,
  ga_taurine_pct: 0.15,
  ga_l_carnitine_mg: null,
  ga_dha_pct: 0.2,
  ga_omega3_pct: 0.5,
  ga_omega6_pct: 3.0,
  ga_zinc_mg_kg: null,
  ga_probiotics_cfu: null,
  nutritional_data_source: 'manual',
  ingredients_raw: 'SALMON, SALMON MEAL, DRIED PEAS, POTATOES, SWEET POTATOES, POULTRY FAT (PRESERVED WITH MIXED TOCOPHEROLS), PEA STARCH, FISH MEAL, DRIED YEAST, DRIED PLAIN BEET PULP, NATURAL FLAVOR, FLAXSEED, SALT, DICALCIUM PHOSPHATE, POTASSIUM CHLORIDE, DL-METHIONINE, TAURINE, CHOLINE CHLORIDE, VITAMINS (...), MINERALS (...), LACTIC ACID, MIXED TOCOPHEROLS (USED AS A PRESERVATIVE), CITRIC ACID (USED AS A PRESERVATIVE), L-CARNITINE, DRIED BACILLUS COAGULANS FERMENTATION PRODUCT, ROSEMARY EXTRACT.',
  ingredients_hash: null,
  image_url: null,
  is_recalled: false,
  is_grain_free: true,
  score_confidence: 'high',
  needs_review: false,
  last_verified_at: null,
  formula_change_log: null,
  affiliate_links: null,
  created_at: '2026-03-14T00:00:00.000Z',
  updated_at: '2026-03-14T00:00:00.000Z',
};

// ─── Ingredients: scoring-relevant subset from Walmart bag ──

function makeIngredient(
  overrides: Partial<ProductIngredient> & { position: number; canonical_name: string },
): ProductIngredient {
  return {
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    is_pulse: false,
    is_pulse_protein: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
    ...overrides,
  };
}

const REAL_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1,  canonical_name: 'salmon',           dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
  makeIngredient({ position: 2,  canonical_name: 'salmon_meal',      dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
  makeIngredient({ position: 3,  canonical_name: 'peas',             dog_base_severity: 'caution', cat_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
  makeIngredient({ position: 4,  canonical_name: 'potato',           dog_base_severity: 'neutral', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 5,  canonical_name: 'sweet_potato',     dog_base_severity: 'neutral', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 6,  canonical_name: 'poultry_fat',      dog_base_severity: 'caution', cat_base_severity: 'caution' }),
  makeIngredient({ position: 7,  canonical_name: 'pea_starch',       dog_base_severity: 'neutral', cat_base_severity: 'neutral', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
  makeIngredient({ position: 8,  canonical_name: 'fish_meal',        dog_base_severity: 'caution', cat_base_severity: 'caution', allergen_group: 'fish', is_unnamed_species: true }),
  makeIngredient({ position: 9,  canonical_name: 'dried_yeast',      dog_base_severity: 'neutral', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 10, canonical_name: 'beet_pulp',        dog_base_severity: 'good',    cat_base_severity: 'good' }),
  makeIngredient({ position: 11, canonical_name: 'natural_flavor',   dog_base_severity: 'caution', cat_base_severity: 'caution', is_unnamed_species: true, position_reduction_eligible: false }),
  makeIngredient({ position: 12, canonical_name: 'flaxseed',         dog_base_severity: 'good',    cat_base_severity: 'neutral', cluster_id: 'seed_flax' }),
  makeIngredient({ position: 13, canonical_name: 'salt',             dog_base_severity: 'caution', cat_base_severity: 'caution' }),
  makeIngredient({ position: 14, canonical_name: 'dicalcium_phosphate', dog_base_severity: 'good', cat_base_severity: 'good' }),
  makeIngredient({ position: 15, canonical_name: 'potassium_chloride', dog_base_severity: 'good',  cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 16, canonical_name: 'methionine',       dog_base_severity: 'neutral', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 17, canonical_name: 'taurine',          dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 33, canonical_name: 'copper_sulfate',   dog_base_severity: 'caution', cat_base_severity: 'caution', position_reduction_eligible: false }),
  makeIngredient({ position: 40, canonical_name: 'l_carnitine',      dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
  makeIngredient({ position: 42, canonical_name: 'rosemary_extract', dog_base_severity: 'good',    cat_base_severity: 'good' }),
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

describe('Real Data Trace: Pure Balance Wild & Free Salmon & Pea (Dog)', () => {
  test('full pipeline trace → 62 (D-137: DCM fires, mitigation applies)', () => {
    const result = computeScore(PURE_BALANCE_PRODUCT, REAL_INGREDIENTS, PET);

    const iq = result.layer1.ingredientQuality;
    const np = result.layer1.nutritionalProfile;
    const fc = result.layer1.formulation;
    const base = result.layer1.weightedComposite;
    const dcm = result.layer2.appliedRules.find(r => r.ruleId === 'DCM_ADVISORY');
    const mit = result.layer2.appliedRules.find(r => r.ruleId === 'TAURINE_MITIGATION');

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
    console.log('Layer 2 — Species Rules (D-137)');
    console.log(`  DCM fired: ${dcm!.fired}, adjustment: ${dcm!.adjustment}`);
    console.log(`  Mitigation fired: ${mit!.fired}, adjustment: ${mit!.adjustment}`);
    console.log('');
    console.log(`Final: ${result.finalScore}`);
    console.log(`Display: ${result.displayScore}% match for ${result.petName}`);

    // ─── Assertions ──────────────────────────────────────────

    // Layer 1a: IQ = 57.6
    //   Caution penalties: peas(-8) + poultry_fat(-5.6) + fish_meal(-5.6) + natural_flavor(-8) + salt(-3.2) + copper_sulfate(-8) = −38.4
    //   Unnamed species: fish_meal(-2) + natural_flavor(-2) = −4
    //   Total: −42.4 → IQ = 57.6
    expect(iq).toBeCloseTo(57.6, 1);

    // Layer 1b: NP = 79
    expect(np).toBe(79);

    // Layer 1c: FC = 63
    expect(fc).toBe(63);

    // Weighted: (57.6×0.55) + (79×0.30) + (63×0.15) = 31.68 + 23.7 + 9.45 ≈ 65
    expect(base).toBeCloseTo(64.8, 1);

    // D-137: DCM fires — Rule 1 (peas at pos 3) + Rule 2 (2 pulses in top 10)
    expect(dcm!.fired).toBe(true);
    // DCM: −round(65 × 0.08) = −round(5.2) = −5
    expect(dcm!.adjustment).toBe(-5);

    // Mitigation fires: taurine (pos 17) + l_carnitine (pos 40) both present
    expect(mit!.fired).toBe(true);
    // Mitigation: +round(65 × 0.03) = +round(1.95) = +2
    expect(mit!.adjustment).toBe(2);

    // Layer 3: neutral (no allergens, no conditions)
    const l3Adjustment = result.layer3.personalizations.reduce((sum, p) => sum + p.adjustment, 0);
    expect(l3Adjustment).toBe(0);

    // Final: 65 − 5 + 2 = 62
    expect(result.finalScore).toBe(62);
    expect(result.petName).toBe('Buster');
  });
});
