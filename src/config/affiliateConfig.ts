// Kiba — Affiliate Program Configuration
// Centralized affiliate tag config. Both retailers default to `enabled: false`
// until Kiba enrolls in Chewy Affiliate Partners and Amazon Associates.
// Flip `enabled` to true after enrollment — buttons will render automatically.

export const AFFILIATE_CONFIG = {
  chewy: {
    tag: 'kiba-20',             // placeholder — replace with real Chewy affiliate ID
    baseUrl: 'https://www.chewy.com',
    enabled: false,             // flip true after Chewy Affiliate Partners enrollment
  },
  amazon: {
    tag: 'kiba-20',             // placeholder — replace with real Amazon Associates tag
    baseUrl: 'https://www.amazon.com',
    enabled: false,             // flip true after Amazon Associates enrollment
  },
} as const;
