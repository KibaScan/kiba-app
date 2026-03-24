// Formatter utility tests — toDisplayName + stripBrandFromName + resolveLifeStageLabel + formatRelativeTime

import { toDisplayName, stripBrandFromName, resolveLifeStageLabel, formatRelativeTime } from '../../src/utils/formatters';

// ─── toDisplayName ────────────────────────────────────────

describe('toDisplayName', () => {
  test('converts snake_case to Title Case', () => {
    expect(toDisplayName('animal_fat')).toBe('Animal Fat');
  });

  test('keeps abbreviations uppercase', () => {
    expect(toDisplayName('bha')).toBe('BHA');
    expect(toDisplayName('dha')).toBe('DHA');
  });

  test('handles numbers', () => {
    expect(toDisplayName('yellow_6')).toBe('Yellow 6');
  });
});

// ─── stripBrandFromName ───────────────────────────────────

describe('stripBrandFromName', () => {
  test('strips exact case brand prefix', () => {
    expect(
      stripBrandFromName('Blue Buffalo', 'Blue Buffalo Life Protection Formula Chicken & Brown Rice'),
    ).toBe('Life Protection Formula Chicken & Brown Rice');
  });

  test('strips case-mismatched brand prefix', () => {
    expect(
      stripBrandFromName('IAMS', 'Iams ProActive Health Adult Dog Food'),
    ).toBe('ProActive Health Adult Dog Food');
  });

  test('returns original when brand not at start', () => {
    expect(
      stripBrandFromName('Purina', 'Fancy Feast Grilled Tuna in Gravy'),
    ).toBe('Fancy Feast Grilled Tuna in Gravy');
  });

  test('returns original when remainder too short', () => {
    expect(
      stripBrandFromName('Orijen', 'Orijen Cat'),
    ).toBe('Orijen Cat');
  });

  test('strips leading hyphens after brand', () => {
    expect(
      stripBrandFromName('Wellness', 'Wellness - Complete Health Adult Deboned Chicken'),
    ).toBe('Complete Health Adult Deboned Chicken');
  });

  test('handles empty brand gracefully', () => {
    expect(stripBrandFromName('', 'Some Product')).toBe('Some Product');
  });

  test('handles empty product name gracefully', () => {
    expect(stripBrandFromName('Brand', '')).toBe('');
  });

  test('strips parent brand prefix (Purina Cat Chow pattern)', () => {
    expect(
      stripBrandFromName('Cat Chow', 'Purina Cat Chow Complete with Real Chicken & Vitamins Dry Cat Food, 15-lb bag'),
    ).toBe('Complete with Real Chicken & Vitamins Dry Cat Food, 15-lb bag');
  });

  test('no false match on short brand within parent prefix', () => {
    // "Blue" (4 chars) is too short for pass-2 substring matching — returns original
    expect(
      stripBrandFromName('Blue', 'Purina Blue Buffalo Life Protection Formula'),
    ).toBe('Purina Blue Buffalo Life Protection Formula');
  });
});

// ─── resolveLifeStageLabel ──────────────────────────────

describe('resolveLifeStageLabel', () => {
  test('puppy/kitten → Puppy for dogs', () => {
    expect(resolveLifeStageLabel('puppy/kitten', 'dog')).toBe('Puppy');
  });

  test('puppy/kitten → Kitten for cats', () => {
    expect(resolveLifeStageLabel('puppy/kitten', 'cat')).toBe('Kitten');
  });

  test('all life stages → All Life Stages', () => {
    expect(resolveLifeStageLabel('all life stages', 'dog')).toBe('All Life Stages');
  });

  test('adult maintenance → Adult', () => {
    expect(resolveLifeStageLabel('adult maintenance', 'cat')).toBe('Adult');
  });

  test('growth → Growth', () => {
    expect(resolveLifeStageLabel('growth', 'dog')).toBe('Growth');
  });

  test('case insensitive matching', () => {
    expect(resolveLifeStageLabel('ALL LIFE STAGES', 'dog')).toBe('All Life Stages');
    expect(resolveLifeStageLabel('Puppy/Kitten', 'cat')).toBe('Kitten');
  });

  test('trims whitespace', () => {
    expect(resolveLifeStageLabel('  adult  ', 'dog')).toBe('Adult');
  });

  test('unknown value passed through as title case', () => {
    expect(resolveLifeStageLabel('gestation/lactation', 'dog')).toBe('Gestation/Lactation');
  });

  test('long value truncated at 20 chars', () => {
    const long = 'adult maintenance and growth for large breed dogs';
    const result = resolveLifeStageLabel(long, 'dog');
    expect(result.length).toBeLessThanOrEqual(21); // 20 + ellipsis char
    expect(result.endsWith('\u2026')).toBe(true);
  });
});

// ─── formatRelativeTime ─────────────────────────────────

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-03-23T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('less than 1 minute ago → Just now', () => {
    expect(formatRelativeTime('2026-03-23T11:59:30Z')).toBe('Just now');
  });

  test('minutes ago', () => {
    expect(formatRelativeTime('2026-03-23T11:55:00Z')).toBe('5m ago');
  });

  test('hours ago', () => {
    expect(formatRelativeTime('2026-03-23T10:00:00Z')).toBe('2h ago');
  });

  test('yesterday (calendar day)', () => {
    expect(formatRelativeTime('2026-03-22T20:00:00Z')).toBe('Yesterday');
  });

  test('days ago (2-6)', () => {
    expect(formatRelativeTime('2026-03-20T12:00:00Z')).toBe('3d ago');
  });

  test('older than 6 days → short date', () => {
    expect(formatRelativeTime('2026-03-15T10:00:00Z')).toBe('Mar 15');
  });

  test('much older date', () => {
    expect(formatRelativeTime('2026-01-05T08:00:00Z')).toBe('Jan 5');
  });
});
