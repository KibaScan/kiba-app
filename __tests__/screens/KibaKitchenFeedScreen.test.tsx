// KibaKitchenFeedScreen — render tests (Task 25 of M9 Community plan).
// recipeService + isOnline are mocked so the populated / empty / offline
// branches and pull-to-refresh can be exercised deterministically.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => {
  const RN = jest.requireActual('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
    SafeAreaView: RN.View,
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../src/services/recipeService');
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import KibaKitchenFeedScreen from '../../src/screens/KibaKitchenFeedScreen';
import * as recipeService from '../../src/services/recipeService';
import * as network from '../../src/utils/network';
import type { CommunityRecipe } from '../../src/types/recipe';

const mockedRecipe = recipeService as jest.Mocked<typeof recipeService>;
const mockedNetwork = network as jest.Mocked<typeof network>;

const FIXTURE: CommunityRecipe[] = [
  {
    id: 'r-1',
    user_id: 'u-1',
    title: 'Peanut Butter Bites',
    subtitle: 'Easy weekend treat',
    species: 'dog',
    life_stage: 'adult',
    ingredients: [{ name: 'Peanut butter', quantity: 2, unit: 'tbsp' }],
    prep_steps: ['Mix and bake.'],
    cover_image_url: 'https://example.com/pb.jpg',
    status: 'approved',
    rejection_reason: null,
    is_killed: false,
    created_at: '2026-04-22T10:00:00Z',
    reviewed_at: '2026-04-22T11:00:00Z',
  },
  {
    id: 'r-2',
    user_id: 'u-1',
    title: 'Tuna Cat Treats',
    subtitle: null,
    species: 'cat',
    life_stage: 'all',
    ingredients: [{ name: 'Tuna', quantity: 1, unit: 'can' }],
    prep_steps: ['Mix and chill.'],
    cover_image_url: null,
    status: 'approved',
    rejection_reason: null,
    is_killed: false,
    created_at: '2026-04-21T10:00:00Z',
    reviewed_at: '2026-04-21T11:00:00Z',
  },
];

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

function renderScreen() {
  return render(
    <KibaKitchenFeedScreen
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
  });
}

describe('KibaKitchenFeedScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockedRecipe.fetchApprovedRecipes.mockReset();
    mockedNetwork.isOnline.mockResolvedValue(true);
  });

  afterEach(() => jest.clearAllMocks());

  it('renders the disclaimer banner above the feed', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue(FIXTURE);

    const { getByText } = renderScreen();
    await flush();

    expect(
      getByText(/Community recipe\. Not veterinarian-reviewed\./i),
    ).toBeTruthy();
  });

  it('shows empty state with CTA when no approved recipes (online)', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([]);
    mockedNetwork.isOnline.mockResolvedValue(true);

    const { findByText, getByLabelText } = renderScreen();
    expect(await findByText(/No recipes yet/i)).toBeTruthy();
    expect(await findByText(/Be the first to submit/i)).toBeTruthy();

    fireEvent.press(getByLabelText(/Submit a recipe/i));
    expect(mockNavigate).toHaveBeenCalledWith('KibaKitchenSubmit');
  });

  it('shows offline-specific copy when isOnline is false and feed is empty', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([]);
    mockedNetwork.isOnline.mockResolvedValue(false);

    const { findByText, queryByText } = renderScreen();
    expect(await findByText(/Couldn’t load recipes/i)).toBeTruthy();
    expect(queryByText(/No recipes yet/i)).toBeNull();
  });

  it('renders one card per approved recipe in populated state', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue(FIXTURE);

    const { findByText, getByText } = renderScreen();
    expect(await findByText('Peanut Butter Bites')).toBeTruthy();
    expect(getByText('Tuna Cat Treats')).toBeTruthy();
  });

  it('tapping a card navigates to KibaKitchenRecipeDetail with the recipeId', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue(FIXTURE);

    const { findByText } = renderScreen();
    const card = await findByText('Peanut Butter Bites');
    fireEvent.press(card);

    expect(mockNavigate).toHaveBeenCalledWith('KibaKitchenRecipeDetail', {
      recipeId: 'r-1',
    });
  });

  it('pull-to-refresh re-calls fetchApprovedRecipes', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue(FIXTURE);

    const { UNSAFE_getByType } = renderScreen();
    await flush();

    // 1st call: initial mount.
    expect(mockedRecipe.fetchApprovedRecipes).toHaveBeenCalledTimes(1);

    // Reach into the FlatList's RefreshControl and invoke onRefresh directly —
    // fireEvent.scroll with contentOffset is unreliable for RefreshControl
    // in jest because the gesture system isn't simulated.
    const FlatList = require('react-native').FlatList;
    const list = UNSAFE_getByType(FlatList);
    const refreshControl = list.props.refreshControl;
    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(mockedRecipe.fetchApprovedRecipes).toHaveBeenCalledTimes(2);
  });

  it('header back button calls navigation.goBack', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue(FIXTURE);

    const { getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
