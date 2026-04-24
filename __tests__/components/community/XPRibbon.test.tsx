// XPRibbon — cache-vs-fetch race regression test.
//
// The ribbon hydrates from AsyncStorage and kicks off a fresh fetch in the
// same useEffect tick. Before the fix, if the fresh fetch resolved before
// AsyncStorage (rare, but possible with warm edge caches or a busy disk
// queue), the late-arriving cache read would overwrite the fresh state
// with the stale value. The fix adds a `freshResolvedRef` that the cache
// path checks before calling setSummary. This test pins that guard.

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/services/xpService', () => ({
  fetchXPSummary: jest.fn(),
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { XPRibbon } from '../../../src/components/community/XPRibbon';
import * as xpService from '../../../src/services/xpService';
import type { XPSummary } from '../../../src/types/xp';

const mockedFetchXPSummary = xpService.fetchXPSummary as jest.Mock;
const mockedGetItem = (AsyncStorage as unknown as { getItem: jest.Mock }).getItem;

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const STALE: XPSummary = {
  total_xp: 100,
  level: 2,
  progress_pct: 0.1,
  next_threshold: 300,
  scans_count: 10,
  discoveries_count: 0,
  contributions_count: 0,
  streak_current_days: 1,
  streak_longest_days: 1,
  weekly_xp: 10,
};

const FRESH: XPSummary = {
  total_xp: 540,
  level: 5,
  progress_pct: 0.4,
  next_threshold: 800,
  scans_count: 54,
  discoveries_count: 12,
  contributions_count: 2,
  streak_current_days: 7,
  streak_longest_days: 7,
  weekly_xp: 180,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('XPRibbon cache-vs-fetch race', () => {
  test('stale cache cannot overwrite fresh fetch when network resolves first', async () => {
    const cacheDeferred = deferred<string | null>();
    const fetchDeferred = deferred<XPSummary>();

    mockedGetItem.mockReturnValue(cacheDeferred.promise);
    mockedFetchXPSummary.mockReturnValue(fetchDeferred.promise);

    const { queryByText } = render(<XPRibbon />);

    // 1. Fresh fetch resolves first.
    await act(async () => {
      fetchDeferred.resolve(FRESH);
      await fetchDeferred.promise;
    });
    // Ribbon should now show fresh values.
    expect(queryByText(/540 XP/)).not.toBeNull();
    expect(queryByText(/Lv\. 5/)).not.toBeNull();

    // 2. Stale cache arrives late. Must NOT overwrite.
    await act(async () => {
      cacheDeferred.resolve(JSON.stringify(STALE));
      await cacheDeferred.promise;
    });
    expect(queryByText(/540 XP/)).not.toBeNull();
    expect(queryByText(/Lv\. 5/)).not.toBeNull();
    expect(queryByText(/100 XP/)).toBeNull();
    expect(queryByText(/Lv\. 2/)).toBeNull();
  });

  test('cache-first path still works when cache resolves before fetch', async () => {
    const cacheDeferred = deferred<string | null>();
    const fetchDeferred = deferred<XPSummary>();

    mockedGetItem.mockReturnValue(cacheDeferred.promise);
    mockedFetchXPSummary.mockReturnValue(fetchDeferred.promise);

    const { queryByText } = render(<XPRibbon />);

    // Cache arrives first — ribbon shows stale value immediately.
    await act(async () => {
      cacheDeferred.resolve(JSON.stringify(STALE));
      await cacheDeferred.promise;
    });
    expect(queryByText(/100 XP/)).not.toBeNull();

    // Fresh fetch later replaces stale.
    await act(async () => {
      fetchDeferred.resolve(FRESH);
      await fetchDeferred.promise;
    });
    expect(queryByText(/540 XP/)).not.toBeNull();
    expect(queryByText(/100 XP/)).toBeNull();
  });
});
