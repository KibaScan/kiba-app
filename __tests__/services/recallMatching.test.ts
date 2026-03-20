// Kiba — Recall matching algorithm tests (M5 Recall Siren)
// Tests the core matching logic from supabase/functions/recall-check/index.ts.
// Pure functions duplicated here since Deno Edge Functions can't be imported into Jest.
// Any changes to the matching algorithm in the Edge Function MUST be mirrored here.

// ─── Matching Algorithm (mirror of Edge Function) ──────────────

const STOPWORDS = new Set([
  'recipe', 'formula', 'for', 'with', 'adult', 'puppy', 'kitten',
  'senior', 'dog', 'cat', 'dogs', 'cats', 'food', 'the', 'and',
  'a', 'an', 'in', 'of', 'complete', 'nutrition', 'pet',
]);

const COMPANY_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'corp', 'corporation', 'ltd',
  'company', 'co', 'foods', 'packing', 'animal', 'group',
  'industries', 'enterprises', 'manufacturing', 'mfg',
]);

const GENERIC_SINGLE_WORDS = new Set([
  'natural', 'premium', 'best', 'original', 'classic', 'pure',
  'healthy', 'wholesome', 'select', 'choice', 'good',
]);

const PARENT_BRAND_MAP: Record<string, string[]> = {
  'midwestern pet foods': [
    'sportmix', 'splash', 'nunn better', 'pro pac', 'unrefined',
  ],
  'sunshine mills': ['nurture farms', 'family pet'],
  'diamond pet foods': [
    'diamond', 'diamond naturals', 'taste of the wild', '4health',
  ],
  'ainsworth pet nutrition': ['rachael ray nutrish'],
  'carnivore meat company': ['vital essentials'],
  'american nutrition': ['heart to tail', 'paws happy life'],
  'bravo packing': ['bravo'],
};

const SEGMENT_SEPARATORS = /\s*[—–:\/]\s*/;

type MatchConfidence = 'high' | 'medium' | 'low';

interface ProductMatch {
  productId: string;
  productBrand: string;
  productName: string;
  confidence: MatchConfidence;
}

interface ProductRow {
  id: string;
  brand: string;
  name: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[&]/g, ' ')
    .replace(/[,;()"!?]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9.'+]+$/g, ''))
    .filter((w) => w.length > 0);
}

function containsBrand(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const idx = h.indexOf(n);
  if (idx < 0) return false;

  if (idx > 0) {
    const charBefore = h[idx - 1];
    if (/[a-z0-9]/.test(charBefore)) return false;
  }
  const afterIdx = idx + n.length;
  if (afterIdx < h.length) {
    const charAfter = h[afterIdx];
    if (/[a-z0-9]/.test(charAfter)) return false;
  }

  return true;
}

function matchFdaEntry(
  fdaTitle: string,
  products: ProductRow[],
): ProductMatch[] {
  const matches: ProductMatch[] = [];

  const segments = fdaTitle
    .split(SEGMENT_SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const fdaTitleLower = fdaTitle.toLowerCase();
  const parentMatched = new Set<string>();
  for (const [parentCo, subsidiaries] of Object.entries(PARENT_BRAND_MAP)) {
    if (fdaTitleLower.includes(parentCo)) {
      for (const sub of subsidiaries) {
        parentMatched.add(sub);
      }
    }
  }

  for (const product of products) {
    const brandLower = product.brand.toLowerCase();

    // Step 1: Segment brand check
    const segmentMatch = segments.some(
      (seg) => seg.toLowerCase() === brandLower,
    );
    if (segmentMatch) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'high',
      });
      continue;
    }

    // Step 2: Parent company check
    if (parentMatched.has(brandLower)) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'medium',
      });
      continue;
    }

    // Step 3: Substring brand check
    if (!containsBrand(fdaTitle, product.brand)) {
      continue;
    }

    // Step 4: Generic guard
    if (
      !product.brand.includes(' ') &&
      GENERIC_SINGLE_WORDS.has(brandLower)
    ) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'low',
      });
      continue;
    }

    // Step 5: Word overlap
    const brandTokens = new Set(tokenize(product.brand));

    const fdaWords = tokenize(fdaTitle).filter(
      (w) =>
        !brandTokens.has(w) &&
        !COMPANY_SUFFIXES.has(w) &&
        !STOPWORDS.has(w),
    );

    const dbWords = new Set(
      tokenize(product.name).filter(
        (w) => !brandTokens.has(w) && !STOPWORDS.has(w),
      ),
    );

    if (fdaWords.length === 0) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'high',
      });
      continue;
    }

    const overlapCount = fdaWords.filter((w) => dbWords.has(w)).length;
    const overlapRatio = overlapCount / fdaWords.length;

    matches.push({
      productId: product.id,
      productBrand: product.brand,
      productName: product.name,
      confidence: overlapRatio >= 0.6 ? 'high' : 'medium',
    });
  }

  return matches;
}

// ─── Helper to find match for a specific product ───────────────

function findMatch(
  fdaTitle: string,
  product: { brand: string; name: string },
): MatchConfidence | 'none' {
  const row: ProductRow = { id: 'test-id', ...product };
  const matches = matchFdaEntry(fdaTitle, [row]);
  return matches.length > 0 ? matches[0].confidence : 'none';
}

// ─── Test Fixtures (10 required by spec) ───────────────────────

describe('Recall matching algorithm', () => {
  describe('10 required fixtures', () => {
    test('Fixture 1: exact brand + high word overlap → HIGH', () => {
      expect(
        findMatch(
          'Blue Buffalo Wilderness Rocky Mountain Recipe',
          {
            brand: 'Blue Buffalo',
            name: 'Blue Buffalo Wilderness Rocky Mountain Recipe with Red Meat for Dogs',
          },
        ),
      ).toBe('high');
    });

    test('Fixture 2: same brand, different product line → MEDIUM', () => {
      expect(
        findMatch(
          'Blue Buffalo Wilderness',
          {
            brand: 'Blue Buffalo',
            name: 'Blue Buffalo Life Protection Formula Adult',
          },
        ),
      ).toBe('medium');
    });

    test('Fixture 3: same parent brand, different product → MEDIUM', () => {
      expect(
        findMatch(
          'Purina Pro Plan Veterinary Diets HA',
          {
            brand: 'Purina Pro Plan',
            name: 'Purina Pro Plan Complete Essentials Chicken',
          },
        ),
      ).toBe('medium');
    });

    test('Fixture 4: parent company match (Midwestern → Sportmix) → MEDIUM', () => {
      expect(
        findMatch(
          'Midwestern Pet Foods, Inc.',
          {
            brand: 'Sportmix',
            name: 'Sportmix Original Cat 15lb',
          },
        ),
      ).toBe('medium');
    });

    test('Fixture 5: brand match + high word overlap with abbreviation → HIGH', () => {
      expect(
        findMatch(
          'Natural Balance L.I.D. Sweet Potato & Fish',
          {
            brand: 'Natural Balance',
            name: 'Natural Balance L.I.D. Limited Ingredient Sweet Potato & Fish Formula',
          },
        ),
      ).toBe('high');
    });

    test('Fixture 6: no brand match at all → LOW (none)', () => {
      const result = findMatch(
        'Sunshine Mills Nurture Farms',
        {
          brand: 'Purina ONE',
          name: 'Purina ONE SmartBlend',
        },
      );
      // No brand match — should not match at all
      expect(result === 'none' || result === 'low').toBe(true);
    });

    test('Fixture 7: brand match, low word overlap → MEDIUM', () => {
      expect(
        findMatch(
          'Bravo Packing, Inc. Ground Beef',
          {
            brand: 'Bravo',
            name: 'Bravo Homestyle Complete Beef Dinner',
          },
        ),
      ).toBe('medium');
    });

    test('Fixture 8: brand match + high overlap after stopwords → HIGH', () => {
      expect(
        findMatch(
          "Hill's Science Diet Adult 7+",
          {
            brand: "Hill's Science Diet",
            name: "Hill's Science Diet Adult 7+ Chicken Recipe",
          },
        ),
      ).toBe('high');
    });

    test('Fixture 9: single generic word — no brand match → LOW', () => {
      const result = findMatch(
        'Natural',
        {
          brand: 'Natural Balance',
          name: 'Natural Balance LID Fish',
        },
      );
      // "Natural Balance" (2 words) does NOT appear in "Natural" (1 word)
      expect(result === 'none' || result === 'low').toBe(true);
    });

    test('Fixture 10: sub-brand in segment separator → HIGH', () => {
      expect(
        findMatch(
          'Carnivore Meat Company \u2014 Vital Essentials',
          {
            brand: 'Vital Essentials',
            name: 'Vital Essentials Freeze-Dried Mini Nibs',
          },
        ),
      ).toBe('high');
    });
  });

  describe('tokenize', () => {
    test('preserves dots in abbreviations like L.I.D.', () => {
      expect(tokenize('L.I.D. Sweet Potato')).toEqual([
        'l.i.d.',
        'sweet',
        'potato',
      ]);
    });

    test("preserves apostrophes in brands like Hill's", () => {
      expect(tokenize("Hill's Science Diet")).toEqual([
        "hill's",
        'science',
        'diet',
      ]);
    });

    test('splits on ampersand', () => {
      expect(tokenize('Sweet Potato & Fish')).toEqual([
        'sweet',
        'potato',
        'fish',
      ]);
    });

    test('strips commas and parentheses', () => {
      expect(tokenize('Bravo Packing, Inc.')).toEqual([
        'bravo',
        'packing',
        'inc.',
      ]);
    });
  });

  describe('containsBrand', () => {
    test('matches brand at start of string', () => {
      expect(containsBrand('Blue Buffalo Wilderness', 'Blue Buffalo')).toBe(
        true,
      );
    });

    test('does not match partial word', () => {
      expect(containsBrand('Natural', 'Natural Balance')).toBe(false);
    });

    test('matches case-insensitively', () => {
      expect(
        containsBrand('BLUE BUFFALO WILDERNESS', 'Blue Buffalo'),
      ).toBe(true);
    });

    test('does not match brand embedded in another word', () => {
      expect(containsBrand('SuperBravo Food', 'Bravo')).toBe(false);
    });

    test('matches brand at end of string', () => {
      expect(containsBrand('Recall: Blue Buffalo', 'Blue Buffalo')).toBe(
        true,
      );
    });
  });

  describe('edge cases', () => {
    test('brand-only FDA entry (no product name) → HIGH for all brand matches', () => {
      expect(
        findMatch('Blue Buffalo', {
          brand: 'Blue Buffalo',
          name: 'Blue Buffalo Wilderness Chicken',
        }),
      ).toBe('high');
    });

    test('single generic brand word → LOW', () => {
      expect(
        findMatch('Natural Dog Food Recall', {
          brand: 'Natural',
          name: 'Natural Chicken Dinner',
        }),
      ).toBe('low');
    });

    test('multi-product matching returns all matches', () => {
      const products: ProductRow[] = [
        {
          id: '1',
          brand: 'Blue Buffalo',
          name: 'Blue Buffalo Wilderness Chicken',
        },
        {
          id: '2',
          brand: 'Blue Buffalo',
          name: 'Blue Buffalo Life Protection Lamb',
        },
        {
          id: '3',
          brand: 'Purina',
          name: 'Purina ONE SmartBlend',
        },
      ];

      const matches = matchFdaEntry(
        'Blue Buffalo Wilderness Chicken Recipe',
        products,
      );

      // Should match both Blue Buffalo products, not Purina
      expect(matches).toHaveLength(2);
      expect(matches[0].productId).toBe('1');
      expect(matches[0].confidence).toBe('high');
      expect(matches[1].productId).toBe('2');
      expect(matches[1].confidence).toBe('medium');
    });

    test('parent company match does not produce HIGH', () => {
      // Parent company matches should always be MEDIUM (needs human review)
      expect(
        findMatch('Midwestern Pet Foods Recalls All Products', {
          brand: 'Sportmix',
          name: 'Sportmix Wholesomes Chicken',
        }),
      ).toBe('medium');
    });
  });

  describe('RSS lot number parsing', () => {
    // Mirror of parseLotNumbers from Edge Function
    function parseLotNumbers(description: string): string[] | null {
      const regex = /lot\s*(?:numbers?|#|nos?\.?)\s*[:\s]*([\w\-,\s]+)/i;
      const match = description.match(regex);
      if (!match) return null;
      const lots = match[1]
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 50);
      return lots.length > 0 ? lots : null;
    }

    test('parses "Lot numbers: X, Y, Z"', () => {
      expect(
        parseLotNumbers(
          'Recalled due to salmonella. Lot numbers: A1234, B5678, C9012',
        ),
      ).toEqual(['A1234', 'B5678', 'C9012']);
    });

    test('parses "Lot #: X"', () => {
      expect(
        parseLotNumbers('Product recalled. Lot #: 20250115'),
      ).toEqual(['20250115']);
    });

    test('returns null when no lot numbers found', () => {
      expect(
        parseLotNumbers('Recalled due to elevated levels of aflatoxin'),
      ).toBeNull();
    });
  });
});
