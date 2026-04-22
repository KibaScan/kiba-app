// Derives the display state for a BookmarkRow.
//
// Split matters for UX: `final_score == null` previously collapsed into a
// generic `—` chip that was indistinguishable from a deliberate bypass
// (vet diet / variety pack). On a cold-start cache miss, every row rendered
// `—` until the JIT re-hydrate finished — users saw "nothing scored" instead
// of "scores loading." This helper separates pending (transient) from
// bypass (deliberate, will never score).

import { getScoreColor } from './constants';
import type { BookmarkCardData } from '../types/bookmark';

export type BookmarkRowState =
  | { kind: 'recalled' }
  | { kind: 'scored'; score: number; color: string }
  | { kind: 'bypass'; reason: 'vet_diet' | 'variety_pack' }
  | { kind: 'pending' };

/**
 * Precedence: recalled > bypass > scored > pending.
 *
 * - `recalled` — D-158 bypass; show red chip, no score.
 * - `bypass`   — `is_vet_diet` or `is_variety_pack`; deliberate, will never score.
 * - `scored`   — live cache hit on `pet_product_scores`.
 * - `pending`  — not yet scored (JIT re-hydrate in flight or cache wipe).
 */
export function deriveBookmarkRowState(card: BookmarkCardData): BookmarkRowState {
  if (card.product.is_recalled) {
    return { kind: 'recalled' };
  }
  if (card.product.is_vet_diet) {
    return { kind: 'bypass', reason: 'vet_diet' };
  }
  if (card.product.is_variety_pack) {
    return { kind: 'bypass', reason: 'variety_pack' };
  }
  if (card.final_score != null) {
    return {
      kind: 'scored',
      score: card.final_score,
      color: getScoreColor(card.final_score, card.product.is_supplemental),
    };
  }
  return { kind: 'pending' };
}
