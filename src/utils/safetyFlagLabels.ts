// Kiba — M9 Community Safety Flag Display Labels
// Single source of truth for ScoreFlagReason / ScoreFlagStatus → UI copy.
// Used by:
//   - SafetyFlagSheet (Task 27 — radio group + accessibility labels)
//   - SafetyFlagsScreen (Task 28 — My Flags rows + status chips)
//   - SafetyFlagRow / CommunityActivitySummary (Task 28 — per-row + bars)
//
// UPVM-compliant copy (D-095). Kept here so a copy change ships once.

import { Colors } from './constants';
import type { ScoreFlagReason, ScoreFlagStatus } from '../types/scoreFlag';

// ─── Reason labels ──────────────────────────────────────

export const REASON_LABELS: Record<ScoreFlagReason, string> = {
  score_wrong: 'Score seems off',
  ingredient_missing: 'Ingredient missing or wrong',
  recalled: 'I think this is recalled',
  data_outdated: 'Information looks outdated',
  recipe_concern: 'Recipe safety concern',
  other: 'Something else',
};

/**
 * Canonical display order. Used by the sheet's radio group and the screen's
 * Community Activity bars so a reason without server data still appears in the
 * same slot every time. Keep in sync if a new reason is added to the enum.
 */
export const DEFAULT_REASON_ORDER: ScoreFlagReason[] = [
  'score_wrong',
  'ingredient_missing',
  'recalled',
  'data_outdated',
  'recipe_concern',
  'other',
];

// ─── Status labels + chip palette ───────────────────────

export const STATUS_LABELS: Record<ScoreFlagStatus, string> = {
  open: 'Open',
  reviewed: 'Under review',
  resolved: 'Resolved',
  rejected: 'Closed',
};

/**
 * Severity palette for status chips. Pairs background tint + foreground text
 * color for adequate contrast on Matte Premium dark surfaces.
 *   open      → amber  (waiting)
 *   reviewed  → accent (active triage)
 *   resolved  → green  (handled)
 *   rejected  → neutral gray (closed without action)
 */
export const STATUS_CHIP_COLORS: Record<
  ScoreFlagStatus,
  { background: string; foreground: string }
> = {
  open: {
    background: Colors.severityAmberTint,
    foreground: Colors.severityAmber,
  },
  reviewed: {
    background: Colors.accentTint,
    foreground: Colors.accent,
  },
  resolved: {
    background: 'rgba(74,222,128,0.15)',
    foreground: Colors.severityGreen,
  },
  rejected: {
    background: Colors.chipSurface,
    foreground: Colors.textSecondary,
  },
};
