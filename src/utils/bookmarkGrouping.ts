// Pure helpers — group bookmark cards by product category with tiered sort.
// See docs/superpowers/specs/2026-04-21-bookmarks-polish-design.md §2.

import type { ImageSourcePropType } from 'react-native';
import type { BookmarkCardData } from '../types/bookmark';
import { CATEGORY_ICONS_FILLED } from '../constants/iconMaps';

export type BookmarkSectionKey = 'daily_food' | 'toppers_mixers' | 'treats';

export interface BookmarkSection {
  key: BookmarkSectionKey;
  label: string;
  iconSource: ImageSourcePropType;
  data: BookmarkCardData[];
}

const SECTION_ORDER: BookmarkSectionKey[] = ['daily_food', 'toppers_mixers', 'treats'];

// iconMaps keys `treat` (singular) — section key is `treats` (plural). Map inline.
const SECTION_META: Record<BookmarkSectionKey, { label: string; iconSource: ImageSourcePropType }> = {
  daily_food: { label: 'Daily Food', iconSource: CATEGORY_ICONS_FILLED.daily_food },
  toppers_mixers: { label: 'Toppers & Mixers', iconSource: CATEGORY_ICONS_FILLED.toppers_mixers },
  treats: { label: 'Treats', iconSource: CATEGORY_ICONS_FILLED.treat },
};

/**
 * Determine which bucket a card belongs to based on product category and supplemental flag.
 * Treats take precedence; then supplemental topper/mixer; then daily food.
 */
function bucketOf(card: BookmarkCardData): BookmarkSectionKey {
  // Treats always map to treats bucket, regardless of is_supplemental
  if (card.product.category === 'treat') return 'treats';
  // daily_food category: check if it's a supplemental (topper/mixer)
  if (card.product.is_supplemental) return 'toppers_mixers';
  return 'daily_food';
}

function createdAtDesc(a: BookmarkCardData, b: BookmarkCardData): number {
  return b.bookmark.created_at.localeCompare(a.bookmark.created_at);
}

function sortWithinSection(cards: BookmarkCardData[]): BookmarkCardData[] {
  const recalled = cards.filter((c) => c.product.is_recalled);
  const scored = cards.filter(
    (c) =>
      !c.product.is_recalled &&
      c.final_score != null &&
      !c.product.is_vet_diet &&
      !c.product.is_variety_pack,
  );
  const unscored = cards.filter(
    (c) =>
      !c.product.is_recalled &&
      (c.final_score == null || c.product.is_vet_diet || c.product.is_variety_pack),
  );

  recalled.sort(createdAtDesc);
  scored.sort((a, b) => {
    const scoreDiff = (b.final_score ?? 0) - (a.final_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return createdAtDesc(a, b);
  });
  unscored.sort(createdAtDesc);

  return [...recalled, ...scored, ...unscored];
}

export function groupBookmarksByCategory(
  cards: BookmarkCardData[],
): BookmarkSection[] {
  if (cards.length === 0) return [];

  const buckets: Record<BookmarkSectionKey, BookmarkCardData[]> = {
    daily_food: [],
    toppers_mixers: [],
    treats: [],
  };

  for (const card of cards) {
    buckets[bucketOf(card)].push(card);
  }

  return SECTION_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: SECTION_META[key].label,
      iconSource: SECTION_META[key].iconSource,
      data: sortWithinSection(buckets[key]),
    }));
}
