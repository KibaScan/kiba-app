// TreatBatteryGauge Helper Tests — M2 Session 4
// Tests exported pure helpers from TreatBatteryGauge component.
// No render tests (no @testing-library/react-native installed).

import {
  getBarPercent,
  getBarColor,
  getStatusLabel,
} from '../../src/components/TreatBatteryGauge';

// Colors from constants.ts
const GREEN = '#34C759';
const AMBER = '#FF9500';
const RED = '#FF3B30';

// ─── getBarPercent ──────────────────────────────────────

describe('getBarPercent', () => {
  test('zero consumed → 0%', () => {
    expect(getBarPercent(0, 102)).toBe(0);
  });

  test('half consumed → 50%', () => {
    expect(getBarPercent(51, 102)).toBeCloseTo(50, 0);
  });

  test('fully consumed → 100%', () => {
    expect(getBarPercent(102, 102)).toBeCloseTo(100, 1);
  });

  test('over budget → >100%', () => {
    expect(getBarPercent(150, 100)).toBe(150);
  });

  test('zero budget → 0% (defensive)', () => {
    expect(getBarPercent(50, 0)).toBe(0);
  });

  test('negative budget → 0% (defensive)', () => {
    expect(getBarPercent(50, -10)).toBe(0);
  });
});

// ─── getBarColor ────────────────────────────────────────

describe('getBarColor', () => {
  test('0% → green', () => {
    expect(getBarColor(0)).toBe(GREEN);
  });

  test('50% → green', () => {
    expect(getBarColor(50)).toBe(GREEN);
  });

  test('exactly 80% → green (threshold is >80)', () => {
    expect(getBarColor(80)).toBe(GREEN);
  });

  test('81% → amber', () => {
    expect(getBarColor(81)).toBe(AMBER);
  });

  test('99% → amber', () => {
    expect(getBarColor(99)).toBe(AMBER);
  });

  test('exactly 100% → amber (threshold is >100)', () => {
    expect(getBarColor(100)).toBe(AMBER);
  });

  test('101% → red', () => {
    expect(getBarColor(101)).toBe(RED);
  });

  test('150% → red', () => {
    expect(getBarColor(150)).toBe(RED);
  });
});

// ─── getStatusLabel ─────────────────────────────────────

describe('getStatusLabel', () => {
  test('0% → "0% used"', () => {
    expect(getStatusLabel(0)).toBe('0% used');
  });

  test('50% → "50% used"', () => {
    expect(getStatusLabel(50)).toBe('50% used');
  });

  test('100% → "100% used"', () => {
    expect(getStatusLabel(100)).toBe('100% used');
  });

  test('rounds fractional percentages', () => {
    expect(getStatusLabel(33.3)).toBe('33% used');
    expect(getStatusLabel(66.7)).toBe('67% used');
  });

  test('101% → "Over budget"', () => {
    expect(getStatusLabel(101)).toBe('Over budget');
  });

  test('150% → "Over budget"', () => {
    expect(getStatusLabel(150)).toBe('Over budget');
  });
});
