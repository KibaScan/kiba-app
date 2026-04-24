// KibaKitchenRecipeDetailScreen — render tests (Task 25 of M9 Community plan).
// recipeService.fetchRecipeById is mocked. Loading / not-found / killed /
// populated branches plus the spec §6.4 requirement that the disclaimer
// banner appear at BOTH top AND bottom of the populated layout.

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

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import KibaKitchenRecipeDetailScreen from '../../src/screens/KibaKitchenRecipeDetailScreen';
import * as recipeService from '../../src/services/recipeService';
import type { CommunityRecipe } from '../../src/types/recipe';

const mockedRecipe = recipeService as jest.Mocked<typeof recipeService>;

const APPROVED_RECIPE: CommunityRecipe = {
  id: 'r-1',
  user_id: 'u-1',
  title: 'Pumpkin Coconut Bites',
  subtitle: 'A sweet seasonal treat',
  species: 'dog',
  life_stage: 'adult',
  ingredients: [
    { name: 'Pumpkin puree', quantity: 1, unit: 'cup' },
    { name: 'Coconut flour', quantity: 0.5, unit: 'cup' },
  ],
  prep_steps: [
    'Mix all ingredients in a bowl.',
    'Form into 1-inch balls and chill for 30 minutes.',
  ],
  cover_image_url: 'https://example.com/cover.jpg',
  status: 'approved',
  rejection_reason: null,
  is_killed: false,
  created_at: '2026-04-22T10:00:00Z',
  reviewed_at: '2026-04-22T11:00:00Z',
};

const KILLED_RECIPE: CommunityRecipe = {
  ...APPROVED_RECIPE,
  is_killed: true,
};

const mockGoBack = jest.fn();

function renderScreen(recipeId = 'r-1') {
  return render(
    <KibaKitchenRecipeDetailScreen
      {...({
        route: { params: { recipeId } },
        navigation: { navigate: jest.fn(), goBack: mockGoBack },
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

describe('KibaKitchenRecipeDetailScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockedRecipe.fetchRecipeById.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('renders shimmer while fetch is pending', () => {
    mockedRecipe.fetchRecipeById.mockReturnValue(
      new Promise(() => {}) as unknown as Promise<CommunityRecipe | null>,
    );

    const { getByTestId } = renderScreen();
    expect(getByTestId('recipe-detail-shimmer')).toBeTruthy();
  });

  it('shows "Recipe removed" copy when fetchRecipeById returns null (not found)', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(null);

    const { findByText } = renderScreen();
    expect(await findByText('Recipe removed')).toBeTruthy();
    expect(
      await findByText(/This recipe is no longer available/i),
    ).toBeTruthy();
  });

  it('shows "Recipe removed" copy when the recipe row has is_killed=true', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(KILLED_RECIPE);

    const { findByText, queryByText } = renderScreen();
    expect(await findByText('Recipe removed')).toBeTruthy();
    // Killed row should NOT leak title / ingredients / prep steps to the user.
    expect(queryByText('Pumpkin Coconut Bites')).toBeNull();
    expect(queryByText('Pumpkin puree')).toBeNull();
  });

  it('populated state renders title, ingredients, and prep steps', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(APPROVED_RECIPE);

    const { findByText, getByText } = renderScreen();

    expect(await findByText('Pumpkin Coconut Bites')).toBeTruthy();
    expect(getByText('A sweet seasonal treat')).toBeTruthy();
    expect(getByText('Pumpkin puree')).toBeTruthy();
    expect(getByText('Coconut flour')).toBeTruthy();
    expect(getByText('1 cup')).toBeTruthy();
    expect(getByText('0.5 cup')).toBeTruthy();
    expect(getByText('Mix all ingredients in a bowl.')).toBeTruthy();
    expect(
      getByText('Form into 1-inch balls and chill for 30 minutes.'),
    ).toBeTruthy();
  });

  it('renders the disclaimer banner at BOTH top and bottom (spec §6.4)', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(APPROVED_RECIPE);

    const { findAllByText } = renderScreen();
    // RecipeDisclaimerBanner renders the canonical RECIPE_DISCLAIMER_TEXT —
    // the substring "Community recipe. Not veterinarian-reviewed." is unique
    // to that banner, so a length=2 match proves both top and bottom render.
    const banners = await findAllByText(
      /Community recipe\. Not veterinarian-reviewed\./i,
    );
    expect(banners).toHaveLength(2);
  });

  it('overflow menu shows "Report issue" and warns Task 27 stub when tapped', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(APPROVED_RECIPE);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { findByLabelText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(await findByLabelText(/More options/i));
    fireEvent.press(getByLabelText(/Report issue/i));

    expect(warnSpy).toHaveBeenCalledWith('TODO Task 27: recipe report flow');
    warnSpy.mockRestore();
  });

  it('back button on missing-state goes back', async () => {
    mockedRecipe.fetchRecipeById.mockResolvedValue(null);

    const { findByLabelText } = renderScreen();
    fireEvent.press(await findByLabelText(/Back to recipes/i));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
