// Formatting utilities — Scoring-only subset for Edge Function.
// Full implementation lives in src/utils/formatters.ts.

/** Known abbreviations that should remain fully uppercase. */
const UPPERCASE_WORDS = new Set([
  'bha', 'bht', 'tbhq', 'dha', 'epa', 'aafco', 'nfe',
]);

/**
 * Convert a canonical_name (snake_case) to a human-readable display name.
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
