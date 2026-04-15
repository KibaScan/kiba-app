// M2 Session 3 — Condition/Allergen Logic Tests
// Pure function tests for chip interaction logic.

import {
  toggleCondition,
  isConditionDisabled,
  getConditionToast,
  isAllergenSectionVisible,
  toggleAllergen,
  removeAllergen,
  conditionsToSavePayload,
  allergensToSavePayload,
  isProfileComplete,
} from '../../src/utils/conditionLogic';
import { HEALTHY_TAG } from '../../src/data/conditions';

// ─── toggleCondition ─────────────────────────────────────

describe('toggleCondition', () => {
  test('selecting "Perfectly Healthy" on empty state → [__healthy__]', () => {
    expect(toggleCondition([], HEALTHY_TAG)).toEqual([HEALTHY_TAG]);
  });

  test('deselecting "Perfectly Healthy" → empty array', () => {
    expect(toggleCondition([HEALTHY_TAG], HEALTHY_TAG)).toEqual([]);
  });

  test('selecting "Perfectly Healthy" clears ALL conditions', () => {
    const current = ['joint', 'allergy', 'obesity'];
    expect(toggleCondition(current, HEALTHY_TAG)).toEqual([HEALTHY_TAG]);
  });

  test('selecting a condition deselects "Perfectly Healthy"', () => {
    const result = toggleCondition([HEALTHY_TAG], 'joint');
    expect(result).toEqual(['joint']);
    expect(result).not.toContain(HEALTHY_TAG);
  });

  test('toggling a condition ON adds it', () => {
    expect(toggleCondition(['joint'], 'allergy')).toEqual(['joint', 'allergy']);
  });

  test('toggling a condition OFF removes it', () => {
    expect(toggleCondition(['joint', 'allergy'], 'allergy')).toEqual(['joint']);
  });

  test('multiple conditions can coexist', () => {
    let state: string[] = [];
    state = toggleCondition(state, 'joint');
    state = toggleCondition(state, 'allergy');
    state = toggleCondition(state, 'ckd');
    expect(state).toEqual(['joint', 'allergy', 'ckd']);
  });

  test('selecting a condition when healthy is set clears healthy first', () => {
    const result = toggleCondition([HEALTHY_TAG], 'obesity');
    expect(result).toEqual(['obesity']);
  });

  test('toggling last condition off results in empty array', () => {
    const result = toggleCondition(['joint'], 'joint');
    expect(result).toEqual([]);
  });
});

// ─── isConditionDisabled ─────────────────────────────────

describe('isConditionDisabled', () => {
  test('underweight disabled when obesity selected', () => {
    expect(isConditionDisabled('underweight', ['obesity'])).toBe(true);
  });

  test('obesity disabled when underweight selected', () => {
    expect(isConditionDisabled('obesity', ['underweight'])).toBe(true);
  });

  test('underweight NOT disabled when obesity NOT selected', () => {
    expect(isConditionDisabled('underweight', ['joint'])).toBe(false);
  });

  test('obesity NOT disabled when underweight NOT selected', () => {
    expect(isConditionDisabled('obesity', ['allergy', 'ckd'])).toBe(false);
  });

  test('non-weight conditions never disabled', () => {
    expect(isConditionDisabled('joint', ['obesity'])).toBe(false);
    expect(isConditionDisabled('allergy', ['underweight'])).toBe(false);
    expect(isConditionDisabled('ckd', ['obesity', 'underweight'])).toBe(false);
  });

  // M6: hypothyroid ↔ hyperthyroid mutual exclusion
  test('hyperthyroid disabled when hypothyroid selected', () => {
    expect(isConditionDisabled('hyperthyroid', ['hypothyroid'])).toBe(true);
  });

  test('hypothyroid disabled when hyperthyroid selected', () => {
    expect(isConditionDisabled('hypothyroid', ['hyperthyroid'])).toBe(true);
  });

  test('hypothyroid NOT disabled when hyperthyroid NOT selected', () => {
    expect(isConditionDisabled('hypothyroid', ['cardiac'])).toBe(false);
  });

  test('hyperthyroid NOT disabled when hypothyroid NOT selected', () => {
    expect(isConditionDisabled('hyperthyroid', ['diabetes'])).toBe(false);
  });

  test('neither disabled when both absent', () => {
    expect(isConditionDisabled('obesity', [])).toBe(false);
    expect(isConditionDisabled('underweight', [])).toBe(false);
  });

  test('full flow: select obesity → underweight disabled → deselect obesity → underweight re-enabled', () => {
    // 1. Select obesity
    let state = toggleCondition([], 'obesity');
    expect(state).toEqual(['obesity']);

    // 2. Underweight is disabled
    expect(isConditionDisabled('underweight', state)).toBe(true);

    // 3. Attempt to toggle underweight while disabled — rejected
    const rejected = toggleCondition(state, 'underweight');
    expect(rejected).toEqual(['obesity']); // unchanged

    // 4. Deselect obesity
    state = toggleCondition(state, 'obesity');
    expect(state).toEqual([]);

    // 5. Underweight is re-enabled and tappable
    expect(isConditionDisabled('underweight', state)).toBe(false);
    state = toggleCondition(state, 'underweight');
    expect(state).toEqual(['underweight']);
  });
});

// ─── getConditionToast ───────────────────────────────────

describe('getConditionToast', () => {
  test('returns mutual exclusion toast for obesity ↔ underweight', () => {
    const toast = getConditionToast('underweight', 'dog', ['obesity'], 'Buddy');
    expect(toast).toContain('already marked as Overweight');
  });

  test('returns mutual exclusion toast for hypothyroid ↔ hyperthyroid', () => {
    const toast = getConditionToast('hypothyroid', 'cat', ['hyperthyroid'], 'Luna');
    expect(toast).toContain('already marked as Hyperthyroidism');
  });

  test('returns species rarity toast for cat + hypothyroid', () => {
    const toast = getConditionToast('hypothyroid', 'cat', [], 'Luna');
    expect(toast).toContain('extremely rare in cats');
    expect(toast).toContain('Hyperthyroidism');
  });

  test('returns species rarity toast for dog + hyperthyroid', () => {
    const toast = getConditionToast('hyperthyroid', 'dog', [], 'Rex');
    expect(toast).toContain('extremely rare in dogs');
    expect(toast).toContain('Hypothyroidism');
  });

  test('returns null for valid selection (no conflict)', () => {
    expect(getConditionToast('cardiac', 'dog', ['ckd'], 'Buddy')).toBeNull();
  });

  test('returns null for hypothyroid on dog (normal)', () => {
    expect(getConditionToast('hypothyroid', 'dog', [], 'Buddy')).toBeNull();
  });

  test('returns null for hyperthyroid on cat (normal)', () => {
    expect(getConditionToast('hyperthyroid', 'cat', [], 'Luna')).toBeNull();
  });

  test('mutual exclusion takes priority over species rarity', () => {
    // Cat selecting hypothyroid when hyperthyroid is already selected
    // Should get mutual exclusion toast, not species rarity
    const toast = getConditionToast('hypothyroid', 'cat', ['hyperthyroid'], 'Luna');
    expect(toast).toContain('already marked');
  });
});

// ─── isAllergenSectionVisible ────────────────────────────

describe('isAllergenSectionVisible', () => {
  test('visible when allergy selected', () => {
    expect(isAllergenSectionVisible(['allergy'])).toBe(true);
  });

  test('visible when allergy + other conditions selected', () => {
    expect(isAllergenSectionVisible(['joint', 'allergy', 'ckd'])).toBe(true);
  });

  test('hidden when allergy not selected', () => {
    expect(isAllergenSectionVisible(['joint', 'ckd'])).toBe(false);
  });

  test('hidden when empty', () => {
    expect(isAllergenSectionVisible([])).toBe(false);
  });

  test('hidden when only Perfectly Healthy', () => {
    expect(isAllergenSectionVisible([HEALTHY_TAG])).toBe(false);
  });
});

// ─── toggleAllergen ──────────────────────────────────────

describe('toggleAllergen', () => {
  test('adding a standard allergen', () => {
    const result = toggleAllergen([], 'chicken', false);
    expect(result).toEqual([{ name: 'chicken', isCustom: false }]);
  });

  test('removing a standard allergen', () => {
    const current = [{ name: 'chicken', isCustom: false }];
    expect(toggleAllergen(current, 'chicken', false)).toEqual([]);
  });

  test('adding a custom allergen', () => {
    const result = toggleAllergen([], 'venison', true);
    expect(result).toEqual([{ name: 'venison', isCustom: true }]);
  });

  test('multi-select allergens', () => {
    let state = toggleAllergen([], 'chicken', false);
    state = toggleAllergen(state, 'beef', false);
    state = toggleAllergen(state, 'venison', true);
    expect(state).toHaveLength(3);
    expect(state).toContainEqual({ name: 'chicken', isCustom: false });
    expect(state).toContainEqual({ name: 'beef', isCustom: false });
    expect(state).toContainEqual({ name: 'venison', isCustom: true });
  });
});

// ─── removeAllergen ──────────────────────────────────────

describe('removeAllergen', () => {
  test('removes by name', () => {
    const current = [
      { name: 'chicken', isCustom: false },
      { name: 'venison', isCustom: true },
    ];
    expect(removeAllergen(current, 'venison')).toEqual([
      { name: 'chicken', isCustom: false },
    ]);
  });

  test('no-op if allergen not present', () => {
    const current = [{ name: 'chicken', isCustom: false }];
    expect(removeAllergen(current, 'beef')).toEqual(current);
  });
});

// ─── conditionsToSavePayload ─────────────────────────────

describe('conditionsToSavePayload', () => {
  test('Perfectly Healthy → empty array', () => {
    expect(conditionsToSavePayload([HEALTHY_TAG])).toEqual([]);
  });

  test('empty selection → empty array', () => {
    expect(conditionsToSavePayload([])).toEqual([]);
  });

  test('conditions preserved, sentinel filtered', () => {
    expect(conditionsToSavePayload(['joint', 'allergy'])).toEqual([
      'joint',
      'allergy',
    ]);
  });
});

// ─── allergensToSavePayload ──────────────────────────────

describe('allergensToSavePayload', () => {
  test('maps allergens to save format', () => {
    const allergens = [
      { name: 'chicken', isCustom: false },
      { name: 'venison', isCustom: true },
    ];
    expect(allergensToSavePayload(allergens)).toEqual([
      { name: 'chicken', isCustom: false },
      { name: 'venison', isCustom: true },
    ]);
  });

  test('empty array → empty array', () => {
    expect(allergensToSavePayload([])).toEqual([]);
  });
});

// ─── isProfileComplete ───────────────────────────────────

describe('isProfileComplete', () => {
  const completePet = {
    name: 'Mochi',
    species: 'dog',
    breed: 'Labrador Retriever',
    date_of_birth: '2022-03-01',
    weight_current_lbs: 65,
  };

  test('returns true for complete profile', () => {
    expect(isProfileComplete(completePet)).toBe(true);
  });

  test('returns false when name missing', () => {
    expect(isProfileComplete({ ...completePet, name: '' })).toBe(false);
  });

  test('returns false when breed is null', () => {
    expect(isProfileComplete({ ...completePet, breed: null })).toBe(false);
  });

  test('returns false when DOB is null', () => {
    expect(isProfileComplete({ ...completePet, date_of_birth: null })).toBe(false);
  });

  test('returns false when weight is null', () => {
    expect(isProfileComplete({ ...completePet, weight_current_lbs: null })).toBe(false);
  });

  test('weight 0 counts as present (presence check, not validity)', () => {
    // weight_current_lbs: 0 is invalid per validation (min 0.5)
    // but isProfileComplete checks presence (not null), not validity
    expect(isProfileComplete({ ...completePet, weight_current_lbs: 0 })).toBe(true);
  });
});
