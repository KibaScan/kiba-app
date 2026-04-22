// BookmarksScreen — render tests (Task 13 of bookmarks-polish plan).
// Covers: section headers, empty-bucket omission, recalled pin ordering,
// vet-diet chip, D-168 a11y label, and amber near-cap progress chip.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../src/services/bookmarkService');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));
jest.mock('@react-navigation/bottom-tabs', () => ({}));

import React from 'react';
import { render } from '@testing-library/react-native';
import BookmarksScreen from '../../src/screens/BookmarksScreen';
import { useActivePetStore } from '../../src/stores/useActivePetStore';
import { useBookmarkStore } from '../../src/stores/useBookmarkStore';
import * as bookmarkService from '../../src/services/bookmarkService';
import type { BookmarkCardData } from '../../src/types/bookmark';

const mockedService = bookmarkService as jest.Mocked<typeof bookmarkService>;

function mockCard(overrides: Partial<BookmarkCardData['product']> & {
  id?: string;
  final_score?: number | null;
  created_at?: string;
}): BookmarkCardData {
  const id = overrides.id ?? 'bm-' + Math.random().toString(36).slice(2, 8);
  return {
    bookmark: {
      id,
      user_id: 'u1',
      pet_id: 'pet-1',
      product_id: 'prod-' + id,
      created_at: overrides.created_at ?? '2026-04-21T00:00:00Z',
    },
    product: {
      id: 'prod-' + id,
      brand: 'Brand',
      name: 'Product Name',
      category: 'daily_food',
      image_url: null,
      is_recalled: false,
      is_vet_diet: false,
      is_variety_pack: false,
      is_supplemental: false,
      target_species: 'dog',
      ...overrides,
    },
    final_score: 'final_score' in overrides ? (overrides.final_score ?? null) : 80,
  };
}

function renderWithPet(cards: BookmarkCardData[]) {
  useActivePetStore.setState({
    activePetId: 'pet-1',
    pets: [
      {
        id: 'pet-1',
        user_id: 'u1',
        name: 'Buster',
        species: 'dog',
        photo_url: null,
        date_of_birth: '2020-01-01',
        weight_current_lbs: 50,
        is_neutered: true,
        life_stage: 'adult',
        weight_unit: 'lbs',
        weight_goal_level: 0,
        activity_level: 'moderate',
        bcs_score: null,
        bcs_assessed_at: null,
        health_conditions: [],
        allergens: [],
        created_at: '2024-01-01T00:00:00Z',
        health_reviewed_at: null,
        caloric_accumulator: 0,
        accumulator_last_reset_at: null,
        accumulator_notification_sent: false,
      } as any,
    ],
  });
  useBookmarkStore.setState({
    bookmarks: cards.map((c) => ({
      id: c.bookmark.id,
      user_id: c.bookmark.user_id,
      pet_id: c.bookmark.pet_id,
      product_id: c.product.id,
      created_at: c.bookmark.created_at,
    })),
    currentPetId: 'pet-1',
  });
  mockedService.fetchBookmarkCards.mockResolvedValue(cards);

  return render(<BookmarksScreen />);
}

describe('BookmarksScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders three section headers when all buckets are populated', async () => {
    const cards = [
      mockCard({ id: 'a', category: 'daily_food' }),
      mockCard({ id: 'b', category: 'daily_food', is_supplemental: true }),
      mockCard({ id: 'c', category: 'treat' }),
    ];
    const { findByText } = renderWithPet(cards);
    expect(await findByText(/Daily Food · 1/i)).toBeTruthy();
    expect(await findByText(/Toppers & Mixers · 1/i)).toBeTruthy();
    expect(await findByText(/Treats · 1/i)).toBeTruthy();
  });

  it('omits a section header when its bucket is empty', async () => {
    const cards = [mockCard({ category: 'treat' })];
    const { findByText, queryByText } = renderWithPet(cards);
    expect(await findByText(/Treats · 1/i)).toBeTruthy();
    expect(queryByText(/Daily Food/)).toBeNull();
    expect(queryByText(/Toppers & Mixers/)).toBeNull();
  });

  it('renders a Recalled chip and pins the recalled row above higher-scored siblings', async () => {
    const cards = [
      mockCard({ id: 'top', category: 'daily_food', final_score: 99, name: 'Top Scored' }),
      mockCard({ id: 'rec', category: 'daily_food', is_recalled: true, final_score: null, name: 'Recalled One' }),
    ];
    const { findByText, getAllByLabelText } = renderWithPet(cards);
    expect(await findByText('Recalled')).toBeTruthy();

    const labels = getAllByLabelText(/Recalled One|99% match for Buster/);
    // Recalled row's accessibilityLabel should appear before the top-scored row's label in render order.
    expect(labels[0].props.accessibilityLabel).toMatch(/recalled$/i);
  });

  it('renders the Vet diet chip next to brand on vet-diet rows', async () => {
    const cards = [mockCard({ category: 'daily_food', is_vet_diet: true, final_score: null })];
    const { findByText } = renderWithPet(cards);
    expect(await findByText('Vet diet')).toBeTruthy();
  });

  it('uses the D-168 accessibilityLabel pattern on scored rows', async () => {
    const cards = [mockCard({ id: 'x', category: 'daily_food', final_score: 84, brand: 'Nulo', name: 'Challenger' })];
    const { findByLabelText } = renderWithPet(cards);
    expect(await findByLabelText(/84% match for Buster, Nulo Challenger/)).toBeTruthy();
  });

  it('renders the amber progress chip when count >= 19', async () => {
    const cards = Array.from({ length: 19 }, (_, i) =>
      mockCard({ id: 'n' + i, category: 'daily_food', final_score: 80 }),
    );
    const { findByText } = renderWithPet(cards);
    expect(await findByText(/19\/20 saved/)).toBeTruthy();
  });
});
