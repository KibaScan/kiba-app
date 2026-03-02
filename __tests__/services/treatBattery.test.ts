// Treat Battery Tests — M2 Session 4
// D-060: Treat budget = 10% of DER (veterinary standard).
// Spec: PORTION_CALCULATOR_SPEC.md §9.

import {
  calculateTreatBudget,
  calculateTreatsPerDay,
} from '../../src/services/treatBattery';

// ─── calculateTreatBudget ─────────────────────────────────

describe('calculateTreatBudget', () => {
  test('10% of DER exactly', () => {
    expect(calculateTreatBudget(1018)).toBe(102);  // Buster 50lb dog
    expect(calculateTreatBudget(218)).toBe(22);     // Luna 10lb cat
  });

  test('rounds to nearest integer', () => {
    expect(calculateTreatBudget(1015)).toBe(102);   // 101.5 → 102
    expect(calculateTreatBudget(1014)).toBe(101);   // 101.4 → 101
  });

  test('zero DER → zero budget', () => {
    expect(calculateTreatBudget(0)).toBe(0);
  });
});

// ─── calculateTreatsPerDay ────────────────────────────────

describe('calculateTreatsPerDay', () => {
  test('floor rounding: 22 kcal budget, 7 kcal treat → 3', () => {
    const result = calculateTreatsPerDay(22, 7);
    expect(result.count).toBe(3);      // 22/7 = 3.14 → floor to 3
    expect(result.warning).toBe(false);
  });

  test('budget 102, treat 15 → count 6', () => {
    const result = calculateTreatsPerDay(102, 15);
    expect(result.count).toBe(6);      // 102/15 = 6.8 → floor to 6
    expect(result.warning).toBe(false);
  });

  test('single treat exceeds budget → count 0, warning true', () => {
    const result = calculateTreatsPerDay(20, 25);
    expect(result.count).toBe(0);
    expect(result.warning).toBe(true);
  });

  test('exact match: budget 100, treat 100 → count 1, no warning', () => {
    const result = calculateTreatsPerDay(100, 100);
    expect(result.count).toBe(1);
    expect(result.warning).toBe(false);
  });

  test('just under: budget 99, treat 100 → count 0, warning', () => {
    const result = calculateTreatsPerDay(99, 100);
    expect(result.count).toBe(0);
    expect(result.warning).toBe(true);
  });

  test('zero budget → count 0, warning true', () => {
    const result = calculateTreatsPerDay(0, 10);
    expect(result.count).toBe(0);
    expect(result.warning).toBe(true);
  });

  test('zero/negative kcal per treat → count 0, no warning (defensive)', () => {
    expect(calculateTreatsPerDay(100, 0)).toEqual({ count: 0, warning: false });
    expect(calculateTreatsPerDay(100, -5)).toEqual({ count: 0, warning: false });
  });
});
