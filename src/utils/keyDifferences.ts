// M6 Key Differences Engine — 9 comparison rules for product-vs-product analysis.
// Pure function. No side effects, no Supabase, no React, fully testable.
// D-095 compliant: all text is factual, never editorial.
// D-094: product names use brand + short name, never "Product A/B".

import type { Product } from '../types';
import type { ProductIngredient } from '../types/scoring';
import { evaluateDcmRisk } from '../services/scoring/speciesRules';
import { getConversationalName, toDisplayName } from './formatters';

// ─── Types ──────────────────────────────────────────────

/**
 * Structured comparison sentence. The renderer (CompareScreen) bolds
 * `subject` and `claim`, leaving `verb` and `trailing` at regular weight.
 * `text` is the joined string, kept for tests and any legacy consumers.
 */
export interface KeyDifference {
  id: string;
  icon: 'warning' | 'checkmark' | 'arrow-up' | 'arrow-down';
  severity: 'positive' | 'negative' | 'neutral';
  /** Short product name — rendered bold */
  subject: string;
  /** Verb phrase linking subject to claim — regular weight */
  verb: string;
  /** The insight itself — rendered bold */
  claim: string;
  /** Optional trailing qualifier, e.g. "(DMB)" — regular weight */
  trailing?: string;
  /** Joined sentence — "{subject} {verb} {claim}{?' ' + trailing}" */
  text: string;
  affectedProduct: 'A' | 'B' | 'both';
}

// ─── Helpers ────────────────────────────────────────────

/** Build a KeyDifference from structured parts and compute joined `text`. */
function buildDiff(
  parts: Omit<KeyDifference, 'text'>,
): KeyDifference {
  const pieces = [parts.subject, parts.verb, parts.claim];
  if (parts.trailing) pieces.push(parts.trailing);
  return {
    ...parts,
    text: pieces.filter(Boolean).join(' '),
  };
}

// ─── Constants ──────────────────────────────────────────

const KNOWN_COLORANTS = [
  'red_40', 'yellow_5', 'yellow_6', 'blue_1', 'blue_2', 'red_3',
];

// Ingredients treated as unnamed protein risk for Rule 3
const UNNAMED_PROTEIN_NAMES = [
  'natural_flavor', 'natural_flavors',
];

const MAX_DIFFERENCES = 4;

// ─── Protein DMB Helper ─────────────────────────────────

function getProteinDmb(product: Product): number | null {
  if (product.ga_protein_pct == null) return null;

  // Use DMB if moisture > 12%
  if (product.ga_moisture_pct != null && product.ga_moisture_pct > 12) {
    const dryMatter = 100 - product.ga_moisture_pct;
    if (dryMatter <= 0) return null;
    return (product.ga_protein_pct / dryMatter) * 100;
  }

  // Dry food: as-fed ≈ DMB
  return product.ga_protein_pct;
}

function getSeverityKey(species: 'dog' | 'cat'): 'dog_base_severity' | 'cat_base_severity' {
  return species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';
}

// ─── Rule Implementations ───────────────────────────────

/** Rule 0 (highest priority): Pet allergen matches */
function checkAllergenRisk(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
  petAllergens: string[],
  petName: string,
): KeyDifference | null {
  if (petAllergens.length === 0) return null;

  const allergenSet = new Set(petAllergens);

  function countAllergenHits(ingredients: ProductIngredient[]): { direct: string[]; possible: string[] } {
    const direct: string[] = [];
    const possible: string[] = [];
    for (const ing of ingredients) {
      if (ing.allergen_group && allergenSet.has(ing.allergen_group)) {
        direct.push(ing.allergen_group);
      } else if (ing.allergen_group_possible.length > 0) {
        for (const p of ing.allergen_group_possible) {
          if (allergenSet.has(p)) {
            possible.push(p);
            break;
          }
        }
      }
    }
    return { direct, possible };
  }

  const hitsA = countAllergenHits(ingredientsA);
  const hitsB = countAllergenHits(ingredientsB);
  const totalA = hitsA.direct.length + hitsA.possible.length;
  const totalB = hitsB.direct.length + hitsB.possible.length;

  // Only fire if one product has allergen matches and the other has fewer
  if (totalA === totalB) return null;

  if (totalA > totalB) {
    const allergens = [...new Set([...hitsA.direct, ...hitsA.possible])];
    const allergenNames = allergens.map((a) => toDisplayName(a)).join(', ');
    const plural = allergens.length > 1 ? 's' : '';
    return buildDiff({
      id: 'allergen_a',
      icon: 'warning',
      severity: 'negative',
      subject: getConversationalName(productA),
      verb: 'contains',
      claim: `${petName}'s allergen${plural}: ${allergenNames}`,
      affectedProduct: 'A',
    });
  }

  const allergens = [...new Set([...hitsB.direct, ...hitsB.possible])];
  const allergenNames = allergens.map((a) => toDisplayName(a)).join(', ');
  const plural = allergens.length > 1 ? 's' : '';
  return buildDiff({
    id: 'allergen_b',
    icon: 'warning',
    severity: 'negative',
    subject: getConversationalName(productB),
    verb: 'contains',
    claim: `${petName}'s allergen${plural}: ${allergenNames}`,
    affectedProduct: 'B',
  });
}

function checkArtificialColorants(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
  species: 'dog' | 'cat',
): KeyDifference | null {
  const key = getSeverityKey(species);

  const aColorants = ingredientsA.filter(
    (i) => KNOWN_COLORANTS.includes(i.canonical_name) && i[key] === 'danger',
  );
  const bColorants = ingredientsB.filter(
    (i) => KNOWN_COLORANTS.includes(i.canonical_name) && i[key] === 'danger',
  );

  if (aColorants.length > 0 && bColorants.length === 0) {
    const names = aColorants.map((i) => i.canonical_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    return buildDiff({
      id: 'colorant_a',
      icon: 'warning',
      severity: 'negative',
      subject: getConversationalName(productA),
      verb: 'contains',
      claim: names.join(', '),
      trailing: '(rated Severe)',
      affectedProduct: 'A',
    });
  }

  if (bColorants.length > 0 && aColorants.length === 0) {
    const names = bColorants.map((i) => i.canonical_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    return buildDiff({
      id: 'colorant_b',
      icon: 'warning',
      severity: 'negative',
      subject: getConversationalName(productB),
      verb: 'contains',
      claim: names.join(', '),
      trailing: '(rated Severe)',
      affectedProduct: 'B',
    });
  }

  return null;
}

function checkUnnamedProteins(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
): KeyDifference | null {
  // Count is_unnamed_species OR natural_flavor/natural_flavors in top 5
  const isUnnamedRisk = (i: ProductIngredient) =>
    i.is_unnamed_species || UNNAMED_PROTEIN_NAMES.includes(i.canonical_name);

  const aCount = ingredientsA.filter((i) => i.position <= 5 && isUnnamedRisk(i)).length;
  const bCount = ingredientsB.filter((i) => i.position <= 5 && isUnnamedRisk(i)).length;

  if (aCount === bCount) return null;

  if (aCount > bCount) {
    const plural = aCount > 1 ? 's' : '';
    return buildDiff({
      id: 'unnamed_a',
      icon: 'warning',
      severity: 'negative',
      subject: getConversationalName(productA),
      verb: 'has',
      claim: `${aCount} unnamed protein source${plural}`,
      trailing: 'in the top 5 ingredients',
      affectedProduct: 'A',
    });
  }

  const plural = bCount > 1 ? 's' : '';
  return buildDiff({
    id: 'unnamed_b',
    icon: 'warning',
    severity: 'negative',
    subject: getConversationalName(productB),
    verb: 'has',
    claim: `${bCount} unnamed protein source${plural}`,
    trailing: 'in the top 5 ingredients',
    affectedProduct: 'B',
  });
}

function checkNamedMeatFirst(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
): KeyDifference | null {
  const aFirst = ingredientsA.find((i) => i.position === 1);
  const bFirst = ingredientsB.find((i) => i.position === 1);

  const aHasNamed = aFirst?.allergen_group != null;
  const bHasNamed = bFirst?.allergen_group != null;

  if (aHasNamed === bHasNamed) return null;

  if (aHasNamed) {
    return buildDiff({
      id: 'named_meat_a',
      icon: 'checkmark',
      severity: 'positive',
      subject: getConversationalName(productA),
      verb: 'leads with',
      claim: 'a named protein source',
      affectedProduct: 'A',
    });
  }

  return buildDiff({
    id: 'named_meat_b',
    icon: 'checkmark',
    severity: 'positive',
    subject: getConversationalName(productB),
    verb: 'leads with',
    claim: 'a named protein source',
    affectedProduct: 'B',
  });
}

function checkDcmAdvisory(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
  species: 'dog' | 'cat',
): KeyDifference | null {
  // DCM advisory is dogs only
  if (species !== 'dog') return null;

  const dcmA = evaluateDcmRisk(ingredientsA);
  const dcmB = evaluateDcmRisk(ingredientsB);

  if (dcmA.fires === dcmB.fires) return null;

  if (dcmA.fires) {
    return buildDiff({
      id: 'dcm_a',
      icon: 'warning',
      severity: 'negative',
      subject: getConversationalName(productA),
      verb: 'triggers',
      claim: 'a DCM pulse advisory',
      affectedProduct: 'A',
    });
  }

  return buildDiff({
    id: 'dcm_b',
    icon: 'warning',
    severity: 'negative',
    subject: getConversationalName(productB),
    verb: 'triggers',
    claim: 'a DCM pulse advisory',
    affectedProduct: 'B',
  });
}

function checkAafcoStatus(
  productA: Product,
  productB: Product,
): KeyDifference | null {
  const aHas = productA.aafco_statement === 'yes';
  const bHas = productB.aafco_statement === 'yes';

  if (aHas === bHas) return null;

  if (aHas) {
    return buildDiff({
      id: 'aafco_a',
      icon: 'checkmark',
      severity: 'positive',
      subject: getConversationalName(productA),
      verb: 'has',
      claim: 'verified AAFCO compliance',
      affectedProduct: 'A',
    });
  }

  return buildDiff({
    id: 'aafco_b',
    icon: 'checkmark',
    severity: 'positive',
    subject: getConversationalName(productB),
    verb: 'has',
    claim: 'verified AAFCO compliance',
    affectedProduct: 'B',
  });
}

function checkGaCompleteness(
  productA: Product,
  productB: Product,
): KeyDifference | null {
  const aComplete =
    productA.ga_protein_pct != null &&
    productA.ga_fat_pct != null &&
    productA.ga_fiber_pct != null;
  const bComplete =
    productB.ga_protein_pct != null &&
    productB.ga_fat_pct != null &&
    productB.ga_fiber_pct != null;

  if (aComplete === bComplete) return null;

  if (aComplete) {
    return buildDiff({
      id: 'ga_a',
      icon: 'checkmark',
      severity: 'positive',
      subject: getConversationalName(productA),
      verb: 'has',
      claim: 'complete nutritional data',
      affectedProduct: 'A',
    });
  }

  return buildDiff({
    id: 'ga_b',
    icon: 'checkmark',
    severity: 'positive',
    subject: getConversationalName(productB),
    verb: 'has',
    claim: 'complete nutritional data',
    affectedProduct: 'B',
  });
}

function checkProteinDelta(
  productA: Product,
  productB: Product,
): KeyDifference | null {
  const aDmb = getProteinDmb(productA);
  const bDmb = getProteinDmb(productB);

  if (aDmb == null || bDmb == null) return null;

  const delta = Math.abs(aDmb - bDmb);
  if (delta <= 5) return null;

  const roundedDelta = Math.round(delta * 10) / 10;

  if (aDmb > bDmb) {
    return buildDiff({
      id: 'protein_a',
      icon: 'arrow-up',
      severity: 'neutral',
      subject: getConversationalName(productA),
      verb: 'has',
      claim: `${roundedDelta}% more protein`,
      trailing: '(DMB)',
      affectedProduct: 'A',
    });
  }

  return buildDiff({
    id: 'protein_b',
    icon: 'arrow-up',
    severity: 'neutral',
    subject: getConversationalName(productB),
    verb: 'has',
    claim: `${roundedDelta}% more protein`,
    trailing: '(DMB)',
    affectedProduct: 'B',
  });
}

function checkPreservativeType(
  productA: Product,
  productB: Product,
): KeyDifference | null {
  const aNatural = productA.preservative_type === 'natural';
  const bNatural = productB.preservative_type === 'natural';

  const aSynthetic =
    productA.preservative_type === 'synthetic' ||
    productA.preservative_type === 'mixed';
  const bSynthetic =
    productB.preservative_type === 'synthetic' ||
    productB.preservative_type === 'mixed';

  if (aNatural && bSynthetic) {
    return buildDiff({
      id: 'preservative_a',
      icon: 'checkmark',
      severity: 'positive',
      subject: getConversationalName(productA),
      verb: 'uses',
      claim: 'natural preservatives',
      affectedProduct: 'A',
    });
  }

  if (bNatural && aSynthetic) {
    return buildDiff({
      id: 'preservative_b',
      icon: 'checkmark',
      severity: 'positive',
      subject: getConversationalName(productB),
      verb: 'uses',
      claim: 'natural preservatives',
      affectedProduct: 'B',
    });
  }

  return null;
}

// ─── Sorting ────────────────────────────────────────────

const SEVERITY_ORDER: Record<KeyDifference['severity'], number> = {
  negative: 0,
  positive: 1,
  neutral: 2,
};

// ─── Main Engine ────────────────────────────────────────

/**
 * Compute up to 4 key differences between two products.
 * 9 rules evaluated in priority order, sorted by severity, capped at 4.
 * All text is D-095 compliant (factual, never editorial).
 *
 * @param petAllergens - pet's known allergen groups (e.g. ['chicken', 'beef'])
 * @param petName - pet name for allergen difference text
 */
export function computeKeyDifferences(
  productA: Product,
  productB: Product,
  ingredientsA: ProductIngredient[],
  ingredientsB: ProductIngredient[],
  species: 'dog' | 'cat',
  petAllergens: string[] = [],
  petName: string = '',
): KeyDifference[] {
  const results: KeyDifference[] = [];

  // Evaluate all 9 rules in priority order (allergen first)
  const checks = [
    checkAllergenRisk(productA, productB, ingredientsA, ingredientsB, petAllergens, petName),
    checkArtificialColorants(productA, productB, ingredientsA, ingredientsB, species),
    checkUnnamedProteins(productA, productB, ingredientsA, ingredientsB),
    checkNamedMeatFirst(productA, productB, ingredientsA, ingredientsB),
    checkDcmAdvisory(productA, productB, ingredientsA, ingredientsB, species),
    checkAafcoStatus(productA, productB),
    checkGaCompleteness(productA, productB),
    checkProteinDelta(productA, productB),
    checkPreservativeType(productA, productB),
  ];

  for (const check of checks) {
    if (check != null) {
      results.push(check);
    }
  }

  // Sort by severity (negative first), then by original rule order (stable sort)
  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return results.slice(0, MAX_DIFFERENCES);
}
