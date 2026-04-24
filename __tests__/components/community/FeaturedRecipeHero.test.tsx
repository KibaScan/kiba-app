// FeaturedRecipeHero — render tests (Task 25 of M9 Community plan).
// recipeService.fetchApprovedRecipes is mocked so the empty / populated states
// can be triggered deterministically without hitting the live catalog.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../../src/services/recipeService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { FeaturedRecipeHero } from '../../../src/components/community/FeaturedRecipeHero';
import * as recipeService from '../../../src/services/recipeService';
import type { CommunityRecipe } from '../../../src/types/recipe';

const mockedRecipe = recipeService as jest.Mocked<typeof recipeService>;

const POPULATED_RECIPE: CommunityRecipe = {
  id: 'r-1',
  user_id: 'u-1',
  title: 'Pumpkin Coconut Bites',
  subtitle: 'A sweet seasonal treat',
  species: 'dog',
  life_stage: 'adult',
  ingredients: [{ name: 'Pumpkin puree', quantity: 1, unit: 'cup' }],
  prep_steps: ['Mix and chill.'],
  cover_image_url: 'https://example.com/cover.jpg',
  status: 'approved',
  rejection_reason: null,
  is_killed: false,
  created_at: '2026-04-23T10:00:00Z',
  reviewed_at: '2026-04-23T10:30:00Z',
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('FeaturedRecipeHero', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockedRecipe.fetchApprovedRecipes.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('shows shimmer while fetch is pending', () => {
    // Never-resolving promise to lock the loading state.
    mockedRecipe.fetchApprovedRecipes.mockReturnValue(
      new Promise(() => {}) as unknown as Promise<CommunityRecipe[]>,
    );

    const { getByTestId } = render(<FeaturedRecipeHero />);
    expect(getByTestId('featured-recipe-hero-shimmer')).toBeTruthy();
  });

  it('empty state shows "Submit the first recipe" CTA when fetch returns []', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([]);

    const { findByLabelText, getByText } = render(<FeaturedRecipeHero />);
    expect(await findByLabelText(/Submit the first recipe/i)).toBeTruthy();
    expect(getByText(/Submit the first recipe/i)).toBeTruthy();
  });

  it('populated state shows the hero with title and badges', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([POPULATED_RECIPE]);

    const { findByText, getByText } = render(<FeaturedRecipeHero />);
    expect(await findByText('Pumpkin Coconut Bites')).toBeTruthy();
    expect(getByText('Dog')).toBeTruthy();
    expect(getByText('Adult')).toBeTruthy();
  });

  it('tapping the empty CTA navigates to KibaKitchenSubmit', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([]);

    const { findByLabelText } = render(<FeaturedRecipeHero />);
    const cta = await findByLabelText(/Submit the first recipe/i);
    fireEvent.press(cta);

    expect(mockNavigate).toHaveBeenCalledWith('KibaKitchenSubmit');
  });

  it('tapping the populated hero navigates to KibaKitchenFeed', async () => {
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([POPULATED_RECIPE]);

    const { findByLabelText } = render(<FeaturedRecipeHero />);
    const hero = await findByLabelText(/Featured recipe: Pumpkin Coconut Bites/i);
    fireEvent.press(hero);

    expect(mockNavigate).toHaveBeenCalledWith('KibaKitchenFeed');
  });

  it('treats fetch failure as empty (CTA visible, never stuck on shimmer)', async () => {
    mockedRecipe.fetchApprovedRecipes.mockRejectedValue(new Error('network down'));

    const { findByLabelText, queryByTestId } = render(<FeaturedRecipeHero />);
    expect(await findByLabelText(/Submit the first recipe/i)).toBeTruthy();
    await flush();
    expect(queryByTestId('featured-recipe-hero-shimmer')).toBeNull();
  });

  it('initialResolved=true with initialRecipe skips the fetch entirely', async () => {
    const { getByText } = render(
      <FeaturedRecipeHero
        initialRecipe={POPULATED_RECIPE}
        initialResolved
      />,
    );

    expect(getByText('Pumpkin Coconut Bites')).toBeTruthy();
    expect(mockedRecipe.fetchApprovedRecipes).not.toHaveBeenCalled();
  });
});
