// Ingredient Canonical Name Normalizer
// Targeted at FD&C colorant alias fragmentation (D-142 follow-up).
// Normalizes variant canonical names to their base form:
//   fd&c_blue_no._1 → blue_1, red_40_lake → red_40, blue_1_b410922 → blue_1, etc.
// Non-colorant names pass through unchanged.

/** Base colorant canonical names — the normalization targets. */
const COLORANT_ROOTS = [
  'red_40',
  'red_3',
  'yellow_5',
  'yellow_6',
  'blue_1',
  'blue_2',
  'titanium_dioxide',
] as const;

/**
 * Normalize a canonical_name for FD&C colorants.
 * Returns the base canonical form for colorant aliases,
 * or the input unchanged for non-colorant ingredients.
 */
export function normalizeCanonicalName(rawCanonical: string): string {
  // Step 1: Lowercase (defensive)
  let s = rawCanonical.toLowerCase();

  // Step 2: Strip FD&C prefixes (including typos/OCR artifacts: fd*c, fd_&_c)
  s = s.replace(/^(?:fd&c_|fd_and_c_|fd_&_c_|fd\*c_|fdc_|f\.d\.&c\._|f\.d\.&c\.)/, '');

  // Step 3: Strip # symbols, then ensure underscore between color word and number
  //   fd&c_blue#1 → blue#1 → blue1 → blue_1
  s = s.replace(/#/g, '');
  s = s.replace(/^(red|yellow|blue)(\d)/, '$1_$2');

  // Step 4: Strip "no" variants — _no._, _no_, _number_
  s = s.replace(/_no\._/g, '_');
  s = s.replace(/_no_/g, '_');
  s = s.replace(/_number_/g, '_');

  // Step 5: Strip _lake suffix and interior _lake_
  s = s.replace(/_lake$/, '');
  s = s.replace(/_lake_/, '_');

  // Step 6: Strip trailing batch/registry codes (_b410922, _ci75470, _a386323)
  s = s.replace(/_[a-z]?\d{4,}$/, '');
  // Strip parsing artifacts: trailing content after dot following number (yellow_5._prime_rib)
  s = s.replace(/((?:red|yellow|blue)_\d+)\._.*$/, '$1');

  // Step 7: Collapse double underscores + trim trailing underscores
  s = s.replace(/__+/g, '_');
  s = s.replace(/_$/, '');

  // Step 8: Match against known colorant roots
  // Exact match first
  for (const root of COLORANT_ROOTS) {
    if (s === root) return root;
  }

  // Prefix match — handles cases like titanium_dioxide_color → titanium_dioxide
  for (const root of COLORANT_ROOTS) {
    if (s.startsWith(root + '_') || s.startsWith(root)) {
      // Verify the root is followed by end-of-string or underscore
      // (prevents blue_1 matching blue_10 if that ever exists)
      if (s === root || s[root.length] === '_' || s.length === root.length) {
        return root;
      }
    }
  }

  // No colorant match — return original input unchanged
  return rawCanonical;
}
