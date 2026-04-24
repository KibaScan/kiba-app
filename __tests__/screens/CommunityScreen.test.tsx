// CommunityScreen — render tests (Task 20 of M9 Community plan).
// Covers the new shell: XPRibbon visible, RecallBanner conditional on recall
// count, SubredditFooter pressable. Service fetches are mocked.

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../src/services/xpService');
jest.mock('../../src/services/communityService');
jest.mock('../../src/services/recipeService');
jest.mock('../../src/services/blogService');

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

// Spy on Linking.openURL so the test asserts the URL without unmounting
// the actual react-native module.
const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as unknown as boolean);
import CommunityScreen from '../../src/screens/CommunityScreen';
import * as xpService from '../../src/services/xpService';
import * as communityService from '../../src/services/communityService';
import * as recipeService from '../../src/services/recipeService';
import * as blogService from '../../src/services/blogService';
import type { XPSummary } from '../../src/types/xp';
import type { RecentRecall } from '../../src/services/communityService';
import type { CommunityRecipe } from '../../src/types/recipe';
import type { BlogPost } from '../../src/services/blogService';

const mockedXp = xpService as jest.Mocked<typeof xpService>;
const mockedCommunity = communityService as jest.Mocked<typeof communityService>;
const mockedRecipe = recipeService as jest.Mocked<typeof recipeService>;
const mockedBlog = blogService as jest.Mocked<typeof blogService>;

const POPULATED_XP: XPSummary = {
  total_xp: 2340,
  level: 7,
  progress_pct: 0.4,
  next_threshold: 3000,
  weekly_xp: 450,
  streak_current_days: 12,
  streak_longest_days: 15,
  scans_count: 80,
  discoveries_count: 6,
  contributions_count: 2,
};

const EMPTY_XP: XPSummary = {
  total_xp: 0,
  level: 1,
  progress_pct: 0,
  next_threshold: 100,
  weekly_xp: 0,
  streak_current_days: 0,
  streak_longest_days: 0,
  scans_count: 0,
  discoveries_count: 0,
  contributions_count: 0,
};

const RECALL_FIXTURE: RecentRecall = {
  product_id: 'prod-1',
  brand: 'Brand X',
  name: 'Recalled Kibble',
};

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

const POPULATED_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'Why grain-free is not a magic bullet',
    subtitle: 'A sober look at DCM headlines.',
    cover_image_url: 'https://example.com/grain.jpg',
    body_markdown: '# Body',
    published_at: '2026-04-22T10:00:00Z',
    is_published: true,
    created_at: '2026-04-22T10:00:00Z',
    updated_at: '2026-04-22T10:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Reading guaranteed analysis like a pro',
    subtitle: 'What the percentages actually tell you.',
    cover_image_url: null,
    body_markdown: 'body',
    published_at: '2026-04-21T10:00:00Z',
    is_published: true,
    created_at: '2026-04-21T10:00:00Z',
    updated_at: '2026-04-21T10:00:00Z',
  },
];

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CommunityScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockedCommunity.fetchKibaIndexHighlights = jest.fn().mockResolvedValue([]);
    // FeaturedRecipeHero (Task 25) self-fetches; default to empty so the
    // existing CommunityScreen tests don't accidentally exercise the live
    // network. Tests that care about hero state should override per-case.
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([]);
    // BlogCarousel (Task 26) self-fetches; default to empty so the carousel
    // collapses to null. Tests that care about blog state should override.
    mockedBlog.fetchPublishedPosts.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('renders the XP ribbon with level + total XP for a populated user', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    expect(await findByText(/Lv\.\s*7/)).toBeTruthy();
    expect(await findByText(/2,340 XP/)).toBeTruthy();
    expect(await findByText(/12-day streak/)).toBeTruthy();
    expect(await findByText(/\+450 XP this week/)).toBeTruthy();
  });

  it('renders the empty-state message when total XP is zero', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(EMPTY_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    expect(await findByText(/Scan your first product to start earning XP/)).toBeTruthy();
  });

  it('hides the XP ribbon entirely when fetch fails and cache is empty', async () => {
    // AsyncStorage.getItem is mocked to resolve null (empty cache) at the top
    // of the file, so the only path to populate `summary` here is the network
    // fetch — which we reject.
    mockedXp.fetchXPSummary.mockRejectedValue(new Error('network down'));
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);

    const { queryByText, queryByTestId } = render(<CommunityScreen />);
    await flush();

    // Onboarding copy must not leak to returning users hitting a network blip.
    expect(queryByText(/Scan your first product to start earning XP/)).toBeNull();
    // Shimmer should also be gone — we resolved loading and just render null.
    expect(queryByTestId('xp-ribbon-shimmer')).toBeNull();
  });

  it('hides the recall banner when no recent recalls', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);

    const { queryByText } = render(<CommunityScreen />);
    await flush();

    expect(queryByText(/recent recall/i)).toBeNull();
  });

  it('shows the recall banner with count when 1+ recent recalls exist', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([RECALL_FIXTURE]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    expect(await findByText(/1 recent recall — tap to review/i)).toBeTruthy();
  });

  it('pluralizes "recalls" when 2+ recent recalls', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([
      RECALL_FIXTURE,
      { ...RECALL_FIXTURE, product_id: 'prod-2', name: 'Another' },
    ]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    expect(await findByText(/2 recent recalls — tap to review/i)).toBeTruthy();
  });

  it('navigates to RecallDetail with the most-recent product on banner tap', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([RECALL_FIXTURE]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    const banner = await findByText(/1 recent recall — tap to review/i);
    fireEvent.press(banner);
    expect(mockNavigate).toHaveBeenCalledWith('RecallDetail', { productId: 'prod-1' });
  });

  it('renders the SubredditFooter and opens reddit on tap', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);

    const { findByText } = render(<CommunityScreen />);
    await flush();

    const footer = await findByText(/r\/kibascan/);
    expect(footer).toBeTruthy();
    fireEvent.press(footer);
    expect(openURLSpy).toHaveBeenCalledWith('https://reddit.com/r/kibascan');
  });

  // ─── Final assembly: full populated + full empty matrix (Task 31) ────────

  it('renders all 6 sections in order when populated', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([
      RECALL_FIXTURE,
      { ...RECALL_FIXTURE, product_id: 'prod-2', name: 'Another' },
    ]);
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([POPULATED_RECIPE]);
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POPULATED_POSTS);

    const { findByText, getByText } = render(<CommunityScreen />);
    await flush();

    // 1. XPRibbon — level + XP visible (signature copy from POPULATED_XP)
    expect(await findByText(/Lv\.\s*7/)).toBeTruthy();
    expect(getByText(/2,340 XP/)).toBeTruthy();

    // 2. FeaturedRecipeHero — populated card shows recipe title
    expect(getByText('Pumpkin Coconut Bites')).toBeTruthy();

    // 3. RecallBanner — pluralized count anchors the banner
    expect(getByText(/2 recent recalls — tap to review/i)).toBeTruthy();

    // 4. DiscoveryGrid — section header + all 4 tile titles
    expect(getByText('Discover')).toBeTruthy();
    expect(getByText('Toxic Database')).toBeTruthy();
    expect(getByText('Vendor Directory')).toBeTruthy();
    expect(getByText('Kiba Index Highlights')).toBeTruthy();
    expect(getByText('Safety Flags')).toBeTruthy();

    // 5. BlogCarousel — eyebrow + at least one post title from fixture
    expect(getByText('READ')).toBeTruthy();
    expect(getByText('Why grain-free is not a magic bullet')).toBeTruthy();

    // 6. SubredditFooter — pressable invite copy
    expect(getByText(/r\/kibascan/)).toBeTruthy();
  });

  it('renders gracefully in fully empty state', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(EMPTY_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);
    // beforeEach already sets recipes/blog/highlights to [] — leave defaults.

    const { findByText, queryByText, getByText } = render(<CommunityScreen />);
    await flush();

    // XPRibbon — onboarding copy (zero-XP branch).
    expect(
      await findByText(/Scan your first product to start earning XP/),
    ).toBeTruthy();

    // FeaturedRecipeHero — "Submit the first recipe" CTA on empty.
    expect(getByText(/Submit the first recipe/i)).toBeTruthy();

    // RecallBanner — hidden when no recalls.
    expect(queryByText(/recent recall/i)).toBeNull();

    // DiscoveryGrid — always shown (4 tiles, even with no data).
    expect(getByText('Discover')).toBeTruthy();
    expect(getByText('Toxic Database')).toBeTruthy();
    expect(getByText('Vendor Directory')).toBeTruthy();
    expect(getByText('Kiba Index Highlights')).toBeTruthy();
    expect(getByText('Safety Flags')).toBeTruthy();

    // BlogCarousel — collapses to null on []. No eyebrow, no see-all chip.
    expect(queryByText('READ')).toBeNull();
    expect(queryByText(/See all/i)).toBeNull();

    // SubredditFooter — always present.
    expect(getByText(/r\/kibascan/)).toBeTruthy();
  });

  it('hides BlogCarousel cleanly when 0 posts (no stranded eyebrow / chip)', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([POPULATED_RECIPE]);
    mockedBlog.fetchPublishedPosts.mockResolvedValue([]);

    const { findByText, queryByText, getByText } = render(<CommunityScreen />);
    await flush();

    // Sanity: ribbon + hero + grid + footer are present so the carousel is
    // the only collapsed surface.
    expect(await findByText(/Lv\.\s*7/)).toBeTruthy();
    expect(getByText('Pumpkin Coconut Bites')).toBeTruthy();
    expect(getByText('Discover')).toBeTruthy();
    expect(getByText(/r\/kibascan/)).toBeTruthy();

    // Carousel-specific surface markers must be gone.
    expect(queryByText('READ')).toBeNull();
    expect(queryByText(/See all/i)).toBeNull();
    // No shimmer either — carousel resolved to null, not loading.
    expect(queryByText(/Loading/i)).toBeNull();
  });

  it('recall banner hides when 0 recalls but DiscoveryGrid + others stay', async () => {
    mockedXp.fetchXPSummary.mockResolvedValue(POPULATED_XP);
    mockedCommunity.fetchRecentRecalls.mockResolvedValue([]);
    mockedRecipe.fetchApprovedRecipes.mockResolvedValue([POPULATED_RECIPE]);
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POPULATED_POSTS);

    const { findByText, queryByText, getByText } = render(<CommunityScreen />);
    await flush();

    // RecallBanner — silent on []. No partial-empty cascade.
    expect(queryByText(/recent recall/i)).toBeNull();

    // Every other section remains intact.
    expect(await findByText(/Lv\.\s*7/)).toBeTruthy();             // XPRibbon
    expect(getByText('Pumpkin Coconut Bites')).toBeTruthy();        // Recipe
    expect(getByText('Discover')).toBeTruthy();                     // DiscoveryGrid header
    expect(getByText('Toxic Database')).toBeTruthy();               // Tile 1
    expect(getByText('Vendor Directory')).toBeTruthy();             // Tile 2
    expect(getByText('Kiba Index Highlights')).toBeTruthy();        // Tile 3
    expect(getByText('Safety Flags')).toBeTruthy();                 // Tile 4
    expect(getByText('READ')).toBeTruthy();                         // BlogCarousel
    expect(getByText('Why grain-free is not a magic bullet')).toBeTruthy();
    expect(getByText(/r\/kibascan/)).toBeTruthy();                  // Footer
  });
});
