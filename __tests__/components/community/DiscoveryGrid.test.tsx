// DiscoveryGrid — render tests (Task 30 of M9 Community plan).
// Verifies all 4 tiles render, the 3 navigating tiles route correctly, and
// the Kiba Index Highlights tile self-fetches with active-pet-aware copy.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../../src/services/communityService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { DiscoveryGrid } from '../../../src/components/community/DiscoveryGrid';
import { KibaIndexHighlightsTile } from '../../../src/components/community/tiles/KibaIndexHighlightsTile';
import * as communityService from '../../../src/services/communityService';
import { useActivePetStore } from '../../../src/stores/useActivePetStore';
import type { KibaIndexHighlight } from '../../../src/services/communityService';
import type { Pet } from '../../../src/types/pet';

const mockedCommunity = communityService as jest.Mocked<typeof communityService>;

const HIGHLIGHTS: KibaIndexHighlight[] = [
  {
    product_id: 'p-1',
    brand: 'Brand X',
    name: 'Picky Pick',
    metric: 'picky_eaters',
    score: 0.95,
  },
  {
    product_id: 'p-2',
    brand: 'Brand Y',
    name: 'Tummy Pick',
    metric: 'sensitive_tummies',
    score: 0.91,
  },
];

const FIXTURE_DOG: Pet = {
  id: 'pet-dog-1',
  user_id: 'u-1',
  name: 'Rex',
  species: 'dog',
  breed: null,
  weight_current_lbs: 30,
  weight_goal_lbs: null,
  weight_updated_at: null,
  date_of_birth: null,
  dob_is_approximate: false,
  activity_level: 'moderate',
  is_neutered: true,
  sex: 'male',
  photo_url: null,
  life_stage: 'adult',
  breed_size: 'medium',
  health_reviewed_at: null,
  weight_goal_level: 0,
  caloric_accumulator: null,
  accumulator_last_reset_at: null,
  accumulator_notification_sent: null,
  bcs_score: null,
  bcs_assessed_at: null,
  feeding_style: 'dry_only',
  wet_reserve_kcal: 0,
  wet_reserve_source: null,
  wet_intent_resolved_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const FIXTURE_CAT: Pet = {
  ...FIXTURE_DOG,
  id: 'pet-cat-1',
  name: 'Whiskers',
  species: 'cat',
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('DiscoveryGrid', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockedCommunity.fetchKibaIndexHighlights = jest.fn().mockResolvedValue([]);
    // Reset Zustand store to a clean state per advisor's pattern.
    useActivePetStore.setState({ pets: [], activePetId: null });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders all four tile titles', async () => {
    const { getByText } = render(<DiscoveryGrid />);
    await flush();

    expect(getByText('Discover')).toBeTruthy();
    expect(getByText('Toxic Database')).toBeTruthy();
    expect(getByText('Vendor Directory')).toBeTruthy();
    expect(getByText('Kiba Index Highlights')).toBeTruthy();
    expect(getByText('Safety Flags')).toBeTruthy();
  });

  it('navigates to ToxicDatabase when toxic tile is tapped', async () => {
    const { getByText } = render(<DiscoveryGrid />);
    await flush();

    fireEvent.press(getByText('Toxic Database'));
    expect(mockNavigate).toHaveBeenCalledWith('ToxicDatabase');
  });

  it('navigates to VendorDirectory when vendor tile is tapped', async () => {
    const { getByText } = render(<DiscoveryGrid />);
    await flush();

    fireEvent.press(getByText('Vendor Directory'));
    expect(mockNavigate).toHaveBeenCalledWith('VendorDirectory');
  });

  it('navigates to SafetyFlags when safety-flags tile is tapped', async () => {
    const { getByText } = render(<DiscoveryGrid />);
    await flush();

    fireEvent.press(getByText('Safety Flags'));
    expect(mockNavigate).toHaveBeenCalledWith('SafetyFlags');
  });

  it('Kiba Index tile shows "Add a pet" fallback when no active pet is set', async () => {
    const { findByText } = render(<DiscoveryGrid />);
    await flush();

    expect(await findByText(/Add a pet to see top picks/i)).toBeTruthy();
    // Service should NOT be called when species is unknown.
    expect(mockedCommunity.fetchKibaIndexHighlights).not.toHaveBeenCalled();
  });

  it('Kiba Index tile renders mini preview when service returns highlights', async () => {
    useActivePetStore.setState({
      pets: [FIXTURE_DOG],
      activePetId: FIXTURE_DOG.id,
    });
    mockedCommunity.fetchKibaIndexHighlights = jest
      .fn()
      .mockResolvedValue(HIGHLIGHTS);

    const { findByText } = render(<DiscoveryGrid />);
    await flush();

    expect(mockedCommunity.fetchKibaIndexHighlights).toHaveBeenCalledWith('dog');
    expect(await findByText(/Top for dogs: Brand X/i)).toBeTruthy();
  });

  it('Kiba Index tile renders empty fallback when fetch resolves to []', async () => {
    useActivePetStore.setState({
      pets: [FIXTURE_CAT],
      activePetId: FIXTURE_CAT.id,
    });
    mockedCommunity.fetchKibaIndexHighlights = jest.fn().mockResolvedValue([]);

    const { findByText } = render(<DiscoveryGrid />);
    await flush();

    expect(mockedCommunity.fetchKibaIndexHighlights).toHaveBeenCalledWith('cat');
    expect(await findByText(/No picks yet for cats/i)).toBeTruthy();
  });

  it('Kiba Index tile treats fetch failure as empty (does not throw)', async () => {
    useActivePetStore.setState({
      pets: [FIXTURE_DOG],
      activePetId: FIXTURE_DOG.id,
    });
    mockedCommunity.fetchKibaIndexHighlights = jest
      .fn()
      .mockRejectedValue(new Error('network down'));

    const { findByText } = render(<DiscoveryGrid />);
    await flush();

    expect(await findByText(/No picks yet for dogs/i)).toBeTruthy();
  });

  it('initialHighlights prop short-circuits the fetch (test override path)', async () => {
    useActivePetStore.setState({
      pets: [FIXTURE_DOG],
      activePetId: FIXTURE_DOG.id,
    });

    // Render the tile directly with the override so we can verify the fetch
    // is bypassed even when an active pet is set.
    const { getByText } = render(
      <KibaIndexHighlightsTile initialHighlights={HIGHLIGHTS} />,
    );
    await flush();

    expect(getByText(/Top for dogs: Brand X/i)).toBeTruthy();
    expect(mockedCommunity.fetchKibaIndexHighlights).not.toHaveBeenCalled();
  });
});
