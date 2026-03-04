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
  treat: {
    ingredientQuality: 1.0,
    nutritionalProfile: 0.0,
    formulation: 0.0,
  },
} as const;

// ─── Limits ─────────────────────────────────────────────

export const Limits = {
  freeScansPerWeek: 5,
  freePetsMax: 10, // M3-TODO: revert to 1 when RevenueCat paywall is wired
  premiumPetsMax: 10,
} as const;

// ─── Misc ───────────────────────────────────────────────

export const MOISTURE_THRESHOLD = 12;
export const BREED_MODIFIER_CAP = 10;
