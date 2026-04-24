// SafetyFlagsScreen — render tests (Task 28 of M9 Community plan).
// scoreFlagService.fetchMyFlags + fetchCommunityActivityCounts mocked.
// Covers: default tab, empty/populated states, status chip, admin_note, tab
// switch + community-tab data render.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../src/services/scoreFlagService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SafetyFlagsScreen from '../../src/screens/SafetyFlagsScreen';
import * as scoreFlagService from '../../src/services/scoreFlagService';
import type {
  ScoreFlag,
  CommunityActivityCount,
} from '../../src/types/scoreFlag';

const mockedService = scoreFlagService as jest.Mocked<typeof scoreFlagService>;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

function makeFlag(overrides: Partial<ScoreFlag> = {}): ScoreFlag {
  return {
    id: 'flag-' + Math.random().toString(36).slice(2, 8),
    user_id: 'user-1',
    pet_id: 'pet-1',
    product_id: 'prod-1',
    scan_id: null,
    reason: 'score_wrong',
    detail: null,
    status: 'open',
    admin_note: null,
    created_at: '2026-04-22T12:00:00Z',
    reviewed_at: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <SafetyFlagsScreen
      {...({
        route: { params: undefined },
        navigation: { navigate: mockNavigate, goBack: mockGoBack },
      } as any)}
    />,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SafetyFlagsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockedService.fetchMyFlags.mockReset();
    mockedService.fetchCommunityActivityCounts.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('defaults to the My Flags tab', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { getByText } = renderScreen();
    await flush();

    // Both tab labels render; My Flags tab body's empty copy is what's visible.
    expect(getByText('My Flags')).toBeTruthy();
    expect(getByText('Community Activity')).toBeTruthy();
    expect(getByText(/No reports yet/i)).toBeTruthy();
  });

  it('My Flags empty state copy', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText } = renderScreen();

    expect(await findByText(/No reports yet/i)).toBeTruthy();
    expect(
      await findByText(/Tap .*Flag this score.* on any product to submit one/i),
    ).toBeTruthy();
  });

  it('My Flags populated: row count matches', async () => {
    const flags = [
      makeFlag({ id: 'f1', reason: 'score_wrong' }),
      makeFlag({ id: 'f2', reason: 'ingredient_missing' }),
      makeFlag({ id: 'f3', reason: 'recalled' }),
    ];
    mockedService.fetchMyFlags.mockResolvedValue(flags);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, getByText } = renderScreen();

    // Each row's reason label should appear once.
    expect(await findByText('Score seems off')).toBeTruthy();
    expect(getByText('Ingredient missing or wrong')).toBeTruthy();
    expect(getByText('I think this is recalled')).toBeTruthy();
  });

  it('My Flags row shows the mapped reason label (not the enum value)', async () => {
    const flags = [makeFlag({ id: 'f1', reason: 'data_outdated' })];
    mockedService.fetchMyFlags.mockResolvedValue(flags);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, queryByText } = renderScreen();

    expect(await findByText('Information looks outdated')).toBeTruthy();
    expect(queryByText('data_outdated')).toBeNull();
  });

  it('My Flags row shows the mapped status chip text', async () => {
    const flags = [
      makeFlag({ id: 'f-open', reason: 'score_wrong', status: 'open' }),
      makeFlag({ id: 'f-rev', reason: 'ingredient_missing', status: 'reviewed' }),
      makeFlag({ id: 'f-res', reason: 'recalled', status: 'resolved' }),
      makeFlag({ id: 'f-rej', reason: 'other', status: 'rejected' }),
    ];
    mockedService.fetchMyFlags.mockResolvedValue(flags);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, getByText } = renderScreen();

    expect(await findByText('Open')).toBeTruthy();
    expect(getByText('Under review')).toBeTruthy();
    expect(getByText('Resolved')).toBeTruthy();
    expect(getByText('Closed')).toBeTruthy();
  });

  it('My Flags row shows admin_note when present', async () => {
    const flags = [
      makeFlag({
        id: 'f-with-note',
        reason: 'score_wrong',
        admin_note: 'We reviewed and updated the score — thanks!',
      }),
    ];
    mockedService.fetchMyFlags.mockResolvedValue(flags);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, getByText } = renderScreen();

    expect(await findByText(/We reviewed and updated the score/i)).toBeTruthy();
    expect(getByText(/Note from Kiba/i)).toBeTruthy();
  });

  it('My Flags row hides admin_note when null', async () => {
    const flags = [makeFlag({ id: 'f-bare', reason: 'score_wrong', admin_note: null })];
    mockedService.fetchMyFlags.mockResolvedValue(flags);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, queryByText } = renderScreen();

    // Wait for the row to render before asserting absence of the admin block.
    expect(await findByText('Score seems off')).toBeTruthy();
    expect(queryByText(/Note from Kiba/i)).toBeNull();
  });

  it('tapping the Community Activity tab switches the body', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    const counts: CommunityActivityCount[] = [
      { reason: 'score_wrong', count: 3 },
    ];
    mockedService.fetchCommunityActivityCounts.mockResolvedValue(counts);

    const { findByText, queryByText, getByText } = renderScreen();

    // First, My Flags empty copy is visible.
    expect(await findByText(/No reports yet/i)).toBeTruthy();

    fireEvent.press(getByText('Community Activity'));
    await flush();

    // Now the activity summary header copy is visible; My Flags empty copy is gone.
    expect(getByText(/Community Activity Summary/i)).toBeTruthy();
    expect(queryByText(/No reports yet/i)).toBeNull();
  });

  it('Community tab empty state when total is zero', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { findByText, getByText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Community Activity'));
    await flush();

    expect(await findByText(/No community reports this week/i)).toBeTruthy();
  });

  it('Community tab populated: total + per-reason bar counts render', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    const counts: CommunityActivityCount[] = [
      { reason: 'score_wrong', count: 5 },
      { reason: 'recalled', count: 2 },
      { reason: 'ingredient_missing', count: 1 },
    ];
    mockedService.fetchCommunityActivityCounts.mockResolvedValue(counts);

    const { findByText, getByText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Community Activity'));
    await flush();

    // Total = 8.
    expect(await findByText('8')).toBeTruthy();
    expect(getByText(/reports submitted this week/i)).toBeTruthy();

    // Per-reason a11y labels carry the count even when bar text repeats.
    expect(getByLabelText('Score seems off: 5')).toBeTruthy();
    expect(getByLabelText('I think this is recalled: 2')).toBeTruthy();
    expect(getByLabelText('Ingredient missing or wrong: 1')).toBeTruthy();
    // Reasons not in the RPC payload still render at 0 (canonical order).
    expect(getByLabelText('Information looks outdated: 0')).toBeTruthy();
    expect(getByLabelText('Recipe safety concern: 0')).toBeTruthy();
    expect(getByLabelText('Something else: 0')).toBeTruthy();
  });

  it('back button calls navigation.goBack', async () => {
    mockedService.fetchMyFlags.mockResolvedValue([]);
    mockedService.fetchCommunityActivityCounts.mockResolvedValue([]);

    const { getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
