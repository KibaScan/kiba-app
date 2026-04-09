// Kiba — Scoring Constants (Edge Function subset)
// Full constants live in src/utils/constants.ts.

// ─── Scoring Weights ────────────────────────────────────

export const SCORING_WEIGHTS = {
  daily_food: { iq: 0.55, np: 0.30, fc: 0.15 },
  daily_food_partial: { iq: 0.78, np: 0, fc: 0.22 }, // D-017: missing GA → normalized 55/15
  supplemental: { iq: 0.65, np: 0.35, fc: 0 },        // D-136: macro-only NP, no formulation
  treat: { iq: 1.0, np: 0, fc: 0 },
} as const;

// ─── Score Ring Colors (D-136 — supersedes D-113) ──────

export const SCORE_COLORS = {
  daily: {
    excellent: '#22C55E',
    good: '#86EFAC',
    fair: '#FACC15',
    low: '#F59E0B',
    poor: '#EF4444',
  },
  supplemental: {
    excellent: '#14B8A6',
    good: '#22D3EE',
    fair: '#FACC15',
    low: '#F59E0B',
    poor: '#EF4444',
  },
} as const;

export function getScoreColor(score: number, isSupplemental = false): string {
  const palette = isSupplemental ? SCORE_COLORS.supplemental : SCORE_COLORS.daily;
  if (score >= 85) return palette.excellent;
  if (score >= 70) return palette.good;
  if (score >= 65) return palette.fair;
  if (score >= 51) return palette.low;
  return palette.poor;
}

export function getVerdictLabel(score: number, petName: string | null): string {
  const tier =
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Good' :
    score >= 65 ? 'Fair' :
    score >= 51 ? 'Low' :
    'Poor';
  return petName ? `${tier} match for ${petName}` : `${tier} match`;
}

// ─── Limits ─────────────────────────────────────────────

export const MOISTURE_THRESHOLD = 12;
export const BREED_MODIFIER_CAP = 10;
export const CURRENT_SCORING_VERSION = '5';
