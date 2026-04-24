// BlogCarousel — render tests (Task 26 of M9 Community plan).
// blogService.fetchPublishedPosts is mocked so the loading / empty / populated
// branches and tap navigation can be triggered deterministically.

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

jest.mock('../../../src/services/blogService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { BlogCarousel } from '../../../src/components/community/BlogCarousel';
import * as blogService from '../../../src/services/blogService';
import type { BlogPost } from '../../../src/services/blogService';

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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BlogCarousel', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockedBlog.fetchPublishedPosts.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('shows shimmer while fetch is pending', () => {
    mockedBlog.fetchPublishedPosts.mockReturnValue(
      new Promise(() => {}) as unknown as Promise<BlogPost[]>,
    );

    const { getByTestId } = render(<BlogCarousel />);
    expect(getByTestId('blog-carousel-shimmer')).toBeTruthy();
  });

  it('empty state collapses to null (no eyebrow, no see-all chip)', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue([]);

    const { toJSON, queryByText } = render(<BlogCarousel />);
    await flush();

    expect(toJSON()).toBeNull();
    expect(queryByText(/READ/)).toBeNull();
    expect(queryByText(/See all/i)).toBeNull();
  });

  it('populated state renders post titles', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { findByText, getByText } = render(<BlogCarousel />);
    expect(await findByText(/grain-free isn’t a magic bullet/i)).toBeTruthy();
    expect(getByText(/Reading guaranteed analysis/i)).toBeTruthy();
  });

  it('tapping a card navigates to BlogDetail with the postId', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { findByText } = render(<BlogCarousel />);
    const card = await findByText(/grain-free isn’t a magic bullet/i);
    fireEvent.press(card);

    expect(mockNavigate).toHaveBeenCalledWith('BlogDetail', { postId: 'p-1' });
  });

  it('tapping "See all" navigates to BlogList', async () => {
    mockedBlog.fetchPublishedPosts.mockResolvedValue(POSTS);

    const { findByLabelText } = render(<BlogCarousel />);
    const chip = await findByLabelText(/See all articles/i);
    fireEvent.press(chip);

    expect(mockNavigate).toHaveBeenCalledWith('BlogList');
  });

  it('treats fetch failure as empty (collapses, never stuck on shimmer)', async () => {
    mockedBlog.fetchPublishedPosts.mockRejectedValue(new Error('network down'));

    const { toJSON, queryByTestId } = render(<BlogCarousel />);
    await flush();

    expect(toJSON()).toBeNull();
    expect(queryByTestId('blog-carousel-shimmer')).toBeNull();
  });

  it('initialResolved=true with initialPosts skips the fetch entirely', async () => {
    const { getByText } = render(
      <BlogCarousel initialPosts={POSTS} initialResolved />,
    );

    expect(getByText(/grain-free isn’t a magic bullet/i)).toBeTruthy();
    expect(mockedBlog.fetchPublishedPosts).not.toHaveBeenCalled();
  });
});
