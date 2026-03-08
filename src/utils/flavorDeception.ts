// Kiba — Flavor Deception Detection (D-133)
// Detects mismatch between product name protein and actual primary protein.
// Pure function — no scoring impact. D-095: factual language only.

// ─── Types ──────────────────────────────────────────────

export interface FlavorDeceptionResult {
  detected: boolean;
  namedProtein: string | null;
  namedProteinPosition: number | null;
  actualPrimaryProtein: string | null;
  actualPrimaryPosition: number;
  variant: 'buried' | 'absent';
}

interface IngredientInput {
  canonical_name: string;
  position: number;
  is_protein_fat_source?: boolean;
}

// ─── Known Protein Keywords ─────────────────────────────

const PROTEIN_KEYWORDS = [
  'chicken', 'turkey', 'beef', 'salmon', 'tuna', 'lamb', 'duck',
  'venison', 'rabbit', 'pork', 'fish', 'whitefish', 'cod', 'herring',
  'mackerel', 'trout', 'shrimp', 'crab',
];

// ─── Detection ──────────────────────────────────────────

const NOT_DETECTED: FlavorDeceptionResult = {
  detected: false,
  namedProtein: null,
  namedProteinPosition: null,
  actualPrimaryProtein: null,
  actualPrimaryPosition: 0,
  variant: 'absent',
};

export function detectFlavorDeception(
  productName: string,
  ingredients: IngredientInput[],
): FlavorDeceptionResult {
  if (ingredients.length === 0) return NOT_DETECTED;

  // 1. Extract protein keyword from product name
  const nameWords = productName.toLowerCase().split(/[\s\-&,]+/);
  const namedProtein = PROTEIN_KEYWORDS.find((kw) =>
    nameWords.some((w) => w === kw || w === `${kw}s`),
  );

  if (!namedProtein) return NOT_DETECTED;

  // 2. Find that protein in ingredient list
  const sorted = [...ingredients].sort((a, b) => a.position - b.position);
  const namedIngredient = sorted.find((ing) =>
    ing.canonical_name.toLowerCase().includes(namedProtein),
  );
  const namedProteinPosition = namedIngredient?.position ?? null;

  // 3. Find actual primary protein (position 1-2, protein/meat source)
  const primaryProtein = sorted.find(
    (ing) =>
      ing.position <= 2 &&
      (ing.is_protein_fat_source === true ||
        PROTEIN_KEYWORDS.some((kw) =>
          ing.canonical_name.toLowerCase().includes(kw),
        )),
  );

  if (!primaryProtein) return NOT_DETECTED;

  // 4. If named protein IS the primary protein → no deception
  if (
    namedProteinPosition != null &&
    namedProteinPosition <= 2
  ) {
    return NOT_DETECTED;
  }

  // 5. Check if named protein is same species as primary
  if (
    primaryProtein.canonical_name.toLowerCase().includes(namedProtein)
  ) {
    return NOT_DETECTED;
  }

  // 6. Determine variant
  const variant: 'buried' | 'absent' =
    namedProteinPosition != null && namedProteinPosition >= 5
      ? 'buried'
      : namedProteinPosition == null
        ? 'absent'
        : 'buried'; // positions 3-4 also count as buried

  return {
    detected: true,
    namedProtein: capitalize(namedProtein),
    namedProteinPosition,
    actualPrimaryProtein: formatIngredientName(primaryProtein.canonical_name),
    actualPrimaryPosition: primaryProtein.position,
    variant,
  };
}

// ─── Helpers ────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatIngredientName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
