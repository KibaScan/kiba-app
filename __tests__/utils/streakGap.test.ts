import { computeNextStreak } from '../../src/utils/streakGap';

describe('computeNextStreak', () => {
  it('initializes streak to 1 when no prior scan', () => {
    expect(computeNextStreak(null, '2026-04-23')).toBe(1);
  });
  it('no-ops on same-day scan (returns same streak)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-23' }, '2026-04-23')).toBe(5);
  });
  it('increments on consecutive day', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-22' }, '2026-04-23')).toBe(6);
  });
  it('preserves streak across 1 missed day (gap_days = 2)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-21' }, '2026-04-23')).toBe(6);
  });
  it('resets when 2+ days are missed (gap_days = 3)', () => {
    expect(computeNextStreak({ days: 5, lastDate: '2026-04-20' }, '2026-04-23')).toBe(1);
  });
  it('preserves across day boundary (23:59 → 00:01 next day = gap_days 1)', () => {
    expect(computeNextStreak({ days: 1, lastDate: '2026-04-22' }, '2026-04-23')).toBe(2);
  });
  it('treats lastDate in the future as a reset to 1 (clock skew defensive)', () => {
    expect(computeNextStreak({ days: 9, lastDate: '2026-04-25' }, '2026-04-23')).toBe(1);
  });
});
