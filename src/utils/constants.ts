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

  // Matte Premium surfaces
  cardSurface: '#242424',                      // elevated card background
  hairlineBorder: 'rgba(255,255,255,0.12)',    // crisp inner border
  pressOverlay: 'rgba(255,255,255,0.05)',      // touch feedback underlay

  // Severity (D-136 unified palette)
  severityRed: '#EF4444',
  severityAmber: '#F59E0B',
  severityGreen: '#4ADE80',   // green-400: inline indicators (rows, dots, badges)
  severityNone: '#6B7280',

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

export const SCORING_WEIGHTS = {
  daily_food: { iq: 0.55, np: 0.30, fc: 0.15 },
  daily_food_partial: { iq: 0.78, np: 0, fc: 0.22 }, // D-017: missing GA → normalized 55/15
  supplemental: { iq: 0.65, np: 0.35, fc: 0 },        // D-136: macro-only NP, no formulation
  treat: { iq: 1.0, np: 0, fc: 0 },
} as const;

// ─── Severity Colors Map (single source of truth) ──────

export const SEVERITY_COLORS = {
  danger: Colors.severityRed,
  caution: Colors.severityAmber,
  good: Colors.severityGreen,
  neutral: Colors.severityNone,
} as const;

// ─── Severity Display Labels (UI-facing — DB enum unchanged) ──

export const SEVERITY_DISPLAY_LABELS = {
  danger: 'Severe',
  caution: 'Caution',
  good: 'Good',
  neutral: 'Neutral',
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
  freeAppointmentsMax: 2,
} as const;

// ─── AAFCO Statement Status (standardized copy) ────────

export const AAFCO_STATEMENT_STATUS = {
  /** Product has no AAFCO statement field at all, or the field is null/empty */
  missing: {
    label: 'No AAFCO statement on label',
    collapsedSummary: 'No AAFCO statement found on label',
  },
  /** Product has an AAFCO statement but it doesn't match any recognized pattern */
  unrecognized: {
    label: 'AAFCO statement not recognized',
    collapsedSummary: 'AAFCO statement present but format not recognized',
  },
} as const;

// ─── Misc ───────────────────────────────────────────────

export const MOISTURE_THRESHOLD = 12;
export const BREED_MODIFIER_CAP = 10;
export const CURRENT_SCORING_VERSION = '1';
