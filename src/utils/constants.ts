// Kiba — Design Tokens & Constants

// ─── Colors (D-086) ─────────────────────────────────────

export const Colors = {
  background: '#1A1A1A',
  card: '#242424',
  cardBorder: '#333333',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  accent: '#00B4D8',
  accentDark: '#0090AD',

  // Severity
  severityRed: '#FF3B30',
  severityAmber: '#FF9500',
  severityGreen: '#34C759',
  severityNone: '#666666',

  // Tab bar
  tabBarBackground: '#1A1A1A',
  tabBarBorder: '#333333',
  tabBarInactive: '#666666',
  tabBarActive: '#00B4D8',
} as const;

// ─── Typography ─────────────────────────────────────────

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  title: 34,
} as const;

// ─── Spacing ────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Scoring Weights ────────────────────────────────────

export const ScoringWeights = {
  dailyFood: {
    ingredientQuality: 0.55,
    nutritionalProfile: 0.30,
    formulation: 0.15,
  },
  supplemental: {
    ingredientQuality: 0.65,
    nutritionalProfile: 0.35,
    formulation: 0.0,
  },
  treat: {
    ingredientQuality: 1.0,
    nutritionalProfile: 0.0,
    formulation: 0.0,
  },
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

export const Limits = {
  freeScansPerWeek: 5,
  freePetsMax: 1,
  premiumPetsMax: 10,
} as const;

// ─── Misc ───────────────────────────────────────────────

export const MOISTURE_THRESHOLD = 12;
export const BREED_MODIFIER_CAP = 10;
