import {
  getWetTransitionSchedule,
  getWetTransitionTotalDays,
  getCurrentWetPhase,
  isWetTransitionExpired,
} from '../../src/utils/wetTransitionHelpers';
import type { WetTransitionPhase } from '../../src/utils/wetTransitionHelpers';

// ─── Schedule Generation ───────────────────────────────

describe('getWetTransitionSchedule', () => {
  // 1 unit/day: half-portion split
  it('1 unit/day (dog) → 2 phases, ½ portions, 2 transition days', () => {
    const schedule = getWetTransitionSchedule(1, 'dog');
    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toEqual({
      days: 2,
      oldPortions: '½',
      newPortions: '½',
      label: 'Feed ½ old and ½ new per day',
    });
    expect(schedule[1]).toEqual({
      days: 0,
      oldPortions: 0,
      newPortions: 1,
      label: 'All new food',
    });
  });

  it('1 unit/day (cat) → 3 transition days', () => {
    const schedule = getWetTransitionSchedule(1, 'cat');
    expect(schedule[0].days).toBe(3);
    expect(getWetTransitionTotalDays(schedule)).toBe(3);
  });

  // 2 units/day: simple 1-old-1-new
  it('2 units/day (dog) → 2 phases, 2 transition days', () => {
    const schedule = getWetTransitionSchedule(2, 'dog');
    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toEqual({
      days: 2,
      oldPortions: 1,
      newPortions: 1,
      label: 'Swap 1 serving to the new food per day',
    });
    expect(schedule[1].days).toBe(0);
  });

  it('2 units/day (cat) → 3 transition days', () => {
    const schedule = getWetTransitionSchedule(2, 'cat');
    expect(getWetTransitionTotalDays(schedule)).toBe(3);
  });

  // 3 units/day: 3-phase schedule with ceil/floor
  it('3 units/day (dog) → 3 phases, 4 transition days', () => {
    const schedule = getWetTransitionSchedule(3, 'dog');
    expect(schedule).toHaveLength(3);
    expect(schedule[0]).toEqual({
      days: 2,
      oldPortions: 2,
      newPortions: 1,
      label: 'Swap 1 of your 3 daily servings to the new food',
    });
    expect(schedule[1]).toEqual({
      days: 2,
      oldPortions: 2,  // ceil(3/2)
      newPortions: 1,  // floor(3/2)
      label: 'Swap 1 of your 3 daily servings to the new food',
    });
    expect(schedule[2].days).toBe(0);
    expect(getWetTransitionTotalDays(schedule)).toBe(4);
  });

  // 4 units/day: standard 3-phase
  it('4 units/day (dog) → 3 phases, 4 transition days', () => {
    const schedule = getWetTransitionSchedule(4, 'dog');
    expect(schedule).toHaveLength(3);
    expect(schedule[0]).toMatchObject({ oldPortions: 3, newPortions: 1 });
    expect(schedule[1]).toMatchObject({ oldPortions: 2, newPortions: 2 }); // ceil(4/2), floor(4/2)
    expect(schedule[2]).toMatchObject({ oldPortions: 0, newPortions: 4 });
  });

  // 5 units/day: odd number, ceil/floor split
  it('5 units/day (dog) → phase 2 uses ceil/floor (3 old, 2 new)', () => {
    const schedule = getWetTransitionSchedule(5, 'dog');
    expect(schedule[0]).toMatchObject({ oldPortions: 4, newPortions: 1 });
    expect(schedule[1]).toMatchObject({ oldPortions: 3, newPortions: 2 }); // ceil(5/2)=3, floor(5/2)=2
    expect(schedule[2]).toMatchObject({ oldPortions: 0, newPortions: 5 });
  });

  // 7 units/day: large number, no clamp
  it('7 units/day (dog) → scales without clamp', () => {
    const schedule = getWetTransitionSchedule(7, 'dog');
    expect(schedule[0]).toMatchObject({ oldPortions: 6, newPortions: 1 });
    expect(schedule[1]).toMatchObject({ oldPortions: 4, newPortions: 3 }); // ceil(7/2)=4, floor(7/2)=3
    expect(schedule[2]).toMatchObject({ oldPortions: 0, newPortions: 7 });
  });

  // Cat species: longer phases
  it('4 units/day (cat) → 6 transition days', () => {
    const schedule = getWetTransitionSchedule(4, 'cat');
    expect(schedule[0].days).toBe(3);
    expect(schedule[1].days).toBe(3);
    expect(getWetTransitionTotalDays(schedule)).toBe(6);
  });

  // Edge: 0 or negative → treated as 1
  it('0 units/day defaults to 1-unit schedule', () => {
    const schedule = getWetTransitionSchedule(0, 'dog');
    expect(schedule[0].oldPortions).toBe('½');
  });

  // Edge: fractional → rounded
  it('2.3 units/day rounds to 2-unit schedule', () => {
    const schedule = getWetTransitionSchedule(2.3, 'dog');
    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toMatchObject({ oldPortions: 1, newPortions: 1 });
  });

  // Portions always sum to n
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('portions sum to n for %i units/day', (n) => {
    const schedule = getWetTransitionSchedule(n, 'dog');
    for (const phase of schedule) {
      if (phase.days === 0) continue; // skip steady-state for sum check on transition phases
      const old = phase.oldPortions === '½' ? 0.5 : phase.oldPortions;
      const neu = phase.newPortions === '½' ? 0.5 : phase.newPortions;
      expect(old + neu).toBe(Math.max(1, n));
    }
  });
});

// ─── Total Days ────────────────────────────────────────

describe('getWetTransitionTotalDays', () => {
  it('returns sum of non-zero phase days', () => {
    const phases: WetTransitionPhase[] = [
      { days: 2, oldPortions: 1, newPortions: 1, label: '' },
      { days: 2, oldPortions: 0, newPortions: 2, label: '' },
      { days: 0, oldPortions: 0, newPortions: 2, label: '' },
    ];
    expect(getWetTransitionTotalDays(phases)).toBe(4);
  });
});

// ─── Phase Lookup ──────────────────────────────────────

describe('getCurrentWetPhase', () => {
  const schedule = getWetTransitionSchedule(3, 'dog');
  // Phase 1: days 1-2, Phase 2: days 3-4

  it('day 1 (start date) → phase 0, dayInPhase 1', () => {
    const today = new Date();
    const startedAt = today.toISOString();
    const result = getCurrentWetPhase(startedAt, schedule);
    expect(result).not.toBeNull();
    expect(result!.phaseIndex).toBe(0);
    expect(result!.dayInPhase).toBe(1);
    expect(result!.overallDay).toBe(1);
  });

  it('day 3 → phase 1, dayInPhase 1', () => {
    const start = new Date();
    start.setDate(start.getDate() - 2); // 2 days ago → day 3
    const result = getCurrentWetPhase(start.toISOString(), schedule);
    expect(result).not.toBeNull();
    expect(result!.phaseIndex).toBe(1);
    expect(result!.dayInPhase).toBe(1);
    expect(result!.overallDay).toBe(3);
  });

  it('returns null when past total days', () => {
    const start = new Date();
    start.setDate(start.getDate() - 10); // Well past 4 days
    expect(getCurrentWetPhase(start.toISOString(), schedule)).toBeNull();
  });

  it('returns null for future start date (day < 1)', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(getCurrentWetPhase(future.toISOString(), schedule)).toBeNull();
  });
});

// ─── Expiry ────────────────────────────────────────────

describe('isWetTransitionExpired', () => {
  it('not expired on start day', () => {
    const today = new Date().toISOString();
    expect(isWetTransitionExpired(today, 4)).toBe(false);
  });

  it('not expired on last day', () => {
    const start = new Date();
    start.setDate(start.getDate() - 3); // 3 days ago → day 4 of 4
    expect(isWetTransitionExpired(start.toISOString(), 4)).toBe(false);
  });

  it('expired the day after', () => {
    const start = new Date();
    start.setDate(start.getDate() - 4); // 4 days ago → day 5 of 4
    expect(isWetTransitionExpired(start.toISOString(), 4)).toBe(true);
  });
});
