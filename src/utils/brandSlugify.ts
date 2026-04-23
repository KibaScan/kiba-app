export function brandSlugify(brand: string): string {
  // Strip "elision" punctuation (apostrophes, periods in initials) FIRST so
  // they collapse cleanly. Then convert remaining non-alphanum to hyphens.
  // Test case: "Hill's Science Diet" → "hills-science-diet" (NOT "hill-s-...").
  return brand
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
