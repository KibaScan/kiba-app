// Formatter utility tests — toDisplayName + stripBrandFromName + resolveLifeStageLabel + formatRelativeTime + getConversationalName

import {
  toDisplayName,
  stripBrandFromName,
  resolveLifeStageLabel,
  formatRelativeTime,
  getConversationalName,
  formatServing,
} from '../../src/utils/formatters';

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

  test('routes jammed canonical names through DISPLAY_NAME_OVERRIDES', () => {
    expect(toDisplayName('meatbyproducts')).toBe('Meat By-Products');
    expect(toDisplayName('poultrybyproducts')).toBe('Poultry By-Products');
    expect(toDisplayName('chickenbyproducts')).toBe('Chicken By-Products');
  });

  test('override lookup is case insensitive', () => {
    expect(toDisplayName('MEATBYPRODUCTS')).toBe('Meat By-Products');
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

// ─── getConversationalName ──────────────────────────────

describe('getConversationalName', () => {
  test('trims SEO-bloated long name to brand + 2 descriptors', () => {
    expect(
      getConversationalName({
        brand: 'Feline Natural',
        name: 'Feline Natural Chicken & Venison Feast Grain-Free Canned Cat Food, 6-oz, case of 12',
      }),
    ).toBe('Feline Natural Chicken & Venison');
  });

  test('keeps "&" token as one word when selecting descriptors', () => {
    const result = getConversationalName({
      brand: 'Feline Natural',
      name: 'Feline Natural Chicken & Venison Feast',
    });
    expect(result).toBe('Feline Natural Chicken & Venison');
  });

  test('strips comma suffix (", 6-oz, case of 12")', () => {
    const result = getConversationalName({
      brand: '9 Lives',
      name: '9 Lives Bites Real Chicken in Gravy Wet Cat Food, 5.5-oz, case of 24',
    });
    expect(result).not.toContain(',');
    expect(result).not.toContain('5.5');
    expect(result.startsWith('9 Lives')).toBe(true);
  });

  test('strips noise words ("Cat Food", "Canned", "Grain-Free")', () => {
    const result = getConversationalName({
      brand: 'Feline Natural',
      name: 'Feline Natural Chicken & Venison Grain-Free Canned Cat Food',
    });
    expect(result.toLowerCase()).not.toContain('cat food');
    expect(result.toLowerCase()).not.toContain('grain-free');
    expect(result.toLowerCase()).not.toContain('canned');
  });

  test('keeps brand + 2 descriptors when result fits under 34 chars', () => {
    const result = getConversationalName({
      brand: 'Purina Pro Plan',
      name: 'Purina Pro Plan Sensitive Skin & Stomach Adult Salmon Formula Dry Dog Food',
    });
    // "Purina Pro Plan Sensitive Skin" = 30 chars — passes cap
    expect(result).toBe('Purina Pro Plan Sensitive Skin');
  });

  test('falls back to brand + 1 descriptor when brand + 2 exceeds 34 chars', () => {
    // Long brand (24 chars) + "Salmon & Brown" descriptors = 39+ → too long.
    // Falls back to brand + 1 descriptor = "Purina Beneful Originals Salmon" (31 chars).
    const result = getConversationalName({
      brand: 'Purina Beneful Originals',
      name: 'Purina Beneful Originals Salmon & Brown Rice Recipe',
    });
    expect(result.length).toBeLessThanOrEqual(34);
    expect(result.startsWith('Purina Beneful Originals')).toBe(true);
    expect(result).toBe('Purina Beneful Originals Salmon');
  });

  test('returns brand alone when brand is already short and full name is noise', () => {
    const result = getConversationalName({
      brand: 'Acana',
      name: 'Acana Dry Dog Food Canned',
    });
    // After brand strip + noise removal, nothing meaningful left → brand alone
    expect(result).toBe('Acana');
  });

  test('handles missing brand gracefully', () => {
    const result = getConversationalName({
      brand: '',
      name: 'Generic Chicken Recipe',
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  test('handles empty name gracefully', () => {
    expect(getConversationalName({ brand: 'Blue Buffalo', name: '' })).toBe('Blue Buffalo');
  });

  test('handles both empty', () => {
    expect(getConversationalName({ brand: '', name: '' })).toBe('');
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

// ─── formatServing ────────────────────────────────────────

describe('formatServing', () => {
  test('returns "0" for null', () => {
    expect(formatServing(null)).toBe('0');
  });

  test('returns "0" for undefined', () => {
    expect(formatServing(undefined)).toBe('0');
  });

  test('returns "0" for NaN', () => {
    expect(formatServing(NaN)).toBe('0');
  });

  test('returns "0" for 0', () => {
    expect(formatServing(0)).toBe('0');
  });

  test('drops trailing zero for whole numbers', () => {
    expect(formatServing(1)).toBe('1');
    expect(formatServing(1.0)).toBe('1');
    expect(formatServing(4)).toBe('4');
  });

  test('clamps to 1 decimal place', () => {
    expect(formatServing(6.4485)).toBe('6.4');
    expect(formatServing(6.449999)).toBe('6.4');
    expect(formatServing(6.45)).toBe('6.5');
  });

  test('rounds 0.04 down to 0', () => {
    expect(formatServing(0.04)).toBe('0');
  });

  test('rounds 0.05 up to 0.1', () => {
    expect(formatServing(0.05)).toBe('0.1');
  });

  test('preserves negative values (caller responsible for validation)', () => {
    expect(formatServing(-1)).toBe('-1');
    expect(formatServing(-1.5)).toBe('-1.5');
  });
});
