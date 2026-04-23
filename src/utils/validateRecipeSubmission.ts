import toxicFoods from '../data/toxic_foods.json';

export interface RecipeSubmission {
  title: string;
  subtitle?: string;
  species: 'dog' | 'cat' | 'both';
  prep_steps: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

const UPVM_REGEX =
  /\b(cure|prevent|diagnose|((helps with|good for|treats)\s+(?:\S+\s+)*?(disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i;

interface ToxicEntry {
  id: string;
  name: string;
  alt_names: string[];
  species_severity: { dog: 'toxic' | 'caution' | 'safe'; cat: 'toxic' | 'caution' | 'safe' };
}

function findToxicMatch(
  ingredientName: string,
  species: 'dog' | 'cat' | 'both',
): ToxicEntry | null {
  const normalized = ingredientName.toLowerCase().trim();
  const checkSpecies: ('dog' | 'cat')[] = species === 'both' ? ['dog', 'cat'] : [species];
  const entries = (toxicFoods as { toxics: ToxicEntry[] }).toxics ?? [];
  for (const entry of entries) {
    const candidates = [entry.name.toLowerCase(), ...entry.alt_names.map((n) => n.toLowerCase())];
    if (!candidates.some((c) => normalized.includes(c))) continue;
    if (checkSpecies.some((s) => entry.species_severity[s] === 'toxic')) return entry;
  }
  return null;
}

export function validateRecipe(r: RecipeSubmission): ValidationResult {
  if (!r.title || r.title.trim().length < 4) {
    return { valid: false, reason: 'Title must be at least 4 characters.' };
  }
  if (r.ingredients.length === 0) {
    return { valid: false, reason: 'Recipe must include at least one ingredient.' };
  }
  if (r.prep_steps.length === 0) {
    return { valid: false, reason: 'Recipe must include at least one preparation step.' };
  }
  for (const ing of r.ingredients) {
    const match = findToxicMatch(ing.name, r.species);
    if (match) {
      const lethalSpecies =
        r.species === 'both'
          ? match.species_severity.dog === 'toxic'
            ? 'dog'
            : 'cat'
          : r.species;
      return {
        valid: false,
        reason: `This recipe contains ${match.name}, which is toxic to ${lethalSpecies}. Please remove it and resubmit.`,
      };
    }
  }
  const haystack = [r.title, r.subtitle ?? '', ...r.prep_steps].join(' \n ');
  if (UPVM_REGEX.test(haystack)) {
    return {
      valid: false,
      reason:
        'Community recipes can\'t include health or medical claims. Remove language about treating, curing, or preventing conditions and resubmit.',
    };
  }
  return { valid: true };
}
