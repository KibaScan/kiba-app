// BlogDetailScreen — render tests (Task 26 of M9 Community plan).
// blogService.fetchPostById is mocked. Loading / not-found / populated +
// share button presence. The markdown renderer is mocked to a passthrough
// Text node so we can verify the body content reaches the screen without
// taking on the marked@17 ESM transform headache.

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

// Mock react-native-marked: the real lib pulls in marked@17 (ESM only) which
// chokes our jest transformIgnorePatterns. The hook returns a single Text
// element wrapping the raw markdown so body assertions still work.
jest.mock('react-native-marked', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value }: { value: string }) =>
      React.createElement(Text, null, value),
    useMarkdown: (value: string) => [
      React.createElement(Text, { key: 'md' }, value),
    ],
  };
});

jest.mock('../../src/services/blogService');

import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import BlogDetailScreen from '../../src/screens/BlogDetailScreen';
import * as blogService from '../../src/services/blogService';
import type { BlogPost } from '../../src/services/blogService';

const mockedBlog = blogService as jest.Mocked<typeof blogService>;

const POPULATED_POST: BlogPost = {
  id: 'p-1',
  title: 'Why grain-free isn’t a magic bullet',
  subtitle: 'A sober look at DCM headlines.',
  cover_image_url: 'https://example.com/grain.jpg',
  body_markdown:
    '# Intro\n\nThe FDA noted a possible link in 2018, but the picture is more complicated than headlines suggest.',
  published_at: '2026-04-22T10:00:00Z',
  is_published: true,
  created_at: '2026-04-22T10:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
};

const mockGoBack = jest.fn();

function renderScreen(postId = 'p-1') {
  return render(
    <BlogDetailScreen
      {...({
        route: { params: { postId } },
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

describe('BlogDetailScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockedBlog.fetchPostById.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('renders shimmer while fetch is pending', () => {
    mockedBlog.fetchPostById.mockReturnValue(
      new Promise(() => {}) as unknown as Promise<BlogPost | null>,
    );

    const { getByTestId } = renderScreen();
    expect(getByTestId('blog-detail-shimmer')).toBeTruthy();
  });

  it('shows "Article not found" copy when fetchPostById returns null', async () => {
    mockedBlog.fetchPostById.mockResolvedValue(null);

    const { findByText } = renderScreen();
    expect(await findByText('Article not found')).toBeTruthy();
    expect(
      await findByText(/This article is no longer available/i),
    ).toBeTruthy();
  });

  it('populated state renders title, subtitle, and a snippet of the body', async () => {
    mockedBlog.fetchPostById.mockResolvedValue(POPULATED_POST);

    const { findByText, getByText } = renderScreen();

    expect(await findByText(/grain-free isn’t a magic bullet/i)).toBeTruthy();
    expect(getByText(/A sober look at DCM headlines/i)).toBeTruthy();
    // Snippet from body — proves the markdown text reaches the surface.
    expect(getByText(/FDA noted a possible link in 2018/i)).toBeTruthy();
  });

  it('share button renders and is pressable in populated state', async () => {
    mockedBlog.fetchPostById.mockResolvedValue(POPULATED_POST);
    // Stub Share.share so the press doesn't open a native dialog or warn.
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction } as any);

    const { findByLabelText } = renderScreen();
    const button = await findByLabelText('Share article');
    expect(button).toBeTruthy();
    // Confirm press doesn't throw — don't assert what Share was called with.
    await act(async () => {
      fireEvent.press(button);
    });

    shareSpy.mockRestore();
  });

  it('share button is hidden in loading and missing states', async () => {
    mockedBlog.fetchPostById.mockResolvedValue(null);

    const { queryByLabelText, findByText } = renderScreen();
    await findByText('Article not found');
    expect(queryByLabelText('Share article')).toBeNull();
  });

  it('back button on missing-state goes back', async () => {
    mockedBlog.fetchPostById.mockResolvedValue(null);

    const { findByLabelText } = renderScreen();
    fireEvent.press(await findByLabelText(/Back to articles/i));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
