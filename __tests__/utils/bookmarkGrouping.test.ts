import { groupBookmarksByCategory } from '../../src/utils/bookmarkGrouping';
import type { BookmarkCardData } from '../../src/types/bookmark';
import { CATEGORY_ICONS_FILLED } from '../../src/constants/iconMaps';

function makeCard(overrides: {
  id?: string;
  category: 'daily_food' | 'treat';
  is_supplemental?: boolean;
  is_recalled?: boolean;
  is_vet_diet?: boolean;
  is_variety_pack?: boolean;
  final_score?: number | null;
  created_at?: string;
}): BookmarkCardData {
  const id = overrides.id ?? 'bm-' + Math.random().toString(36).slice(2, 8);
  return {
    bookmark: {
      id,
      user_id: 'u1',
      pet_id: 'p1',
      product_id: 'prod-' + id,
      created_at: overrides.created_at ?? '2026-04-21T00:00:00Z',
    },
    product: {
      id: 'prod-' + id,
      brand: 'Brand',
      name: 'Product',
      category: overrides.category,
      image_url: null,
      is_recalled: overrides.is_recalled ?? false,
      is_vet_diet: overrides.is_vet_diet ?? false,
      is_variety_pack: overrides.is_variety_pack ?? false,
      is_supplemental: overrides.is_supplemental ?? false,
      target_species: 'dog',
    },
    final_score: 'final_score' in overrides ? (overrides.final_score ?? null) : 80,
  };
}

describe('groupBookmarksByCategory', () => {
  it('returns empty array for empty input', () => {
    expect(groupBookmarksByCategory([])).toEqual([]);
  });

  it('daily_food + !is_supplemental → Daily Food bucket', () => {
    const cards = [makeCard({ category: 'daily_food', is_supplemental: false })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('daily_food');
    expect(sections[0].data).toHaveLength(1);
  });

  it('daily_food + is_supplemental → Toppers & Mixers bucket', () => {
    const cards = [makeCard({ category: 'daily_food', is_supplemental: true })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('toppers_mixers');
  });

  it('treat → Treats bucket (is_supplemental ignored)', () => {
    const cards = [makeCard({ category: 'treat', is_supplemental: false })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('treat + is_supplemental (edge case) → Treats bucket', () => {
    const cards = [makeCard({ category: 'treat', is_supplemental: true })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('multiple cards in mixed buckets → all 3 sections returned in order', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food' }),
      makeCard({ id: 'b', category: 'daily_food', is_supplemental: true }),
      makeCard({ id: 'c', category: 'treat' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections.map((s) => s.key)).toEqual(['daily_food', 'toppers_mixers', 'treats']);
  });
});

describe('groupBookmarksByCategory — empty bucket filter', () => {
  it('omits sections with zero cards', () => {
    const cards = [makeCard({ category: 'treat' })];
    const sections = groupBookmarksByCategory(cards);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('treats');
  });

  it('returns only populated buckets when 2 of 3 have cards', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food' }),
      makeCard({ id: 'b', category: 'treat' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections.map((s) => s.key)).toEqual(['daily_food', 'treats']);
  });
});

describe('groupBookmarksByCategory — sort scored DESC', () => {
  it('orders scored cards in a bucket by final_score DESC', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food', final_score: 70 }),
      makeCard({ id: 'b', category: 'daily_food', final_score: 90 }),
      makeCard({ id: 'c', category: 'daily_food', final_score: 80 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.final_score)).toEqual([90, 80, 70]);
  });

  it('breaks ties by bookmark.created_at DESC', () => {
    const cards = [
      makeCard({ id: 'old', category: 'daily_food', final_score: 85, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'new', category: 'daily_food', final_score: 85, created_at: '2026-04-21T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['new', 'old']);
  });
});

describe('groupBookmarksByCategory — recalled pinned', () => {
  it('pins a recalled card above a higher-scored scored card in the same bucket', () => {
    const cards = [
      makeCard({ id: 'top-scored', category: 'daily_food', final_score: 99, is_recalled: false }),
      makeCard({ id: 'recalled', category: 'daily_food', final_score: null, is_recalled: true }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['recalled', 'top-scored']);
  });

  it('orders multiple recalled cards by created_at DESC within the pinned tier', () => {
    const cards = [
      makeCard({ id: 'old-recall', category: 'treat', is_recalled: true, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'new-recall', category: 'treat', is_recalled: true, created_at: '2026-04-21T00:00:00Z' }),
      makeCard({ id: 'scored', category: 'treat', final_score: 80 }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual([
      'new-recall',
      'old-recall',
      'scored',
    ]);
  });
});

describe('groupBookmarksByCategory — bypass/unscored tier', () => {
  it('sinks vet_diet below scored in same bucket', () => {
    const cards = [
      makeCard({ id: 'vet', category: 'daily_food', is_vet_diet: true, final_score: null, created_at: '2026-04-21T00:00:00Z' }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 70, created_at: '2026-04-22T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'vet']);
  });

  it('sinks variety_pack below scored in same bucket', () => {
    const cards = [
      makeCard({ id: 'vp', category: 'daily_food', is_variety_pack: true, final_score: null, created_at: '2026-04-21T00:00:00Z' }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 65, created_at: '2026-04-22T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'vp']);
  });

  it('sinks cache-miss (null score, no bypass flag) below scored', () => {
    const cards = [
      makeCard({ id: 'miss', category: 'daily_food', final_score: null, created_at: '2026-04-21T00:00:00Z' }),
      makeCard({ id: 'scored', category: 'daily_food', final_score: 60, created_at: '2026-04-22T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['scored', 'miss']);
  });

  it('orders multiple unscored cards by created_at DESC', () => {
    const cards = [
      makeCard({ id: 'a', category: 'daily_food', final_score: null, created_at: '2026-04-01T00:00:00Z' }),
      makeCard({ id: 'b', category: 'daily_food', final_score: null, created_at: '2026-04-21T00:00:00Z' }),
    ];
    const sections = groupBookmarksByCategory(cards);
    expect(sections[0].data.map((c) => c.bookmark.id)).toEqual(['b', 'a']);
  });
});

describe('groupBookmarksByCategory — section meta', () => {
  it('daily_food section has label "Daily Food" and the daily-food filled icon', () => {
    const sections = groupBookmarksByCategory([makeCard({ category: 'daily_food' })]);
    expect(sections[0].label).toBe('Daily Food');
    expect(sections[0].iconSource).toBe(CATEGORY_ICONS_FILLED.daily_food);
  });

  it('toppers_mixers section has label "Toppers & Mixers" and the toppers-mixers filled icon', () => {
    const sections = groupBookmarksByCategory([
      makeCard({ category: 'daily_food', is_supplemental: true }),
    ]);
    expect(sections[0].label).toBe('Toppers & Mixers');
    expect(sections[0].iconSource).toBe(CATEGORY_ICONS_FILLED.toppers_mixers);
  });

  it('treats section has label "Treats" and the treat filled icon', () => {
    const sections = groupBookmarksByCategory([makeCard({ category: 'treat' })]);
    expect(sections[0].label).toBe('Treats');
    expect(sections[0].iconSource).toBe(CATEGORY_ICONS_FILLED.treat);
  });
});
