// Kiba — Safe Switch Helpers Tests (M7)
// Pure function tests for schedule math, day computation, cup splits.

import {
  getDefaultDuration,
  getTransitionSchedule,
  getMixForDay,
  getCurrentDay,
  getCupSplit,
  shouldShowUpsetAdvisory,
  getSpeciesNote,
} from '../../src/utils/safeSwitchHelpers';

describe('safeSwitchHelpers', () => {
  // ─── getDefaultDuration ──────────────────────────────

  describe('getDefaultDuration', () => {
    it('returns 7 for dogs', () => {
      expect(getDefaultDuration('dog')).toBe(7);
    });
    it('returns 10 for cats', () => {
      expect(getDefaultDuration('cat')).toBe(10);
    });
  });

  // ─── getTransitionSchedule ───────────────────────────

  describe('getTransitionSchedule', () => {
    it('generates 7 entries for a 7-day plan', () => {
      const schedule = getTransitionSchedule(7);
      expect(schedule).toHaveLength(7);
    });

    it('generates 10 entries for a 10-day plan', () => {
      const schedule = getTransitionSchedule(10);
      expect(schedule).toHaveLength(10);
    });

    it('has correct phases for 7-day dog plan', () => {
      const schedule = getTransitionSchedule(7);

      // Days 1-2: 75/25
      expect(schedule[0]).toMatchObject({ day: 1, oldPct: 75, newPct: 25 });
      expect(schedule[1]).toMatchObject({ day: 2, oldPct: 75, newPct: 25 });

      // Days 3-4: 50/50
      expect(schedule[2]).toMatchObject({ day: 3, oldPct: 50, newPct: 50 });
      expect(schedule[3]).toMatchObject({ day: 4, oldPct: 50, newPct: 50 });

      // Days 5-6: 25/75
      expect(schedule[4]).toMatchObject({ day: 5, oldPct: 25, newPct: 75 });
      expect(schedule[5]).toMatchObject({ day: 6, oldPct: 25, newPct: 75 });

      // Day 7: 0/100
      expect(schedule[6]).toMatchObject({ day: 7, oldPct: 0, newPct: 100 });
    });

    it('has correct phases for 10-day cat plan', () => {
      const schedule = getTransitionSchedule(10);

      // Days 1-3: 75/25
      expect(schedule[0]).toMatchObject({ day: 1, oldPct: 75, newPct: 25 });
      expect(schedule[1]).toMatchObject({ day: 2, oldPct: 75, newPct: 25 });
      expect(schedule[2]).toMatchObject({ day: 3, oldPct: 75, newPct: 25 });

      // Days 4-6: 50/50
      expect(schedule[3]).toMatchObject({ day: 4, oldPct: 50, newPct: 50 });
      expect(schedule[4]).toMatchObject({ day: 5, oldPct: 50, newPct: 50 });
      expect(schedule[5]).toMatchObject({ day: 6, oldPct: 50, newPct: 50 });

      // Days 7-9: 25/75
      expect(schedule[6]).toMatchObject({ day: 7, oldPct: 25, newPct: 75 });
      expect(schedule[7]).toMatchObject({ day: 8, oldPct: 25, newPct: 75 });
      expect(schedule[8]).toMatchObject({ day: 9, oldPct: 25, newPct: 75 });

      // Day 10: 0/100
      expect(schedule[9]).toMatchObject({ day: 10, oldPct: 0, newPct: 100 });
    });

    it('always starts at 75/25 and ends at 0/100', () => {
      for (const days of [5, 7, 10, 14]) {
        const schedule = getTransitionSchedule(days);
        expect(schedule[0].oldPct).toBe(75);
        expect(schedule[0].newPct).toBe(25);
        expect(schedule[schedule.length - 1].oldPct).toBe(0);
        expect(schedule[schedule.length - 1].newPct).toBe(100);
      }
    });

    it('all percentages add to 100', () => {
      const schedule = getTransitionSchedule(7);
      for (const entry of schedule) {
        expect(entry.oldPct + entry.newPct).toBe(100);
      }
    });

    it('includes phase label for final day', () => {
      const schedule = getTransitionSchedule(7);
      expect(schedule[6].phase).toBe('100% new food');
    });
  });

  // ─── getMixForDay ────────────────────────────────────

  describe('getMixForDay', () => {
    it('returns 75/25 for day 1 of 7', () => {
      expect(getMixForDay(1, 7)).toEqual({ oldPct: 75, newPct: 25 });
    });

    it('returns 50/50 for day 3 of 7', () => {
      expect(getMixForDay(3, 7)).toEqual({ oldPct: 50, newPct: 50 });
    });

    it('returns 0/100 for day 7 of 7', () => {
      expect(getMixForDay(7, 7)).toEqual({ oldPct: 0, newPct: 100 });
    });

    it('clamps day below 1 to day 1', () => {
      expect(getMixForDay(0, 7)).toEqual({ oldPct: 75, newPct: 25 });
      expect(getMixForDay(-5, 7)).toEqual({ oldPct: 75, newPct: 25 });
    });

    it('clamps day above total to final day', () => {
      expect(getMixForDay(100, 7)).toEqual({ oldPct: 0, newPct: 100 });
    });
  });

  // ─── getCurrentDay ───────────────────────────────────

  describe('getCurrentDay', () => {
    // Helper: format Date as YYYY-MM-DD in local time (not UTC)
    // getCurrentDay uses local time internally, so tests must match
    function toLocalDateStr(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('returns 1 on the start date', () => {
      const today = new Date();
      expect(getCurrentDay(toLocalDateStr(today), 7)).toBe(1);
    });

    it('returns 2 one day after start', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(getCurrentDay(toLocalDateStr(yesterday), 7)).toBe(2);
    });

    it('clamps to totalDays when past the transition period', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      expect(getCurrentDay(toLocalDateStr(twoWeeksAgo), 7)).toBe(7);
    });

    it('returns 1 for future start dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(getCurrentDay(toLocalDateStr(tomorrow), 7)).toBe(1);
    });
  });

  // ─── getCupSplit ─────────────────────────────────────

  describe('getCupSplit', () => {
    it('splits 2 cups at 75/25', () => {
      const { oldCups, newCups } = getCupSplit(2, 75, 25);
      expect(oldCups).toBe(1.5);
      expect(newCups).toBe(0.5);
    });

    it('splits 2.4 cups at 50/50', () => {
      const { oldCups, newCups } = getCupSplit(2.4, 50, 50);
      expect(oldCups).toBe(1.2);
      expect(newCups).toBe(1.2);
    });

    it('returns 0/total for 0/100 split', () => {
      const { oldCups, newCups } = getCupSplit(3, 0, 100);
      expect(oldCups).toBe(0);
      expect(newCups).toBe(3);
    });

    it('handles zero total cups', () => {
      const { oldCups, newCups } = getCupSplit(0, 75, 25);
      expect(oldCups).toBe(0);
      expect(newCups).toBe(0);
    });
  });

  // ─── shouldShowUpsetAdvisory ─────────────────────────

  describe('shouldShowUpsetAdvisory', () => {
    it('returns false with no logs', () => {
      expect(shouldShowUpsetAdvisory([], 3)).toBe(false);
    });

    it('returns false with single upset', () => {
      const logs = [{ day_number: 2, tummy_check: 'upset' }];
      expect(shouldShowUpsetAdvisory(logs, 3)).toBe(false);
    });

    it('returns true with 2 consecutive upset days', () => {
      const logs = [
        { day_number: 2, tummy_check: 'upset' },
        { day_number: 3, tummy_check: 'upset' },
      ];
      expect(shouldShowUpsetAdvisory(logs, 3)).toBe(true);
    });

    it('returns false when upset days are not consecutive', () => {
      const logs = [
        { day_number: 1, tummy_check: 'upset' },
        { day_number: 2, tummy_check: 'perfect' },
        { day_number: 3, tummy_check: 'upset' },
      ];
      expect(shouldShowUpsetAdvisory(logs, 3)).toBe(false);
    });

    it('returns false with only perfect logs', () => {
      const logs = [
        { day_number: 1, tummy_check: 'perfect' },
        { day_number: 2, tummy_check: 'perfect' },
        { day_number: 3, tummy_check: 'perfect' },
      ];
      expect(shouldShowUpsetAdvisory(logs, 3)).toBe(false);
    });
  });

  // ─── getSpeciesNote ──────────────────────────────────

  describe('getSpeciesNote', () => {
    it('includes pet name for dogs', () => {
      const note = getSpeciesNote('dog', 'Buster', 7);
      expect(note).toContain('Buster');
      expect(note).toContain('dog');
      expect(note).toContain('7-day');
    });

    it('includes pet name for cats', () => {
      const note = getSpeciesNote('cat', 'Whiskers', 10);
      expect(note).toContain('Whiskers');
      expect(note).toContain('cat');
      expect(note).toContain('10-day');
    });
  });
});
