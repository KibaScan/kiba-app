// HealthConditionAdvisories — pure logic tests
// No render tests (no @testing-library/react-native installed).
// Tests the advisory data lookup and zero-out detection logic.

import { getConditionAdvisory } from '../../../src/data/conditionAdvisories';
import type { PersonalizationDetail } from '../../../src/types/scoring';

// ─── Advisory Data Tests ────────────────────────────────

describe('getConditionAdvisory', () => {
  it('returns dog pancreatitis advisory with pet name', () => {
    const advisory = getConditionAdvisory('pancreatitis', 'dog', 'Buddy');
    expect(advisory).toContain('Buddy');
    expect(advisory).toContain('High-fat foods');
  });

  it('returns cat pancreatitis advisory (different from dog)', () => {
    const advisory = getConditionAdvisory('pancreatitis', 'cat', 'Luna');
    expect(advisory).toContain('Luna');
    expect(advisory).toContain('feline pancreatitis');
    expect(advisory).not.toContain('high-fat foods can trigger life-threatening');
  });

  it('returns null for hypothyroid + cat (no advisory)', () => {
    expect(getConditionAdvisory('hypothyroid', 'cat', 'Luna')).toBeNull();
  });

  it('returns null for hyperthyroid + dog (no advisory)', () => {
    expect(getConditionAdvisory('hyperthyroid', 'dog', 'Rex')).toBeNull();
  });

  it('returns advisory for all 12 conditions on their primary species', () => {
    const dogConditions = ['joint', 'gi_sensitive', 'obesity', 'underweight', 'diabetes', 'pancreatitis', 'ckd', 'cardiac', 'urinary', 'skin', 'hypothyroid'];
    const catConditions = ['joint', 'gi_sensitive', 'obesity', 'underweight', 'diabetes', 'pancreatitis', 'ckd', 'cardiac', 'urinary', 'skin', 'hyperthyroid'];

    for (const cond of dogConditions) {
      const advisory = getConditionAdvisory(cond, 'dog', 'Test');
      expect(advisory).not.toBeNull();
    }

    for (const cond of catConditions) {
      const advisory = getConditionAdvisory(cond, 'cat', 'Test');
      expect(advisory).not.toBeNull();
    }
  });

  it('replaces all {petName} occurrences', () => {
    const advisory = getConditionAdvisory('obesity', 'dog', 'Mochi');
    expect(advisory).toContain('Mochi');
    expect(advisory).not.toContain('{petName}');
  });

  it('returns null for unknown condition', () => {
    expect(getConditionAdvisory('nonexistent', 'dog', 'Test')).toBeNull();
  });
});

// ─── Zero-Out Detection Logic ───────────────────────────

describe('cardiac DCM zero-out detection', () => {
  function isCardiacDcmZeroOut(
    finalScore: number,
    personalizations: PersonalizationDetail[],
  ): boolean {
    if (finalScore !== 0) return false;
    return personalizations.some(
      (p) => p.type === 'condition' && p.label.includes('DCM'),
    );
  }

  it('detects zero-out when score=0 and DCM in personalization label', () => {
    const result = isCardiacDcmZeroOut(0, [
      {
        type: 'condition',
        label: 'Food triggers DCM pulse advisory — not suitable for dogs with heart disease',
        adjustment: 0,
        petName: 'Buddy',
      },
    ]);
    expect(result).toBe(true);
  });

  it('does not fire when score > 0', () => {
    const result = isCardiacDcmZeroOut(45, [
      {
        type: 'condition',
        label: 'Food triggers DCM pulse advisory',
        adjustment: 0,
        petName: 'Buddy',
      },
    ]);
    expect(result).toBe(false);
  });

  it('does not fire when score=0 but no DCM label', () => {
    const result = isCardiacDcmZeroOut(0, [
      {
        type: 'condition',
        label: 'Sodium content elevated (-3)',
        adjustment: -3,
        petName: 'Buddy',
      },
    ]);
    expect(result).toBe(false);
  });

  it('does not fire on non-condition personalization', () => {
    const result = isCardiacDcmZeroOut(0, [
      {
        type: 'breed',
        label: 'DCM susceptible breed',
        adjustment: 0,
        petName: 'Buddy',
      },
    ]);
    expect(result).toBe(false);
  });

  it('does not fire on empty personalizations', () => {
    expect(isCardiacDcmZeroOut(0, [])).toBe(false);
  });
});
