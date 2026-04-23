// xpService — fetchXPSummary tests.
// Mocks the RPC; level/progress are derived client-side via levelForXP.

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({
      data: [{
        total_xp: 250,
        scans_count: 10,
        discoveries_count: 1,
        contributions_count: 2,
        streak_current_days: 5,
        streak_longest_days: 12,
        weekly_xp: 75,
      }],
      error: null,
    }),
  },
}));

import { fetchXPSummary } from '../../src/services/xpService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchXPSummary', () => {
  test('returns enriched summary with derived level + progress', async () => {
    // Re-prime the default mock after clearAllMocks reset.
    const sb = require('../../src/services/supabase').supabase;
    (sb.rpc as jest.Mock).mockResolvedValueOnce({
      data: [{
        total_xp: 250,
        scans_count: 10,
        discoveries_count: 1,
        contributions_count: 2,
        streak_current_days: 5,
        streak_longest_days: 12,
        weekly_xp: 75,
      }],
      error: null,
    });

    const summary = await fetchXPSummary();
    expect(summary.total_xp).toBe(250);
    expect(summary.level).toBe(3);   // L3 starts at 250
    expect(summary.progress_pct).toBeCloseTo(0, 2);
    expect(summary.weekly_xp).toBe(75);
    expect(summary.scans_count).toBe(10);
    expect(summary.discoveries_count).toBe(1);
    expect(summary.contributions_count).toBe(2);
    expect(summary.streak_current_days).toBe(5);
    expect(summary.streak_longest_days).toBe(12);
  });

  test('handles missing row gracefully (new user)', async () => {
    const sb = require('../../src/services/supabase').supabase;
    (sb.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
    const summary = await fetchXPSummary();
    expect(summary.total_xp).toBe(0);
    expect(summary.level).toBe(1);
    expect(summary.weekly_xp).toBe(0);
  });

  test('throws when RPC returns an error', async () => {
    const sb = require('../../src/services/supabase').supabase;
    (sb.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'auth required' },
    });
    await expect(fetchXPSummary()).rejects.toEqual({ message: 'auth required' });
  });
});
