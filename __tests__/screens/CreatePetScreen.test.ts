// Edge case tests for CreatePetScreen validation logic.
// Tests the pure validation functions from petFormValidation.ts
// which are consumed by both CreatePetScreen and EditPetScreen.

import {
  validatePetForm,
  isFormValid,
  canDeletePet,
  PetFormFields,
} from '../../src/utils/petFormValidation';

// ─── Helpers ─────────────────────────────────────────────────

function defaultFields(overrides: Partial<PetFormFields> = {}): PetFormFields {
  return {
    name: 'Buddy',
    weight: '',
    dobMode: 'exact',
    dobSet: false,
    dobMonth: new Date().getMonth(),
    dobYear: new Date().getFullYear(),
    approxYears: 0,
    approxMonths: 0,
    ...overrides,
  };
}

// ─── Name Validation ─────────────────────────────────────────

describe('Name validation', () => {
  test('empty name → error shown, save blocked', () => {
    const errors = validatePetForm(defaultFields({ name: '' }));
    expect(errors.name).toBe('Pet name is required');
    expect(isFormValid(errors)).toBe(false);
  });

  test('whitespace-only name → error shown', () => {
    const errors = validatePetForm(defaultFields({ name: '   ' }));
    expect(errors.name).toBe('Pet name is required');
    expect(isFormValid(errors)).toBe(false);
  });

  test('name with content → no error, save succeeds', () => {
    const errors = validatePetForm(defaultFields({ name: 'Buddy' }));
    expect(errors.name).toBeUndefined();
    expect(isFormValid(errors)).toBe(true);
  });

  test('name only (no optional fields) → succeeds', () => {
    const errors = validatePetForm(defaultFields({
      name: 'Rex',
      weight: '',
      dobSet: false,
    }));
    expect(isFormValid(errors)).toBe(true);
  });
});

// ─── Weight Validation ───────────────────────────────────────

describe('Weight validation', () => {
  test('weight 0.3 → error shown', () => {
    const errors = validatePetForm(defaultFields({ weight: '0.3' }));
    expect(errors.weight).toBe('Weight must be between 0.5 and 300 lbs');
    expect(isFormValid(errors)).toBe(false);
  });

  test('weight 0.4 → error shown', () => {
    const errors = validatePetForm(defaultFields({ weight: '0.4' }));
    expect(errors.weight).toBe('Weight must be between 0.5 and 300 lbs');
  });

  test('weight 0.5 → valid (lower boundary)', () => {
    const errors = validatePetForm(defaultFields({ weight: '0.5' }));
    expect(errors.weight).toBeUndefined();
  });

  test('weight 300 → valid (upper boundary)', () => {
    const errors = validatePetForm(defaultFields({ weight: '300' }));
    expect(errors.weight).toBeUndefined();
  });

  test('weight 301 → error shown', () => {
    const errors = validatePetForm(defaultFields({ weight: '301' }));
    expect(errors.weight).toBe('Weight must be between 0.5 and 300 lbs');
    expect(isFormValid(errors)).toBe(false);
  });

  test('weight empty → valid (optional field)', () => {
    const errors = validatePetForm(defaultFields({ weight: '' }));
    expect(errors.weight).toBeUndefined();
  });

  test('weight non-numeric → error shown', () => {
    const errors = validatePetForm(defaultFields({ weight: 'abc' }));
    expect(errors.weight).toBe('Weight must be between 0.5 and 300 lbs');
  });

  test('weight 50 → valid', () => {
    const errors = validatePetForm(defaultFields({ weight: '50' }));
    expect(errors.weight).toBeUndefined();
  });
});

// ─── DOB Validation — Exact Mode ─────────────────────────────

describe('DOB validation — Exact mode', () => {
  test('future date of birth → error shown', () => {
    const now = new Date();
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'exact',
      dobMonth: now.getMonth(),
      dobYear: now.getFullYear() + 1,
    }));
    expect(errors.dob).toBe('Birth date cannot be in the future');
    expect(isFormValid(errors)).toBe(false);
  });

  test('future month in current year → error shown', () => {
    const now = new Date();
    // Only test if we're not in December (can't go forward a month from Dec)
    if (now.getMonth() < 11) {
      const errors = validatePetForm(defaultFields({
        dobSet: true,
        dobMode: 'exact',
        dobMonth: now.getMonth() + 1,
        dobYear: now.getFullYear(),
      }));
      expect(errors.dob).toBe('Birth date cannot be in the future');
    }
  });

  test('current month/year → valid', () => {
    const now = new Date();
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'exact',
      dobMonth: now.getMonth(),
      dobYear: now.getFullYear(),
    }));
    expect(errors.dob).toBeUndefined();
  });

  test('past date → valid', () => {
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'exact',
      dobMonth: 0,
      dobYear: 2020,
    }));
    expect(errors.dob).toBeUndefined();
  });

  test('dobSet false → no validation applied', () => {
    const errors = validatePetForm(defaultFields({
      dobSet: false,
      dobMode: 'exact',
      dobYear: 2099,
    }));
    expect(errors.dob).toBeUndefined();
  });
});

// ─── DOB Validation — Approximate Mode ───────────────────────

describe('DOB validation — Approximate mode', () => {
  test('years 0 + months 0 → error shown', () => {
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'approximate',
      approxYears: 0,
      approxMonths: 0,
    }));
    expect(errors.dob).toBe('Please enter an approximate age');
    expect(isFormValid(errors)).toBe(false);
  });

  test('years 1 + months 0 → valid', () => {
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'approximate',
      approxYears: 1,
      approxMonths: 0,
    }));
    expect(errors.dob).toBeUndefined();
  });

  test('years 0 + months 3 → valid', () => {
    const errors = validatePetForm(defaultFields({
      dobSet: true,
      dobMode: 'approximate',
      approxYears: 0,
      approxMonths: 3,
    }));
    expect(errors.dob).toBeUndefined();
  });
});

// ─── Delete Confirmation ─────────────────────────────────────

describe('Delete confirmation', () => {
  test('wrong name typed → delete button disabled', () => {
    expect(canDeletePet('WrongName', 'Buddy')).toBe(false);
  });

  test('empty input → delete button disabled', () => {
    expect(canDeletePet('', 'Buddy')).toBe(false);
  });

  test('correct name (exact case) → delete button enabled', () => {
    expect(canDeletePet('Buddy', 'Buddy')).toBe(true);
  });

  test('correct name (case-insensitive) → delete button enabled', () => {
    expect(canDeletePet('buddy', 'Buddy')).toBe(true);
    expect(canDeletePet('BUDDY', 'Buddy')).toBe(true);
    expect(canDeletePet('bUdDy', 'Buddy')).toBe(true);
  });

  test('name with leading/trailing spaces → still matches', () => {
    expect(canDeletePet('  Buddy  ', 'Buddy')).toBe(true);
  });

  test('partial name → delete button disabled', () => {
    expect(canDeletePet('Bud', 'Buddy')).toBe(false);
  });
});

// ─── Combined Validation ─────────────────────────────────────

describe('Combined validation', () => {
  test('multiple errors returned at once', () => {
    const errors = validatePetForm(defaultFields({
      name: '',
      weight: '999',
      dobSet: true,
      dobMode: 'exact',
      dobYear: 2099,
    }));
    expect(errors.name).toBeTruthy();
    expect(errors.weight).toBeTruthy();
    expect(errors.dob).toBeTruthy();
    expect(isFormValid(errors)).toBe(false);
  });

  test('all valid fields → empty errors', () => {
    const errors = validatePetForm(defaultFields({
      name: 'Rex',
      weight: '50',
      dobSet: true,
      dobMode: 'approximate',
      approxYears: 3,
      approxMonths: 6,
    }));
    expect(isFormValid(errors)).toBe(true);
  });
});
