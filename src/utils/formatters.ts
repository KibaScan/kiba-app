// Formatting utilities for display names and product titles.
// - toDisplayName: canonical_name (snake_case) → user-facing Title Case
// - stripBrandFromName: remove redundant brand prefix from product name
// - getConversationalName: short human-friendly name for CTA text and compare sentences

import type { Product } from '../types';

/** Known abbreviations that should remain fully uppercase. */
const UPPERCASE_WORDS = new Set([
  'bha', 'bht', 'tbhq', 'dha', 'epa', 'aafco', 'nfe',
]);

/**
 * Canonical-name overrides for ingredients stored without underscore
 * separators (e.g. legacy rows where "meatbyproducts" was imported as one
 * token). Migration 030 normalized these at the data layer, so this map is
 * now defensive — it catches any stale cache, test fixture, or future
 * re-import that slips through. Safe to leave in place.
 */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  meatbyproducts: 'Meat By-Products',
  poultrybyproducts: 'Poultry By-Products',
  chickenbyproducts: 'Chicken By-Products',
  beefbyproducts: 'Beef By-Products',
  meatbyproductmeal: 'Meat By-Product Meal',
  poultrybyproductmeal: 'Poultry By-Product Meal',
};

/**
 * Convert a canonical_name (snake_case) to a human-readable display name.
 * - Splits on underscores
 * - Capitalizes first letter of each word
 * - Known abbreviations stay fully uppercase (BHA, DHA, etc.)
 * - Numbers stay as-is (yellow_6 → "Yellow 6")
 * - Legacy jammed canonicals routed through DISPLAY_NAME_OVERRIDES
 *
 * Falls back to display_name if available on the ingredient object.
 */
export function toDisplayName(canonicalName: string): string {
  const override = DISPLAY_NAME_OVERRIDES[canonicalName.toLowerCase()];
  if (override) return override;

  return canonicalName
    .split('_')
    .map((word) => {
      if (UPPERCASE_WORDS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Resolve life stage claim to species-appropriate display label.
 * "puppy/kitten" → "Puppy" (dog) or "Kitten" (cat).
 */
export function resolveLifeStageLabel(
  lifeStageClaim: string,
  targetSpecies: 'dog' | 'cat',
): string {
  const trimmed = lifeStageClaim.trim().toLowerCase();

  if (trimmed === 'puppy/kitten' || trimmed === 'puppy / kitten') {
    return targetSpecies === 'dog' ? 'Puppy' : 'Kitten';
  }
  if (trimmed === 'puppy') return 'Puppy';
  if (trimmed === 'kitten') return 'Kitten';
  if (trimmed === 'all life stages') return 'All Life Stages';
  if (trimmed === 'adult maintenance' || trimmed === 'adult') return 'Adult';
  if (trimmed === 'growth') return 'Growth';

  // Fallback: title case, truncate at 20 chars
  const titleCased = lifeStageClaim.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCased.length > 20 ? titleCased.slice(0, 20) + '\u2026' : titleCased;
}

/**
 * Strip redundant brand prefix from product name.
 * Two-pass: (1) exact prefix match, (2) brand found within first 40 chars
 * (handles parent brand patterns like "Purina Cat Chow ...").
 * Word-boundary checked. Returns original name if remainder would be < 10 chars.
 */
export function stripBrandFromName(brandName: string, productName: string): string {
  if (!brandName || !productName) return productName;
  const lower = productName.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Pass 1: exact prefix match at position 0
  if (lower.startsWith(brandLower)) {
    const remainder = productName.slice(brandName.length).replace(/^[\s\-\u2013\u2014]+/, '');
    if (remainder.length >= 10) return remainder;
    return productName;
  }

  // Pass 2: brand found within first 40 chars (parent brand prefix pattern)
  // Skip for very short brand names — too likely to false-match inside other words
  if (brandLower.length < 5) return productName;
  const searchZone = lower.slice(0, 40);
  const idx = searchZone.indexOf(brandLower);
  if (idx < 0) return productName;

  // Word boundary check: char before match must be space or start-of-string
  if (idx > 0 && searchZone[idx - 1] !== ' ') return productName;
  // Char after match must be space or end-of-string
  const afterIdx = idx + brandLower.length;
  if (afterIdx < lower.length && lower[afterIdx] !== ' ') return productName;

  const remainder = productName.slice(afterIdx).replace(/^[\s\-\u2013\u2014]+/, '');
  if (remainder.length < 10) return productName;
  return remainder;
}

// ─── Conversational (Short) Product Name ─────────────────

/**
 * Noise words that bloat SEO product titles but add no disambiguation value
 * in conversational UI (CTA buttons, key-difference sentences). Stripped
 * after brand removal, before descriptor-word selection.
 */
const NOISE_WORDS_RE = /\b(cat\s*food|dog\s*food|canned|wet|dry|kibble|recipe|formula|bag|case|pack|pouch|pouches|tray|trays|can|cans|box|grain[-\s]?free)\b/gi;

/**
 * Short, human-readable product reference for use in sentences and buttons.
 *
 * Examples:
 *  "Feline Natural" + "Feline Natural Chicken & Venison Feast Grain-Free
 *    Canned Cat Food, 6-oz, case of 12"
 *    → "Feline Natural Chicken & Venison"
 *  "9 Lives" + "9 Lives Bites Real Chicken in Gravy Wet Cat Food, 5.5-oz…"
 *    → "9 Lives Bites Real"
 *  "Purina Pro Plan" + "Purina Pro Plan Sensitive Skin & Stomach Adult
 *    Salmon Formula Dry Dog Food"
 *    → "Purina Pro Plan Sensitive Skin"
 *
 * Algorithm:
 *  1. Cut name at first comma (drops ", 6-oz, case of 12" style suffixes).
 *  2. Strip redundant brand prefix via stripBrandFromName.
 *  3. Remove noise words ("Cat Food", "Canned", "Grain-Free", etc.).
 *  4. Take brand + first 2 descriptor tokens (connectors like "&" / "with"
 *     are preserved between descriptors but don't count toward the limit).
 *  5. If result > 34 chars → brand + 1 descriptor.
 *  6. If still > 34 chars → brand alone.
 *  7. If no brand → first 2 descriptor tokens (fallback).
 *
 * Cap of 34 admits "Brand Foo & Bar" patterns (e.g. "Feline Natural
 * Chicken & Venison" = 32 chars). Shorter caps force brand-only output
 * on any product with a 3-word ampersand phrase after the brand.
 */
export function getConversationalName(product: Pick<Product, 'brand' | 'name'>): string {
  const brand = (product.brand ?? '').trim();
  const fullName = (product.name ?? '').trim();
  if (!fullName && !brand) return '';
  if (!fullName) return brand;

  // 1. Chop off SEO tail after first comma
  const preComma = fullName.split(',')[0].trim();

  // 2. Strip brand prefix
  const afterBrand = brand ? stripBrandFromName(brand, preComma) : preComma;
  // If stripBrandFromName returned the same string (brand not at prefix),
  // use the pre-comma name as-is for descriptor selection.
  const descriptorSource = afterBrand === preComma && brand && preComma.toLowerCase().startsWith(brand.toLowerCase())
    ? preComma.slice(brand.length).trim()
    : afterBrand;

  // 3. Strip noise words, collapse extra whitespace
  const cleaned = descriptorSource
    .replace(NOISE_WORDS_RE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-\u2013\u2014]+|[\s\-\u2013\u2014]+$/g, '')
    .trim();

  const tokens = cleaned.length > 0 ? cleaned.split(/\s+/) : [];

  /**
   * Connector tokens are joiners between two descriptor words (e.g. "Chicken
   * & Venison", "Chicken with Rice"). They do not count toward the descriptor
   * limit but are preserved in the output so the phrase reads naturally.
   */
  const CONNECTOR_RE = /^(&|and|\+|with|in)$/i;

  const takeFirstNDescriptors = (n: number): string => {
    const picked: string[] = [];
    let meaningful = 0;
    for (const tok of tokens) {
      if (CONNECTOR_RE.test(tok)) {
        // Include connectors only between meaningful words we've already taken
        // and a next meaningful word we still intend to take.
        if (meaningful > 0 && meaningful < n) picked.push(tok);
        continue;
      }
      if (meaningful >= n) break;
      picked.push(tok);
      meaningful++;
    }
    // Drop trailing connector if we stopped before a paired meaningful word
    while (picked.length > 0 && CONNECTOR_RE.test(picked[picked.length - 1])) {
      picked.pop();
    }
    return picked.join(' ');
  };

  const build = (descriptorCount: number): string => {
    const descriptors = takeFirstNDescriptors(descriptorCount);
    if (brand && descriptors) return `${brand} ${descriptors}`;
    if (brand) return brand;
    return descriptors;
  };

  // 4. Brand + 2 descriptors (cap 34 — accommodates "Brand Foo & Bar" pattern)
  let result = build(2);
  // 5. Fall back to brand + 1 descriptor if too long
  if (result.length > 34) result = build(1);
  // 6. Last resort: brand alone (or the pre-comma full name if no brand)
  if (result.length > 34) result = brand || preComma;

  return result;
}

// ─── Brand Sanitization ──────────────────────────────────

/**
 * Sanitize brand names containing raw database delimiters.
 * "Milk-Bone||Purina Beneful" → "Milk-Bone · Purina Beneful"
 * Preserves all brand names for search result accuracy.
 */
export function sanitizeBrand(brand: string): string {
  if (!brand || !brand.includes('||')) return brand;
  return brand.split('||').map((b) => b.trim()).filter(Boolean).join(' · ');
}

// ─── Relative Time ────────────────────────────────────────

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format an ISO date string as a past-focused relative time.
 * "Just now" / "5m ago" / "2h ago" / "Yesterday" / "3d ago" / "Mar 15"
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60_000) return 'Just now';

  // Calendar-day comparison — check before hours so "yesterday at 11pm" isn't "1h ago"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff >= 2 && dayDiff <= 6) return `${dayDiff}d ago`;
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// ─── Serving Size Formatting ────────────────────────────

/**
 * Clamp a serving/cup value to 1 decimal place for display.
 * Returns '0' for null/undefined/NaN. Trailing zeros are not rendered
 * (so 1.0 prints as '1'). Negative values are preserved — caller is
 * responsible for semantic validation.
 */
export function formatServing(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';
  return String(Math.round(value * 10) / 10);
}
