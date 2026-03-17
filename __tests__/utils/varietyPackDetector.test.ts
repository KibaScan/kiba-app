// Kiba — Variety Pack Detection Tests
// Covers: name keywords, ingredient count threshold, duplicate detection, normal products

import { detectVarietyPack } from '../../src/utils/varietyPackDetector';
import type { ProductIngredient } from '../../src/types/scoring';

function makeIngredient(
  position: number,
  canonical_name: string,
): ProductIngredient {
  return {
    position,
    canonical_name,
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    is_pulse: false,
    is_pulse_protein: false,
    position_reduction_eligible: false,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
  };
}

function makeUniqueIngredients(count: number): ProductIngredient[] {
  return Array.from({ length: count }, (_, i) =>
    makeIngredient(i + 1, `ingredient_${i + 1}`),
  );
}

describe('detectVarietyPack', () => {
  // ─── Rule 1: Name keywords ────────────────────────────

  it('detects "variety pack" in product name', () => {
    expect(detectVarietyPack('Fancy Feast Variety Pack 24ct', [])).toBe(true);
  });

  it('detects "variety" in product name (case-insensitive)', () => {
    expect(detectVarietyPack('VARIETY Flavors Collection', [])).toBe(true);
  });

  it('detects "multi-pack" in product name', () => {
    expect(detectVarietyPack('Hartz Delectables Multi-Pack', [])).toBe(true);
  });

  it('detects "multipack" (no hyphen) in product name', () => {
    expect(detectVarietyPack('Cat Treats Multipack', [])).toBe(true);
  });

  it('detects "assorted" in product name', () => {
    expect(detectVarietyPack('Assorted Flavors Dog Treats', [])).toBe(true);
  });

  it('detects "sampler" in product name', () => {
    expect(detectVarietyPack('Premium Dog Food Sampler', [])).toBe(true);
  });

  // ─── Rule 2: Ingredient count threshold ───────────────

  it('detects product with 100+ ingredients (concatenated lists)', () => {
    const ingredients = makeUniqueIngredients(100);
    expect(detectVarietyPack('Normal Product Name', ingredients)).toBe(true);
  });

  it('detects product with exactly 81 ingredients', () => {
    const ingredients = makeUniqueIngredients(81);
    expect(detectVarietyPack('Normal Product Name', ingredients)).toBe(true);
  });

  it('does NOT flag product with exactly 80 ingredients', () => {
    const ingredients = makeUniqueIngredients(80);
    expect(detectVarietyPack('Normal Product Name', ingredients)).toBe(false);
  });

  // ─── Rule 3: Duplicate canonical names ────────────────

  it('detects duplicate canonical ingredient names at different positions', () => {
    const ingredients = [
      makeIngredient(1, 'chicken'),
      makeIngredient(2, 'rice'),
      makeIngredient(3, 'tapioca_starch'),
      makeIngredient(10, 'tapioca_starch'), // duplicate
    ];
    expect(detectVarietyPack('Normal Product Name', ingredients)).toBe(true);
  });

  it('detects natural_flavor appearing twice (common in variety packs)', () => {
    const ingredients = [
      makeIngredient(3, 'natural_flavor'),
      makeIngredient(9, 'natural_flavor'), // duplicate
    ];
    expect(detectVarietyPack('Normal Product Name', ingredients)).toBe(true);
  });

  // ─── Negative cases ──────────────────────────────────

  it('does NOT flag normal product with 30 unique ingredients', () => {
    const ingredients = makeUniqueIngredients(30);
    expect(detectVarietyPack('Premium Chicken Kibble', ingredients)).toBe(false);
  });

  it('does NOT flag product with normal name and no duplicates', () => {
    const ingredients = [
      makeIngredient(1, 'chicken'),
      makeIngredient(2, 'rice'),
      makeIngredient(3, 'salmon_oil'),
    ];
    expect(detectVarietyPack('Purina Pro Plan Adult Dog', ingredients)).toBe(false);
  });

  it('does NOT flag empty ingredient list with normal name', () => {
    expect(detectVarietyPack('Normal Kibble', [])).toBe(false);
  });
});
