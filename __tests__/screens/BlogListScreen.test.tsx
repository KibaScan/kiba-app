// BlogListScreen — render tests (Task 26 of M9 Community plan).
// blogService.fetchPublishedPosts is mocked. Empty + populated branches plus
// tap-to-detail navigation.

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

jest.mock('../../src/services/blogService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import BlogListScreen from '../../src/screens/BlogListScreen';
import * as blogService from '../../src/services/blogService';
import type { BlogPost } from '../../src/services/blogService';

const mockedBlog = blogService as jest.Mocked<typeof blogService>;

const POSTS: BlogPost[] = [
  {
    id: 'p-1',
    title: 'Why grain-free isn’t a magic bullet',
    subtitle: 'A sober look at DCM headlines.',
    cover_image_url: 'https://example.com/grain.jpg',
    body_markdown: '# Body',
    published_at: '2026-04-22T10:00:00Z',
    is_published: true,
    created_at: '2026-04-22T10:00:00Z',
    updated_at: '2026-04-22T10:00:00Z',
  },
  {
    id: 'p-2',
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

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

function renderScreen() {
  return render(
    <BlogListScreen
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

describe('BlogListScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockedBlog.fetchPublishedPosts.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('shows empty state copy when no posts (after fetch resolves)', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue([]);

    const { findByText } = renderScreen();
    expect(await findByText(/No articles yet/i)).toBeTruthy();
    expect(await findByText(/Check back soon/i)).toBeTruthy();
  });

  it('does NOT show empty copy while loading', () => {
    // Never-resolving promise locks the loading branch.
    mockedBlog.fetchPublishedPosts.mockReturnValue(
      new Promise(() => {}) as unknown as Promise<BlogPost[]>,
    );

    const { queryByText, getByTestId } = renderScreen();
    expect(queryByText(/No articles yet/i)).toBeNull();
    expect(getByTestId('blog-list-shimmer')).toBeTruthy();
  });

  it('populated state renders all post titles', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { findByText, getByText } = renderScreen();
    expect(await findByText(/grain-free isn’t a magic bullet/i)).toBeTruthy();
    expect(getByText(/Reading guaranteed analysis/i)).toBeTruthy();
  });

  it('tapping a card navigates to BlogDetail with the postId', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { findByText } = renderScreen();
    const card = await findByText(/grain-free isn’t a magic bullet/i);
    fireEvent.press(card);

    expect(mockNavigate).toHaveBeenCalledWith('BlogDetail', { postId: 'p-1' });
  });

  it('header back button calls navigation.goBack', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
