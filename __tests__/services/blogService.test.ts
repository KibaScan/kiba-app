// blogService — fetchPublishedPosts + fetchPostById tests.

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { fetchPublishedPosts, fetchPostById } from '../../src/services/blogService';
import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

const SAMPLE_POST = {
  id: 'post-1',
  title: 'Why DCM matters',
  subtitle: 'A primer',
  cover_image_url: 'https://cdn/test.jpg',
  body_markdown: '# heading\n\nbody',
  published_at: '2026-04-01T00:00:00Z',
  is_published: true,
  created_at: '2026-03-30T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

// ─── fetchPublishedPosts ────────────────────────────────

describe('fetchPublishedPosts', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchPublishedPosts()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries blog_posts filtered + ordered + limited (default 20)', async () => {
    const chain = mockChain({ data: [SAMPLE_POST], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchPublishedPosts();

    expect(supabase.from).toHaveBeenCalledWith('blog_posts');
    expect(chain.eq).toHaveBeenCalledWith('is_published', true);
    expect(chain.order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([SAMPLE_POST]);
  });

  test('honors custom limit', async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await fetchPublishedPosts(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  test('returns [] on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchPublishedPosts()).resolves.toEqual([]);
  });
});

// ─── fetchPostById ──────────────────────────────────────

describe('fetchPostById', () => {
  test('returns null when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchPostById('post-1')).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns post when found', async () => {
    const chain = mockChain({ data: SAMPLE_POST, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchPostById('post-1');

    expect(supabase.from).toHaveBeenCalledWith('blog_posts');
    expect(chain.eq).toHaveBeenCalledWith('id', 'post-1');
    expect(result).toEqual(SAMPLE_POST);
  });

  test('returns null when no row matches', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchPostById('nope')).resolves.toBeNull();
  });

  test('returns null on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchPostById('post-1')).resolves.toBeNull();
  });
});
