// __tests__/utils/xpLevel.test.ts
import { levelForXP, LEVEL_THRESHOLDS } from '../../src/utils/xpLevel';

describe('levelForXP', () => {
  it('returns level 1 for 0 XP', () => {
    expect(levelForXP(0)).toEqual({ level: 1, progress: 0, nextThreshold: 100 });
  });
  it('returns level 2 at exactly 100 XP', () => {
    expect(levelForXP(100)).toEqual({ level: 2, progress: 0, nextThreshold: 250 });
  });
  it('returns 50% progress mid-level', () => {
    const result = levelForXP(175); // L2 = 100, L3 = 250, halfway = 175
    expect(result.level).toBe(2);
    expect(result.progress).toBeCloseTo(0.5, 2);
  });
  it('returns level 5 at 1000 XP', () => {
    expect(levelForXP(1000).level).toBe(5);
  });
  it('handles very large XP without overflow', () => {
    const result = levelForXP(1_000_000);
    // Bound is curve-dependent: with MULTIPLIER=1.8 starting from L5=1000,
    // 1M XP falls between L16 (~642k) and L17 (~1.16M). If MULTIPLIER changes, revisit this bound.
    expect(result.level).toBeGreaterThan(10);
    expect(Number.isFinite(result.nextThreshold)).toBe(true);
  });
  it('exposes LEVEL_THRESHOLDS as deterministic array', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
    expect(LEVEL_THRESHOLDS[1]).toBe(100);
    expect(LEVEL_THRESHOLDS[4]).toBe(1000);
  });
});
