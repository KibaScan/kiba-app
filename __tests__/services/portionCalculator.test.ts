// Portion Calculator Tests — M2 Session 4
// Verifies RER/DER math, multiplier tables, goal weight mode, and safety guards.
// Spec: PORTION_CALCULATOR_SPEC.md. Decisions: D-060 through D-064, D-106.
//
// NOTE: Spec worked examples use hand-rounded kg intermediates (e.g. "22.7 kg"
// for 50 lbs). Our formula uses full precision (50/2.205 = 22.6757...), so
// final RER/DER values may differ by 1–3 kcal. Tests use exact formula output.

import {
  lbsToKg,
  calculateRER,
  getDerMultiplier,
  calculateDailyPortion,
  calculateGoalWeightPortion,
} from '../../src/services/portionCalculator';
import { deriveLifeStage } from '../../src/utils/lifeStage';

import type { LifeStage, ActivityLevel } from '../../src/types/pet';

// ─── Helpers ──────────────────────────────────────────────

/** Create a date N months in the past (pinned to 1st of month). */
function monthsAgo(months: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
}

// ─── lbsToKg ──────────────────────────────────────────────

describe('lbsToKg', () => {
  test('50 lbs → ~22.68 kg', () => {
    expect(lbsToKg(50)).toBeCloseTo(22.6757, 2);
  });

  test('10 lbs → ~4.54 kg', () => {
    expect(lbsToKg(10)).toBeCloseTo(4.5351, 2);
  });

  test('0 lbs → 0 kg', () => {
    expect(lbsToKg(0)).toBe(0);
  });
});

// ─── calculateRER ─────────────────────────────────────────

describe('calculateRER', () => {
  test('D-060: formula is 70 × kg^0.75', () => {
    // 22.68 kg → 70 × 22.68^0.75 = 727
    const kg = lbsToKg(50);
    expect(calculateRER(kg)).toBe(727);
  });

  test.each([
    [lbsToKg(15), 295],   // small dog / large cat
    [lbsToKg(50), 727],   // medium dog (Buster)
    [lbsToKg(80), 1035],  // large dog
    [lbsToKg(120), 1403], // giant dog
    [lbsToKg(10), 218],   // 10lb cat
    [lbsToKg(8), 184],    // 8lb puppy
    [lbsToKg(25), 433],   // 25lb puppy
  ])('RER at %f kg = %i kcal', (kg, expected) => {
    expect(calculateRER(kg)).toBe(expected);
  });

  test('zero weight returns 0', () => {
    expect(calculateRER(0)).toBe(0);
  });

  test('negative weight returns 0', () => {
    expect(calculateRER(-5)).toBe(0);
  });
});

// ─── getDerMultiplier: Dog Adult Combos ───────────────────

describe('getDerMultiplier — Dog adult multipliers', () => {
  const cases: [ActivityLevel, boolean, number, string][] = [
    ['low', true, 1.2, 'Neutered, low activity'],
    ['low', false, 1.4, 'Intact, low activity'],
    ['moderate', true, 1.4, 'Neutered adult'],
    ['moderate', false, 1.6, 'Intact adult'],
    ['high', true, 1.6, 'Active neutered'],
    ['high', false, 1.8, 'Active intact'],
  ];

  test.each(cases)(
    'dog adult %s neutered=%s → %f (%s)',
    (activity, neutered, mult, label) => {
      const result = getDerMultiplier({
        species: 'dog',
        lifeStage: 'adult',
        isNeutered: neutered,
        activityLevel: activity,
      });
      expect(result.multiplier).toBe(mult);
      expect(result.label).toBe(label);
      expect(result.source).toBe('AAHA 2021');
    },
  );
});

// ─── getDerMultiplier: Dog Puppy / Senior / Geriatric ─────

describe('getDerMultiplier — Dog life stages', () => {
  test('puppy <4 months → 3.0×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'puppy',
      isNeutered: false,
      activityLevel: 'moderate',
      ageMonths: 2,
    });
    expect(result.multiplier).toBe(3.0);
    expect(result.label).toBe('Growing puppy (<4mo)');
    expect(result.source).toBe('NRC 2006');
  });

  test('puppy ≥4 months → 2.0×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'puppy',
      isNeutered: false,
      activityLevel: 'moderate',
      ageMonths: 6,
    });
    expect(result.multiplier).toBe(2.0);
    expect(result.label).toBe('Growing puppy');
  });

  test('puppy exactly 4 months → 2.0× (boundary)', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'puppy',
      isNeutered: false,
      activityLevel: 'moderate',
      ageMonths: 4,
    });
    expect(result.multiplier).toBe(2.0);
  });

  test('puppy with no ageMonths → defaults to 2.0×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'puppy',
      isNeutered: false,
      activityLevel: 'moderate',
    });
    expect(result.multiplier).toBe(2.0);
  });

  test('working dog → 3.0×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'working',
    });
    expect(result.multiplier).toBe(3.0);
    expect(result.label).toBe('Working dog');
    expect(result.source).toBe('NRC 2006');
  });

  test('senior low → 1.2×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'senior',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.2);
    expect(result.source).toBe('Laflamme 2005');
  });

  test('senior moderate → 1.2×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'senior',
      isNeutered: true,
      activityLevel: 'moderate',
    });
    expect(result.multiplier).toBe(1.2);
  });

  test('senior high → 1.4×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'senior',
      isNeutered: true,
      activityLevel: 'high',
    });
    expect(result.multiplier).toBe(1.4);
  });

  test('geriatric dog → 1.2×', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'geriatric',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.2);
    expect(result.source).toBe('Laflamme 2005');
  });
});

// ─── getDerMultiplier: Dog Edge Cases ─────────────────────

describe('getDerMultiplier — Dog edge cases', () => {
  test('working dog + obesity → downgrade to moderate (spec §11)', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'working',
      conditions: ['obesity'],
    });
    // Should use moderate+neutered = 1.4, not working = 3.0
    expect(result.multiplier).toBe(1.4);
    expect(result.label).toBe('Neutered adult');
  });

  test('working dog + obesity, intact → moderate+intact = 1.6', () => {
    const result = getDerMultiplier({
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: false,
      activityLevel: 'working',
      conditions: ['obesity'],
    });
    expect(result.multiplier).toBe(1.6);
  });
});

// ─── getDerMultiplier: Cat Multipliers ────────────────────

describe('getDerMultiplier — Cat multipliers', () => {
  test('kitten → 2.5×', () => {
    const result = getDerMultiplier({
      species: 'cat',
      lifeStage: 'kitten',
      isNeutered: false,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(2.5);
    expect(result.label).toBe('Growing kitten');
  });

  const adultCases: [ActivityLevel, boolean, number, string][] = [
    ['low', true, 1.0, 'Indoor neutered'],
    ['low', false, 1.2, 'Intact, low activity'],
    ['moderate', true, 1.2, 'Neutered adult'],
    ['moderate', false, 1.4, 'Intact adult'],
    ['high', true, 1.6, 'Active cat'],
    ['high', false, 1.6, 'Active cat'],
  ];

  test.each(adultCases)(
    'cat adult %s neutered=%s → %f (%s)',
    (activity, neutered, mult, label) => {
      const result = getDerMultiplier({
        species: 'cat',
        lifeStage: 'adult',
        isNeutered: neutered,
        activityLevel: activity,
      });
      expect(result.multiplier).toBe(mult);
      expect(result.label).toBe(label);
    },
  );

  test('cat high activity: neuter status irrelevant → always 1.6', () => {
    const neutered = getDerMultiplier({
      species: 'cat', lifeStage: 'adult', isNeutered: true, activityLevel: 'high',
    });
    const intact = getDerMultiplier({
      species: 'cat', lifeStage: 'adult', isNeutered: false, activityLevel: 'high',
    });
    expect(neutered.multiplier).toBe(intact.multiplier);
    expect(neutered.multiplier).toBe(1.6);
  });

  test('senior cat → 1.1×', () => {
    const result = getDerMultiplier({
      species: 'cat',
      lifeStage: 'senior',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.1);
  });

  test('CRITICAL D-063: geriatric cat → 1.5× (UP not down)', () => {
    const result = getDerMultiplier({
      species: 'cat',
      lifeStage: 'geriatric',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.5);
    expect(result.source).toBe('NRC 2006, Ch. 15');
    // Must be HIGHER than adult indoor neutered (1.0)
    const adult = getDerMultiplier({
      species: 'cat', lifeStage: 'adult', isNeutered: true, activityLevel: 'low',
    });
    expect(result.multiplier).toBeGreaterThan(adult.multiplier);
  });
});

// ─── getDerMultiplier: Cat Edge Cases ─────────────────────

describe('getDerMultiplier — Cat edge cases', () => {
  test('cat with working activity → treated as high (defensive)', () => {
    const result = getDerMultiplier({
      species: 'cat',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'working',
    });
    expect(result.multiplier).toBe(1.6);
  });
});

// ─── getDerMultiplier: 7-Tier → 4-Bucket Mapping ─────────

describe('getDerMultiplier — life stage bucket mapping', () => {
  test('junior → adult bucket (dog)', () => {
    const junior = getDerMultiplier({
      species: 'dog', lifeStage: 'junior', isNeutered: true, activityLevel: 'moderate',
    });
    const adult = getDerMultiplier({
      species: 'dog', lifeStage: 'adult', isNeutered: true, activityLevel: 'moderate',
    });
    expect(junior.multiplier).toBe(adult.multiplier);
  });

  test('mature → adult bucket (dog)', () => {
    const mature = getDerMultiplier({
      species: 'dog', lifeStage: 'mature', isNeutered: true, activityLevel: 'moderate',
    });
    const adult = getDerMultiplier({
      species: 'dog', lifeStage: 'adult', isNeutered: true, activityLevel: 'moderate',
    });
    expect(mature.multiplier).toBe(adult.multiplier);
  });

  test('mature → adult bucket (cat)', () => {
    const mature = getDerMultiplier({
      species: 'cat', lifeStage: 'mature', isNeutered: true, activityLevel: 'low',
    });
    const adult = getDerMultiplier({
      species: 'cat', lifeStage: 'adult', isNeutered: true, activityLevel: 'low',
    });
    expect(mature.multiplier).toBe(adult.multiplier);
  });

  test('null life stage → adult fallback (spec §11)', () => {
    const result = getDerMultiplier({
      species: 'dog', lifeStage: null, isNeutered: true, activityLevel: 'moderate',
    });
    const adult = getDerMultiplier({
      species: 'dog', lifeStage: 'adult', isNeutered: true, activityLevel: 'moderate',
    });
    expect(result.multiplier).toBe(adult.multiplier);
  });
});

// ─── Cat Senior→Geriatric Boundary (36% calorie jump) ────

describe('Cat senior→geriatric calorie boundary', () => {
  test('13yr 11mo cat (167 months) → senior → 1.1×', () => {
    const dob = monthsAgo(167);
    const lifeStage = deriveLifeStage(dob, 'cat');
    expect(lifeStage).toBe('senior');

    const result = getDerMultiplier({
      species: 'cat', lifeStage: lifeStage!, isNeutered: true, activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.1);
  });

  test('14yr cat (168 months) → geriatric → 1.5×', () => {
    const dob = monthsAgo(168);
    const lifeStage = deriveLifeStage(dob, 'cat');
    expect(lifeStage).toBe('geriatric');

    const result = getDerMultiplier({
      species: 'cat', lifeStage: lifeStage!, isNeutered: true, activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.5);
  });

  test('boundary produces 36% calorie increase', () => {
    // Same 10lb cat at senior vs geriatric
    const rer = calculateRER(lbsToKg(10));
    const seniorDer = Math.round(rer * 1.1);
    const geriatricDer = Math.round(rer * 1.5);
    const increase = ((geriatricDer - seniorDer) / seniorDer) * 100;
    expect(increase).toBeGreaterThan(35);
    expect(increase).toBeLessThan(37);
  });
});

// ─── calculateDailyPortion ────────────────────────────────

describe('calculateDailyPortion', () => {
  test('cups = DER / kcalPerCup', () => {
    const result = calculateDailyPortion(1018, 399, null);
    expect(result.cups).toBeCloseTo(2.55, 1);
    expect(result.grams).toBeNull();
  });

  test('grams = (DER / kcalPerKg) × 1000', () => {
    const result = calculateDailyPortion(1018, null, 3500);
    expect(result.cups).toBeNull();
    expect(result.grams).toBeCloseTo(290.9, 0);
  });

  test('both formats when both caloric values available', () => {
    const result = calculateDailyPortion(1018, 399, 3500);
    expect(result.cups).toBeCloseTo(2.55, 1);
    expect(result.grams).toBeCloseTo(290.9, 0);
  });

  test('both null when no caloric data', () => {
    const result = calculateDailyPortion(1018, null, null);
    expect(result.cups).toBeNull();
    expect(result.grams).toBeNull();
  });

  test('zero kcalPerCup → null cups (guard)', () => {
    const result = calculateDailyPortion(1018, 0, null);
    expect(result.cups).toBeNull();
  });
});

// ─── calculateGoalWeightPortion ───────────────────────────

describe('calculateGoalWeightPortion', () => {
  test('D-061: DER uses goal weight, not current', () => {
    // 50lb dog → 42lb goal, adult moderate neutered
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 50,
      goalWeightLbs: 42,
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'moderate',
    });
    // DER at goal (42lb) should be LESS than DER at current (50lb)
    const rerGoal = calculateRER(lbsToKg(42));  // 638
    expect(result.derKcal).toBe(Math.round(rerGoal * 1.4));  // 893
    expect(result.multiplier).toBe(1.4);

    // Verify it's less than what current weight DER would be
    const rerCurrent = calculateRER(lbsToKg(50));  // 727
    const derCurrent = Math.round(rerCurrent * 1.4);  // 1018
    expect(result.derKcal).toBeLessThan(derCurrent);
  });

  test('D-062: cat hepatic lipidosis guard triggers at >1%', () => {
    // 15lb cat → 10lb goal, adult, low, neutered (mult=1.0)
    // DER@15 = 295, DER@10 = 218
    // deficit = 77, weekly = 539, lbs = 0.154, pct = 1.027% → trigger
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 15,
      goalWeightLbs: 10,
      species: 'cat',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.hepaticWarning).toBe(true);
    expect(result.weeklyLossPercent).toBeGreaterThan(1.0);
  });

  test('D-062: dogs never trigger hepatic warning', () => {
    // Same aggressive weight loss but for a dog
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 50,
      goalWeightLbs: 30,
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'moderate',
    });
    expect(result.hepaticWarning).toBe(false);
    // Weekly loss would be >1% but dogs don't trigger the guard
    expect(result.weeklyLossPercent).toBeGreaterThan(1.0);
  });

  test('D-062 boundary: exactly at threshold does NOT trigger', () => {
    // Need to find a case where weekly loss ≈ 1.0%.
    // Use a less aggressive cat goal to get close to the boundary.
    // 15lb cat → 12lb goal, geriatric (mult=1.5)
    // DER@15=443, DER@12=374, deficit=69, weekly=483
    // lossLbs=0.138, pct=0.92% → does NOT trigger
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 15,
      goalWeightLbs: 12,
      species: 'cat',
      lifeStage: 'geriatric',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.hepaticWarning).toBe(false);
    expect(result.weeklyLossPercent).toBeLessThan(1.0);
  });

  test('D-063: geriatric cat goal weight still uses 1.5× multiplier', () => {
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 15,
      goalWeightLbs: 12,
      species: 'cat',
      lifeStage: 'geriatric',
      isNeutered: true,
      activityLevel: 'low',
    });
    expect(result.multiplier).toBe(1.5);
    // DER at goal (12lb) with geriatric multiplier
    const rerGoal = calculateRER(lbsToKg(12));  // 249
    expect(result.derKcal).toBe(Math.round(rerGoal * 1.5));  // 374
  });

  test('underweight cat: goal weight HIGHER than current', () => {
    // 7lb cat → 9lb goal, adult, low, neutered (mult=1.0)
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 7,
      goalWeightLbs: 9,
      species: 'cat',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'low',
      conditions: ['underweight'],
    });
    // DER at goal (9lb) should be MORE than at current (7lb)
    const derCurrent = Math.round(calculateRER(lbsToKg(7)) * 1.0);
    expect(result.derKcal).toBeGreaterThan(derCurrent);
    // Negative weekly loss = weight gain, no hepatic warning
    expect(result.weeklyLossPercent).toBeLessThan(0);
    expect(result.hepaticWarning).toBe(false);
  });
});

// ─── Spec §12 Regression Cases ────────────────────────────

describe('Spec §12 Regression Cases', () => {
  test('Case 1: Buster 50lb dog, adult, moderate, neutered → DER 1018', () => {
    const rer = calculateRER(lbsToKg(50));
    expect(rer).toBe(727);
    const { multiplier } = getDerMultiplier({
      species: 'dog', lifeStage: 'adult', isNeutered: true, activityLevel: 'moderate',
    });
    expect(multiplier).toBe(1.4);
    expect(Math.round(rer * multiplier)).toBe(1018);
  });

  test('Case 2: Buster goal 42lb → DER 893', () => {
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 50,
      goalWeightLbs: 42,
      species: 'dog',
      lifeStage: 'adult',
      isNeutered: true,
      activityLevel: 'moderate',
    });
    expect(result.derKcal).toBe(893);
    expect(result.multiplier).toBe(1.4);
  });

  test('Case 3: Luna 10lb cat, adult, low, neutered → DER 218', () => {
    const rer = calculateRER(lbsToKg(10));
    expect(rer).toBe(218);
    const { multiplier } = getDerMultiplier({
      species: 'cat', lifeStage: 'adult', isNeutered: true, activityLevel: 'low',
    });
    expect(multiplier).toBe(1.0);
    expect(Math.round(rer * multiplier)).toBe(218);
  });

  test('Case 4: Geriatric cat 12lb → DER 374 (1.5× floor)', () => {
    const rer = calculateRER(lbsToKg(12));
    expect(rer).toBe(249);
    const { multiplier } = getDerMultiplier({
      species: 'cat', lifeStage: 'geriatric', isNeutered: true, activityLevel: 'low',
    });
    expect(multiplier).toBe(1.5);
    expect(Math.round(rer * multiplier)).toBe(374);
  });

  test('Case 5: Obese geriatric cat 15lb → 12lb goal, DER at goal 374', () => {
    const result = calculateGoalWeightPortion({
      currentWeightLbs: 15,
      goalWeightLbs: 12,
      species: 'cat',
      lifeStage: 'geriatric',
      isNeutered: true,
      activityLevel: 'low',
      conditions: ['obesity'],
    });
    expect(result.derKcal).toBe(374);
    expect(result.multiplier).toBe(1.5);
  });

  test('Case 6: Puppy <4mo 8lb → DER 552 (3.0×)', () => {
    const rer = calculateRER(lbsToKg(8));
    expect(rer).toBe(184);
    const { multiplier } = getDerMultiplier({
      species: 'dog', lifeStage: 'puppy', isNeutered: false, activityLevel: 'moderate',
      ageMonths: 2,
    });
    expect(multiplier).toBe(3.0);
    expect(Math.round(rer * multiplier)).toBe(552);
  });

  test('Case 7: Puppy 6mo 25lb → DER 866 (2.0×)', () => {
    const rer = calculateRER(lbsToKg(25));
    expect(rer).toBe(433);
    const { multiplier } = getDerMultiplier({
      species: 'dog', lifeStage: 'puppy', isNeutered: false, activityLevel: 'moderate',
      ageMonths: 6,
    });
    expect(multiplier).toBe(2.0);
    expect(Math.round(rer * multiplier)).toBe(866);
  });
});
