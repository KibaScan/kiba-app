import { startOfISOWeekUTC } from '../../src/utils/weeklyXPWindow';

describe('startOfISOWeekUTC', () => {
  it('returns Monday 00:00 UTC for a Tuesday afternoon', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-21T14:30:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
  it('returns the same Monday when called on Monday 00:00', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-20T00:00:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
  it('rolls back to previous Monday when called on Sunday', () => {
    expect(startOfISOWeekUTC(new Date('2026-04-26T23:59:00Z'))).toBe('2026-04-20T00:00:00.000Z');
  });
});
