// Formatting utilities for display names and product titles.
// - toDisplayName: canonical_name (snake_case) → user-facing Title Case
// - stripBrandFromName: remove redundant brand prefix from product name

/** Known abbreviations that should remain fully uppercase. */
const UPPERCASE_WORDS = new Set([
  'bha', 'bht', 'tbhq', 'dha', 'epa', 'aafco', 'nfe',
]);

/**
 * Convert a canonical_name (snake_case) to a human-readable display name.
 * - Splits on underscores
 * - Capitalizes first letter of each word
 * - Known abbreviations stay fully uppercase (BHA, DHA, etc.)
 * - Numbers stay as-is (yellow_6 → "Yellow 6")
 *
 * Falls back to display_name if available on the ingredient object.
 */
export function toDisplayName(canonicalName: string): string {
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
