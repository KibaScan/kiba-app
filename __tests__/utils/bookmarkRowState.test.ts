import { deriveBookmarkRowState } from '../../src/utils/bookmarkRowState';
import type { BookmarkCardData } from '../../src/types/bookmark';

function mockCard(overrides: Partial<BookmarkCardData['product']> & {
  final_score?: number | null;
}): BookmarkCardData {
  return {
    bookmark: {
      id: 'b1',
      user_id: 'u1',
      pet_id: 'pet-1',
      product_id: 'prod-1',
      created_at: '2026-04-21T00:00:00Z',
    },
    product: {
      id: 'prod-1',
      brand: 'Brand',
      name: 'Product',
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

describe('deriveBookmarkRowState', () => {
  it('returns `recalled` when the product is recalled — wins over all other flags', () => {
    const state = deriveBookmarkRowState(
      mockCard({ is_recalled: true, is_vet_diet: true, final_score: 50 }),
    );
    expect(state.kind).toBe('recalled');
  });

  it('returns `bypass` vet_diet when vet diet and not recalled', () => {
    const state = deriveBookmarkRowState(mockCard({ is_vet_diet: true, final_score: null }));
    expect(state).toEqual({ kind: 'bypass', reason: 'vet_diet' });
  });

  it('returns `bypass` vet_diet even when a stale score exists', () => {
    // Vet diet is a deliberate bypass — a leftover cached score should not override the chip.
    const state = deriveBookmarkRowState(mockCard({ is_vet_diet: true, final_score: 77 }));
    expect(state).toEqual({ kind: 'bypass', reason: 'vet_diet' });
  });

  it('returns `bypass` variety_pack when variety pack and not recalled / vet diet', () => {
    const state = deriveBookmarkRowState(mockCard({ is_variety_pack: true, final_score: null }));
    expect(state).toEqual({ kind: 'bypass', reason: 'variety_pack' });
  });

  it('returns `scored` with color on a live cache hit', () => {
    const state = deriveBookmarkRowState(mockCard({ final_score: 84 }));
    if (state.kind !== 'scored') throw new Error('expected scored');
    expect(state.score).toBe(84);
    expect(typeof state.color).toBe('string');
    expect(state.color).toMatch(/^#/);
  });

  it('returns `pending` when no bypass flags and final_score is null — the cache-miss case', () => {
    const state = deriveBookmarkRowState(mockCard({ final_score: null }));
    expect(state).toEqual({ kind: 'pending' });
  });

  it('distinguishes pending from bypass for the same null final_score', () => {
    const bypass = deriveBookmarkRowState(mockCard({ is_vet_diet: true, final_score: null }));
    const pending = deriveBookmarkRowState(mockCard({ final_score: null }));
    expect(bypass.kind).toBe('bypass');
    expect(pending.kind).toBe('pending');
  });
});
