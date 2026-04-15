// Weight Goal — Pure helper tests for D-160 weight goal slider.

import {
  getAdjustedDER,
  getAvailableLevels,
  estimateWeeklyChange,
  getCalorieContext,
  shouldClampLevel,
  WEIGHT_GOAL_MULTIPLIERS,
  WEIGHT_GOAL_LABELS,
  ALL_LEVELS,
  KCAL_PER_LB,
} from '../../src/utils/weightGoal';

// ─── getAdjustedDER ─────────────────────────────────────

describe('getAdjustedDER', () => {
  const baseDER = 1000;

  test('level 0 returns base DER unchanged', () => {
    expect(getAdjustedDER(baseDER, 0)).toBe(1000);
  });

  test('level -3 applies 0.80 multiplier', () => {
    expect(getAdjustedDER(baseDER, -3)).toBe(800);
  });

  test('level -2 applies 0.90 multiplier', () => {
    expect(getAdjustedDER(baseDER, -2)).toBe(900);
  });

  test('level -1 applies 0.95 multiplier', () => {
    expect(getAdjustedDER(baseDER, -1)).toBe(950);
  });

  test('level +1 applies 1.05 multiplier', () => {
    expect(getAdjustedDER(baseDER, 1)).toBe(1050);
  });

  test('level +2 applies 1.10 multiplier', () => {
    expect(getAdjustedDER(baseDER, 2)).toBe(1100);
  });

  test('level +3 applies 1.20 multiplier', () => {
    expect(getAdjustedDER(baseDER, 3)).toBe(1200);
  });

  test('null level defaults to 0 (maintain)', () => {
    expect(getAdjustedDER(baseDER, null)).toBe(1000);
  });

  test('undefined level defaults to 0 (maintain)', () => {
    expect(getAdjustedDER(baseDER, undefined)).toBe(1000);
  });

  test('rounds to nearest integer', () => {
    // 777 * 0.95 = 738.15 → 738
    expect(getAdjustedDER(777, -1)).toBe(738);
  });

  test('rounds 0.5 up', () => {
    // 1050 * 0.95 = 997.5 → 998
    expect(getAdjustedDER(1050, -1)).toBe(998);
  });
});

// ─── getAvailableLevels ─────────────────────────────────

describe('getAvailableLevels', () => {
  test('dog with no conditions gets all 7 levels', () => {
    const levels = getAvailableLevels('dog', []);
    expect(levels).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  test('cat without conditions gets 6 levels (-3 absent)', () => {
    const levels = getAvailableLevels('cat', []);
    expect(levels).toEqual([-2, -1, 0, 1, 2, 3]);
    expect(levels).not.toContain(-3);
  });

  test('obesity blocks gain (+1, +2, +3)', () => {
    const levels = getAvailableLevels('dog', ['obesity']);
    expect(levels).toEqual([-3, -2, -1, 0]);
    expect(levels).not.toContain(1);
    expect(levels).not.toContain(2);
    expect(levels).not.toContain(3);
  });

  test('underweight blocks loss (-1, -2, -3)', () => {
    const levels = getAvailableLevels('dog', ['underweight']);
    expect(levels).toEqual([0, 1, 2, 3]);
    expect(levels).not.toContain(-1);
    expect(levels).not.toContain(-2);
    expect(levels).not.toContain(-3);
  });

  test('cat + obesity: -3 absent AND gain blocked', () => {
    const levels = getAvailableLevels('cat', ['obesity']);
    expect(levels).toEqual([-2, -1, 0]);
  });

  test('cat + underweight: -3 absent AND loss blocked', () => {
    const levels = getAvailableLevels('cat', ['underweight']);
    expect(levels).toEqual([0, 1, 2, 3]);
  });

  test('unrelated conditions do not block any levels', () => {
    const levels = getAvailableLevels('dog', ['ckd', 'diabetes', 'pancreatitis']);
    expect(levels).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  test('always includes 0 (maintain)', () => {
    expect(getAvailableLevels('dog', ['obesity'])).toContain(0);
    expect(getAvailableLevels('dog', ['underweight'])).toContain(0);
    expect(getAvailableLevels('cat', ['obesity'])).toContain(0);
  });
});

// ─── estimateWeeklyChange ───────────────────────────────

describe('estimateWeeklyChange', () => {
  test('maintain returns 0 lbs, direction maintain', () => {
    const result = estimateWeeklyChange(1000, 1000, 'dog');
    expect(result).toEqual({ lbs: 0, direction: 'maintain' });
  });

  test('dog loss calculation: -200 kcal/day deficit', () => {
    // 200 * 7 = 1400 weekly deficit, 1400 / 3150 = 0.444... → 0.4
    const result = estimateWeeklyChange(1000, 800, 'dog');
    expect(result.direction).toBe('loss');
    expect(result.lbs).toBe(0.4);
  });

  test('dog gain calculation: +200 kcal/day surplus', () => {
    // 200 * 7 = 1400 weekly surplus, 1400 / 3150 = 0.444... → 0.4
    const result = estimateWeeklyChange(1000, 1200, 'dog');
    expect(result.direction).toBe('gain');
    expect(result.lbs).toBe(0.4);
  });

  test('cat uses 3000 kcal/lb threshold', () => {
    // 200 * 7 = 1400, 1400 / 3000 = 0.466... → 0.5
    const result = estimateWeeklyChange(1000, 800, 'cat');
    expect(result.direction).toBe('loss');
    expect(result.lbs).toBe(0.5);
  });

  test('small deficit produces small weekly change', () => {
    // 50 * 7 = 350, 350 / 3150 = 0.111... → 0.1
    const result = estimateWeeklyChange(1000, 950, 'dog');
    expect(result.direction).toBe('loss');
    expect(result.lbs).toBe(0.1);
  });
});

// ─── getCalorieContext ──────────────────────────────────

describe('getCalorieContext', () => {
  test('level 0 shows maintenance label', () => {
    const ctx = getCalorieContext(1000, 0);
    expect(ctx.kcal).toBe(1000);
    expect(ctx.pctDelta).toBe(0);
    expect(ctx.label).toBe('~1000 kcal/day (maintenance)');
  });

  test('level -2 shows 10% below maintenance', () => {
    const ctx = getCalorieContext(1000, -2);
    expect(ctx.kcal).toBe(900);
    expect(ctx.pctDelta).toBe(-10);
    expect(ctx.label).toBe('~900 kcal/day (10% below maintenance)');
  });

  test('level +3 shows 20% above maintenance', () => {
    const ctx = getCalorieContext(1000, 3);
    expect(ctx.kcal).toBe(1200);
    expect(ctx.pctDelta).toBe(20);
    expect(ctx.label).toBe('~1200 kcal/day (20% above maintenance)');
  });

  test('null level defaults to maintenance', () => {
    const ctx = getCalorieContext(1000, null);
    expect(ctx.kcal).toBe(1000);
    expect(ctx.pctDelta).toBe(0);
  });

  test('level -3 shows 20% below maintenance', () => {
    const ctx = getCalorieContext(1000, -3);
    expect(ctx.kcal).toBe(800);
    expect(ctx.pctDelta).toBe(-20);
    expect(ctx.label).toBe('~800 kcal/day (20% below maintenance)');
  });

  test('level +1 shows 5% above maintenance', () => {
    const ctx = getCalorieContext(1000, 1);
    expect(ctx.kcal).toBe(1050);
    expect(ctx.pctDelta).toBe(5);
    expect(ctx.label).toBe('~1050 kcal/day (5% above maintenance)');
  });
});

// ─── shouldClampLevel ───────────────────────────────────

describe('shouldClampLevel', () => {
  test('returns same level when available', () => {
    expect(shouldClampLevel(2, 'dog', [])).toBe(2);
  });

  test('clamps +2 to 0 when obesity blocks gain', () => {
    expect(shouldClampLevel(2, 'dog', ['obesity'])).toBe(0);
  });

  test('clamps -2 to 0 when underweight blocks loss', () => {
    expect(shouldClampLevel(-2, 'dog', ['underweight'])).toBe(0);
  });

  test('clamps -3 to 0 for cats', () => {
    expect(shouldClampLevel(-3, 'cat', [])).toBe(0);
  });

  test('null level returns 0', () => {
    expect(shouldClampLevel(null, 'dog', [])).toBe(0);
  });

  test('undefined level returns 0', () => {
    expect(shouldClampLevel(undefined, 'dog', [])).toBe(0);
  });

  test('0 is never clamped', () => {
    expect(shouldClampLevel(0, 'dog', ['obesity'])).toBe(0);
    expect(shouldClampLevel(0, 'cat', ['underweight'])).toBe(0);
  });

  test('-1 stays for dog with obesity (loss is allowed)', () => {
    expect(shouldClampLevel(-1, 'dog', ['obesity'])).toBe(-1);
  });

  test('+1 stays for dog with underweight (gain is allowed)', () => {
    expect(shouldClampLevel(1, 'dog', ['underweight'])).toBe(1);
  });
});

// ─── Constants integrity ────────────────────────────────

describe('constants', () => {
  test('ALL_LEVELS has exactly 7 entries', () => {
    expect(ALL_LEVELS).toHaveLength(7);
  });

  test('every level has a multiplier', () => {
    for (const level of ALL_LEVELS) {
      expect(WEIGHT_GOAL_MULTIPLIERS[level]).toBeDefined();
      expect(typeof WEIGHT_GOAL_MULTIPLIERS[level]).toBe('number');
    }
  });

  test('every level has a label', () => {
    for (const level of ALL_LEVELS) {
      expect(WEIGHT_GOAL_LABELS[level]).toBeDefined();
      expect(typeof WEIGHT_GOAL_LABELS[level]).toBe('string');
    }
  });

  test('KCAL_PER_LB has dog and cat entries', () => {
    expect(KCAL_PER_LB.dog).toBe(3150);
    expect(KCAL_PER_LB.cat).toBe(3000);
  });

  test('multipliers are symmetric around 1.0', () => {
    expect(WEIGHT_GOAL_MULTIPLIERS[0]).toBe(1.0);
    // Loss side decreases, gain side increases
    expect(WEIGHT_GOAL_MULTIPLIERS[-1]).toBeLessThan(1.0);
    expect(WEIGHT_GOAL_MULTIPLIERS[1]).toBeGreaterThan(1.0);
  });
});
