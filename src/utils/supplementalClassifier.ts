/**
 * D-136: Detect AAFCO supplemental/intermittent feeding statements.
 * Called at import time (scraper pipeline) to set is_supplemental on products.
 * Simple keyword match — AAFCO language is standardized.
 *
 * IMPORTANT: "supplement" alone must NOT match. Only "supplemental feeding"
 * and specific AAFCO patterns. This prevents D-096 vitamin/mineral supplements
 * (haiku_suggested_category = 'supplement') from being misclassified as
 * D-136 intermittent feeding products (is_supplemental = true).
 */

const SUPPLEMENTAL_PATTERNS: RegExp[] = [
  /intermittent/i,
  /supplemental\s+feeding/i,
  /not\s+intended\s+as\s+a\s+sole\s+diet/i,
  /for\s+supplemental\s+feeding\s+only/i,
  /mix\s+with\b/i,
  /serve\s+alongside/i,
  /not\s+complete\s+and\s+balanced/i,
  /not\s+a\s+complete/i,
];

/** Product name keywords that indicate toppers/mixers (not formal AAFCO). */
const SUPPLEMENTAL_NAME_PATTERNS: RegExp[] = [
  /topper/i,
  /topping/i,
  /meal\s+topper/i,
  /food\s+topper/i,
  /mixer/i,
  /meal\s+mixer/i,
  /meal\s+enhancer/i,
  /meal\s+booster/i,
  /sprinkle/i,
  /dinner\s+dust/i,
  /lickable/i,
];

/** Detect via AAFCO feeding guide language. */
export function isSupplementalProduct(feedingGuide: string | null): boolean {
  if (!feedingGuide || feedingGuide.trim() === '') return false;
  return SUPPLEMENTAL_PATTERNS.some((pattern) => pattern.test(feedingGuide));
}

/** Detect via product name keywords (toppers, mixers, etc.). */
export function isSupplementalByName(productName: string | null): boolean {
  if (!productName || productName.trim() === '') return false;
  return SUPPLEMENTAL_NAME_PATTERNS.some((pattern) => pattern.test(productName));
}
