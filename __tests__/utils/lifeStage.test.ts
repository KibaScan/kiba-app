import { deriveLifeStage, deriveBreedSize, synthesizeDob, getDerLifeStage } from '../../src/utils/lifeStage';
import type { LifeStage } from '../../src/types/pet';

// ─── Helpers ──────────────────────────────────────────────

/** Create a Date that is `months` months before now */
function monthsAgo(months: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
}

// ─── deriveLifeStage: Dogs ───────────────────────────────

describe('deriveLifeStage — Dogs', () => {
  test('6-month-old medium dog → puppy', () => {
    expect(deriveLifeStage(monthsAgo(6), 'dog', 'medium')).toBe('puppy');
  });

  test('14-month-old medium dog → junior', () => {
    expect(deriveLifeStage(monthsAgo(14), 'dog', 'medium')).toBe('junior');
  });

  test('36-month-old medium dog → adult', () => {
    expect(deriveLifeStage(monthsAgo(36), 'dog', 'medium')).toBe('adult');
  });

  test('96-month-old medium dog (8yr) → mature', () => {
    expect(deriveLifeStage(monthsAgo(96), 'dog', 'medium')).toBe('mature');
  });

  test('132-month-old medium dog (11yr) → senior', () => {
    expect(deriveLifeStage(monthsAgo(132), 'dog', 'medium')).toBe('senior');
  });

  test('168-month-old medium dog (14yr) → geriatric', () => {
    expect(deriveLifeStage(monthsAgo(168), 'dog', 'medium')).toBe('geriatric');
  });

  test('giant breed puppy threshold is 18mo, not 12mo', () => {
    // 15 months — still puppy for giant, junior for medium
    expect(deriveLifeStage(monthsAgo(15), 'dog', 'giant')).toBe('puppy');
    expect(deriveLifeStage(monthsAgo(15), 'dog', 'medium')).toBe('junior');
  });

  test('giant breed geriatric starts at 10yr (120mo)', () => {
    expect(deriveLifeStage(monthsAgo(120), 'dog', 'giant')).toBe('geriatric');
    // medium dog at 120mo (10yr) crosses into senior (mature_end = 120)
    expect(deriveLifeStage(monthsAgo(120), 'dog', 'medium')).toBe('senior');
    // medium dog at 119mo is still mature
    expect(deriveLifeStage(monthsAgo(119), 'dog', 'medium')).toBe('mature');
  });

  test('large breed adult ends at 6yr (72mo)', () => {
    expect(deriveLifeStage(monthsAgo(72), 'dog', 'large')).toBe('mature');
    expect(deriveLifeStage(monthsAgo(72), 'dog', 'medium')).toBe('adult');
  });
});

// ─── deriveLifeStage: Cats ───────────────────────────────

describe('deriveLifeStage — Cats', () => {
  test('6-month-old cat → kitten', () => {
    expect(deriveLifeStage(monthsAgo(6), 'cat')).toBe('kitten');
  });

  test('18-month-old cat → junior', () => {
    expect(deriveLifeStage(monthsAgo(18), 'cat')).toBe('junior');
  });

  test('48-month-old cat (4yr) → adult', () => {
    expect(deriveLifeStage(monthsAgo(48), 'cat')).toBe('adult');
  });

  test('96-month-old cat (8yr) → mature', () => {
    expect(deriveLifeStage(monthsAgo(96), 'cat')).toBe('mature');
  });

  test('144-month-old cat (12yr) → senior', () => {
    expect(deriveLifeStage(monthsAgo(144), 'cat')).toBe('senior');
  });

  test('180-month-old cat (15yr) → geriatric', () => {
    expect(deriveLifeStage(monthsAgo(180), 'cat')).toBe('geriatric');
  });
});

// ─── deriveLifeStage: Edge Cases ─────────────────────────

describe('deriveLifeStage — Edge Cases', () => {
  test('null DOB → null', () => {
    expect(deriveLifeStage(null, 'dog', 'medium')).toBeNull();
  });

  test('null breedSize for dogs → defaults to medium', () => {
    // 14 months — junior for medium
    expect(deriveLifeStage(monthsAgo(14), 'dog', null)).toBe('junior');
    expect(deriveLifeStage(monthsAgo(14), 'dog')).toBe('junior');
  });

  test('breedSize ignored for cats', () => {
    // breedSize passed but should be ignored
    expect(deriveLifeStage(monthsAgo(6), 'cat', 'giant')).toBe('kitten');
  });
});

// ─── synthesizeDob ───────────────────────────────────────

describe('synthesizeDob', () => {
  test('2 years 3 months → DOB approximately 27 months ago, pinned to 1st', () => {
    const dob = synthesizeDob(2, 3);
    const now = new Date();
    const expectedMonth = now.getMonth() - 27;
    const expected = new Date(now.getFullYear(), expectedMonth, 1);
    expect(dob.getFullYear()).toBe(expected.getFullYear());
    expect(dob.getMonth()).toBe(expected.getMonth());
    expect(dob.getDate()).toBe(1);
  });

  test('0 years 0 months → today pinned to 1st', () => {
    const dob = synthesizeDob(0, 0);
    const now = new Date();
    expect(dob.getFullYear()).toBe(now.getFullYear());
    expect(dob.getMonth()).toBe(now.getMonth());
    expect(dob.getDate()).toBe(1);
  });

  test('synthesized DOB feeds correctly into deriveLifeStage', () => {
    const dob = synthesizeDob(3, 0); // 3 years old
    expect(deriveLifeStage(dob, 'dog', 'medium')).toBe('adult');
    expect(deriveLifeStage(dob, 'cat')).toBe('adult');
  });
});

// ─── deriveBreedSize ─────────────────────────────────────

describe('deriveBreedSize', () => {
  test('null weight → medium (default)', () => {
    expect(deriveBreedSize(null)).toBe('medium');
  });

  test('<25 lbs → small', () => {
    expect(deriveBreedSize(10)).toBe('small');
    expect(deriveBreedSize(24.9)).toBe('small');
  });

  test('25 lbs → medium (inclusive lower bound)', () => {
    expect(deriveBreedSize(25)).toBe('medium');
  });

  test('55 lbs → medium (inclusive upper bound)', () => {
    expect(deriveBreedSize(55)).toBe('medium');
  });

  test('55.1 lbs → large', () => {
    expect(deriveBreedSize(55.1)).toBe('large');
  });

  test('90 lbs → large (inclusive upper bound)', () => {
    expect(deriveBreedSize(90)).toBe('large');
  });

  test('>90 lbs → giant', () => {
    expect(deriveBreedSize(91)).toBe('giant');
    expect(deriveBreedSize(150)).toBe('giant');
  });
});

// ─── getDerLifeStage ─────────────────────────────────────

describe('getDerLifeStage', () => {
  const cases: [LifeStage, 'puppy' | 'adult' | 'senior' | 'geriatric'][] = [
    ['puppy', 'puppy'],
    ['kitten', 'puppy'],
    ['junior', 'adult'],
    ['adult', 'adult'],
    ['mature', 'adult'],
    ['senior', 'senior'],
    ['geriatric', 'geriatric'],
  ];

  test.each(cases)('%s → %s', (input, expected) => {
    expect(getDerLifeStage(input)).toBe(expected);
  });
});
