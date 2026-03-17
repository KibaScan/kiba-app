// Display name formatting for canonical ingredient names.
// Canonical names use snake_case in the database (e.g. "animal_fat", "bha", "yellow_6").
// This utility converts them to user-facing Title Case with abbreviation handling.

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
