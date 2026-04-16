// Kiba — Top Pick Insights Helper
// Pure function. Generates up to 3 D-094/D-095-compliant bullets per pick
// from static signals only (no score_breakdown, no pipeline re-run).
// D-094 suitability framing, D-095 UPVM compliance, D-016 DMB conversion.

import type { LifeStage, ActivityLevel } from '../types/pet';
import type { BrowseCategory, TopPickEntry, InsightBullet } from '../types/categoryBrowse';

export interface InsightContext {
  lifeStage: LifeStage | null;
  weightGoalLevel: number;    // D-160: -3..+3
  activityLevel: ActivityLevel;
  allergens: string[];        // allergen_group names (lowercase); maps to ingredients_dict.allergen_group
  category: BrowseCategory;
  petName: string;
}

/** Max bullets rendered on Hero; rank rows use [0] only */
const MAX_BULLETS = 3;

// ─── Individual checks ────────────────────────────────────

function matchesPetLifeStage(claimRaw: string, petStage: LifeStage): boolean {
  const c = claimRaw.toLowerCase();
  if (c.includes('all life stage')) return true;
  if (petStage === 'puppy' && c.includes('puppy')) return true;
  if (petStage === 'kitten' && c.includes('kitten')) return true;
  if (petStage === 'adult' && (c.includes('adult') || /\bmaintenance\b/.test(c))) return true;
  if (petStage === 'senior' && c.includes('senior')) return true;
  return false;
}

/** Renders the claim with "AAFCO" prefix, title-cased. */
function formatLifeStageText(claim: string): string {
  const tidy = claim.trim().replace(/\s+/g, ' ');
  const titled = tidy.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `AAFCO ${titled}`;
}

function checkLifeStageMatch(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet | null {
  if (ctx.lifeStage == null) return null;
  const claim = entry.life_stage_claim ?? entry.aafco_statement;
  if (!claim) return null;
  if (!matchesPetLifeStage(claim, ctx.lifeStage)) return null;
  return { kind: 'life_stage', text: formatLifeStageText(claim) };
}

function checkAllergenSafe(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet | null {
  if (ctx.allergens.length === 0) return null;

  const petAllergensLower = ctx.allergens.map((a) => a.toLowerCase());
  const ingredientAllergenGroups = (entry.top_ingredients ?? [])
    .map((ing) => ing.allergen_group?.toLowerCase())
    .filter((g): g is string => g != null);

  // Any pet allergen present in an ingredient's allergen_group → NOT clean
  const hasUnsafeMatch = petAllergensLower.some((petAllergen) =>
    ingredientAllergenGroups.includes(petAllergen),
  );
  if (hasUnsafeMatch) return null;

  if (petAllergensLower.length === 1) {
    return { kind: 'allergen_safe', text: `Free of ${petAllergensLower[0]}` };
  }
  if (petAllergensLower.length === 2) {
    return {
      kind: 'allergen_safe',
      text: `Free of ${petAllergensLower[0]} and ${petAllergensLower[1]}`,
    };
  }
  return {
    kind: 'allergen_safe',
    text: `Free of ${petAllergensLower.length} of ${ctx.petName}'s allergens`,
  };
}

// ─── Main ──────────────────────────────────────────────────

export function generateTopPickInsights(
  entry: TopPickEntry,
  ctx: InsightContext,
): InsightBullet[] {
  const bullets: InsightBullet[] = [];

  const allergen = checkAllergenSafe(entry, ctx);
  if (allergen) bullets.push(allergen);

  const lifeStage = checkLifeStageMatch(entry, ctx);
  if (lifeStage) bullets.push(lifeStage);

  return bullets.slice(0, MAX_BULLETS);
}
