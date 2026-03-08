// Tests for flavor deception detection (D-133)

import { detectFlavorDeception } from '../../src/utils/flavorDeception';

describe('detectFlavorDeception', () => {
  it('detects buried protein — Temptations Classic Tuna with chicken at pos 1', () => {
    const result = detectFlavorDeception('Temptations Classic Tuna', [
      { canonical_name: 'chicken', position: 1, is_protein_fat_source: true },
      { canonical_name: 'ground corn', position: 2 },
      { canonical_name: 'animal fat', position: 3 },
      { canonical_name: 'dried meat by-products', position: 4 },
      { canonical_name: 'brewers rice', position: 5 },
      { canonical_name: 'tuna meal', position: 8 },
    ]);
    expect(result.detected).toBe(true);
    expect(result.variant).toBe('buried');
    expect(result.namedProtein).toBe('Tuna');
    expect(result.namedProteinPosition).toBe(8);
    expect(result.actualPrimaryProtein).toContain('Chicken');
    expect(result.actualPrimaryPosition).toBe(1);
  });

  it('returns false for chicken product with chicken at position 1', () => {
    const result = detectFlavorDeception('Chicken Recipe Premium Dog Food', [
      { canonical_name: 'chicken', position: 1, is_protein_fat_source: true },
      { canonical_name: 'brown rice', position: 2 },
      { canonical_name: 'oatmeal', position: 3 },
    ]);
    expect(result.detected).toBe(false);
  });

  it('returns false for salmon product with salmon at position 1', () => {
    const result = detectFlavorDeception('Salmon & Sweet Potato', [
      { canonical_name: 'salmon', position: 1, is_protein_fat_source: true },
      { canonical_name: 'sweet potatoes', position: 2 },
      { canonical_name: 'peas', position: 3 },
    ]);
    expect(result.detected).toBe(false);
  });

  it('returns false when no protein keyword in product name', () => {
    const result = detectFlavorDeception('Premium Indoor Formula', [
      { canonical_name: 'chicken', position: 1, is_protein_fat_source: true },
      { canonical_name: 'corn', position: 2 },
    ]);
    expect(result.detected).toBe(false);
  });

  it('detects absent protein — named protein not in ingredient list', () => {
    const result = detectFlavorDeception('Wild Salmon Feast', [
      { canonical_name: 'chicken meal', position: 1, is_protein_fat_source: true },
      { canonical_name: 'corn gluten meal', position: 2 },
      { canonical_name: 'brewers rice', position: 3 },
      { canonical_name: 'animal fat', position: 4 },
    ]);
    expect(result.detected).toBe(true);
    expect(result.variant).toBe('absent');
    expect(result.namedProtein).toBe('Salmon');
    expect(result.namedProteinPosition).toBeNull();
  });

  it('returns false with empty ingredients', () => {
    const result = detectFlavorDeception('Tuna Treats', []);
    expect(result.detected).toBe(false);
  });

  it('returns false when named protein is at position 2', () => {
    const result = detectFlavorDeception('Beef Dinner', [
      { canonical_name: 'water', position: 1 },
      { canonical_name: 'beef', position: 2, is_protein_fat_source: true },
      { canonical_name: 'liver', position: 3 },
    ]);
    expect(result.detected).toBe(false);
  });

  it('detects buried with position 3-4 as buried variant', () => {
    const result = detectFlavorDeception('Duck Recipe', [
      { canonical_name: 'chicken', position: 1, is_protein_fat_source: true },
      { canonical_name: 'corn', position: 2 },
      { canonical_name: 'duck', position: 3 },
    ]);
    expect(result.detected).toBe(true);
    expect(result.variant).toBe('buried');
  });
});
