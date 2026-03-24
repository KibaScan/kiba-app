// M2 Session 3 — Static condition & allergen data tests

import {
  DOG_CONDITIONS,
  CAT_CONDITIONS,
  DOG_ALLERGENS,
  CAT_ALLERGENS,
  OTHER_ALLERGENS,
  HEALTHY_TAG,
  getConditionsForSpecies,
  getAllergensForSpecies,
} from '../../src/data/conditions';

describe('DOG_CONDITIONS', () => {
  test('has 14 entries (13 conditions + No known conditions)', () => {
    expect(DOG_CONDITIONS).toHaveLength(14);
  });

  test('first entry is No known conditions with sentinel tag', () => {
    expect(DOG_CONDITIONS[0].tag).toBe(HEALTHY_TAG);
    expect(DOG_CONDITIONS[0].label).toBe('No known conditions');
  });

  test('includes dog-only conditions: seizures, liver', () => {
    const tags = DOG_CONDITIONS.map((c) => c.tag);
    expect(tags).toContain('seizures');
    expect(tags).toContain('liver');
  });

  test('does NOT include cat-only condition: hyperthyroid', () => {
    const tags = DOG_CONDITIONS.map((c) => c.tag);
    expect(tags).not.toContain('hyperthyroid');
  });

  test('no duplicate tags', () => {
    const tags = DOG_CONDITIONS.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  test('every condition has label and icon', () => {
    for (const cond of DOG_CONDITIONS) {
      expect(cond.label.length).toBeGreaterThan(0);
      expect(cond.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('CAT_CONDITIONS', () => {
  test('has 13 entries (12 conditions + No known conditions)', () => {
    expect(CAT_CONDITIONS).toHaveLength(13);
  });

  test('includes cat-only condition: hyperthyroid', () => {
    const tags = CAT_CONDITIONS.map((c) => c.tag);
    expect(tags).toContain('hyperthyroid');
  });

  test('does NOT include dog-only conditions: seizures', () => {
    const tags = CAT_CONDITIONS.map((c) => c.tag);
    expect(tags).not.toContain('seizures');
  });

  test('no duplicate tags', () => {
    const tags = CAT_CONDITIONS.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('DOG_ALLERGENS', () => {
  test('has 12 standard allergens', () => {
    expect(DOG_ALLERGENS).toHaveLength(12);
  });

  test('includes all major dog allergens', () => {
    const names = DOG_ALLERGENS.map((a) => a.name);
    expect(names).toContain('beef');
    expect(names).toContain('chicken');
    expect(names).toContain('dairy');
    expect(names).toContain('wheat');
  });
});

describe('CAT_ALLERGENS', () => {
  test('has 6 standard allergens', () => {
    expect(CAT_ALLERGENS).toHaveLength(6);
  });

  test('does NOT include wheat, soy, egg, corn, pork, rice (rare in cats)', () => {
    const names = CAT_ALLERGENS.map((a) => a.name);
    expect(names).not.toContain('wheat');
    expect(names).not.toContain('soy');
    expect(names).not.toContain('egg');
    expect(names).not.toContain('corn');
    expect(names).not.toContain('pork');
    expect(names).not.toContain('rice');
  });
});

describe('OTHER_ALLERGENS', () => {
  test('has 10 extended proteins', () => {
    expect(OTHER_ALLERGENS).toHaveLength(10);
  });

  test('does not overlap with standard dog allergens', () => {
    const standardNames = DOG_ALLERGENS.map((a) => a.name);
    for (const other of OTHER_ALLERGENS) {
      expect(standardNames).not.toContain(other.name);
    }
  });

  test('does not overlap with standard cat allergens', () => {
    const standardNames = CAT_ALLERGENS.map((a) => a.name);
    for (const other of OTHER_ALLERGENS) {
      expect(standardNames).not.toContain(other.name);
    }
  });
});

describe('getConditionsForSpecies', () => {
  test('dog → DOG_CONDITIONS', () => {
    expect(getConditionsForSpecies('dog')).toBe(DOG_CONDITIONS);
  });

  test('cat → CAT_CONDITIONS', () => {
    expect(getConditionsForSpecies('cat')).toBe(CAT_CONDITIONS);
  });
});

describe('getAllergensForSpecies', () => {
  test('dog → DOG_ALLERGENS', () => {
    expect(getAllergensForSpecies('dog')).toBe(DOG_ALLERGENS);
  });

  test('cat → CAT_ALLERGENS', () => {
    expect(getAllergensForSpecies('cat')).toBe(CAT_ALLERGENS);
  });
});
