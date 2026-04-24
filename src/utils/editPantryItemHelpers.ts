// editPantryItemHelpers.ts
// Pure helpers extracted from EditPantryItemScreen.
// Exported for testability (see __tests__/screens/EditPantryItemScreen.test.ts).
// D-158 / D-155 / D-164 context is in the screen file.

import type { FeedingFrequency } from '../types/pantry';
import { updatePetAssignment } from '../services/pantryService';

// ─── formatTime ──────────────────────────────────────────

export function formatTime(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${mStr} ${period}`;
}

// ─── buildFrequencyUpdate ────────────────────────────────

/**
 * Build the assignment update payload for a schedule-toggle change.
 * Schedule is the single source of truth for both feeding_frequency AND
 * auto_deplete_enabled (daily → true, as_needed → false). Toggling to
 * as_needed also forces notifications_on=false; toggling to daily leaves
 * notifications_on untouched so the user's existing preference is preserved.
 */
export function buildFrequencyUpdate(
  freq: FeedingFrequency,
): Parameters<typeof updatePetAssignment>[1] {
  const isDaily = freq === 'daily';
  const updates: Parameters<typeof updatePetAssignment>[1] = {
    feeding_frequency: freq,
    auto_deplete_enabled: isDaily,
  };
  if (!isDaily) {
    updates.notifications_on = false;
  }
  return updates;
}

// ─── shouldShowFedTodayCard ──────────────────────────────

export interface FedTodayCardVisibilityState {
  feedingFrequency: FeedingFrequency;
  isEmpty: boolean;
  isActive: boolean;
  isRecalled: boolean;
}

/**
 * Returns true when the "Fed This Today" Featured Action Card should render
 * at the top of EditPantryItemScreen. Gated to as_needed items that are
 * meaningfully loggable — hides on daily (auto-deplete handles it), empty
 * (nothing to deduct), recalled (bypass per D-158), or soft-deleted.
 * See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md §3b.
 */
export function shouldShowFedTodayCard(state: FedTodayCardVisibilityState): boolean {
  return (
    state.feedingFrequency === 'as_needed' &&
    !state.isEmpty &&
    state.isActive &&
    !state.isRecalled
  );
}
