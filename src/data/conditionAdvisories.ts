// Kiba — Health Condition UI Advisory Text
// Static D-095 compliant copy from M6_HEALTH_CONDITION_SCORING_SPEC.md.
// One advisory per condition per species. Consumed by ResultScreen (Part 3).

type Species = 'dog' | 'cat';

interface AdvisoryEntry {
  dog: string | null;
  cat: string | null;
}

const CONDITION_ADVISORIES: Record<string, AdvisoryEntry> = {
  joint: {
    dog: 'Keeping {petName} lean is the single most effective way to manage joint health. This product provides {kcalNote}.',
    cat: 'Keeping {petName} lean is the single most effective way to manage joint health. This product provides {kcalNote}.',
  },
  gi_sensitive: {
    dog: '{petName} has a sensitive stomach. Feeding 3-4 smaller meals per day can reduce digestive workload.',
    cat: '{petName} has a sensitive stomach. Feeding 3-4 smaller meals per day can reduce digestive workload.',
  },
  obesity: {
    dog: 'For weight management, calculate portions based on {petName}\'s ideal target weight, not current weight. Treats should be <10% of daily calories.',
    cat: 'For weight management, calculate portions based on {petName}\'s ideal target weight, not current weight. Treats should be <10% of daily calories.',
  },
  underweight: {
    dog: '{petName} is underweight. Feed multiple small meals throughout the day. Warming wet food slightly can increase aroma and encourage eating.',
    cat: '{petName} is underweight. Feed multiple small meals throughout the day. Warming wet food slightly can increase aroma and encourage eating.',
  },
  diabetes: {
    dog: 'Diabetic dogs need strict feeding consistency. Feed the exact same amount at the exact same times daily, timed with insulin injections.',
    cat: 'Diabetic cats can potentially achieve remission through strict low-carbohydrate diets. Discuss wet food options with your veterinarian.',
  },
  pancreatitis: {
    dog: '{petName} has pancreatitis. High-fat foods can trigger life-threatening flare-ups in dogs. Strictly avoid high-fat treats (marrow bones, pig ears, peanut butter, cheese).',
    cat: '{petName} has pancreatitis. Unlike in dogs, feline pancreatitis is typically not triggered by dietary fat. Highly digestible and novel protein diets are often recommended. If {petName} stops eating for more than 24 hours, contact your vet immediately — cats are at risk of hepatic lipidosis.',
  },
  ckd: {
    dog: '{petName} has kidney disease. Hydration is critical — wet food and added water are strongly beneficial. Discuss a veterinary renal diet with your vet.',
    cat: '{petName} has kidney disease. Hydration is critical — wet food and added water are strongly beneficial. Discuss a veterinary renal diet with your vet.',
  },
  cardiac: {
    dog: '{petName} has heart disease. Avoid high-sodium foods and treats (jerky, cheese, lunch meats). The FDA has investigated grain-free diets high in legumes in connection with canine DCM.',
    cat: '{petName} has heart disease. Taurine is critical — deficiency accelerates cardiac failure in cats. Wet food is preferred to maintain hydration.',
  },
  urinary: {
    dog: 'Urinary health benefits from increased moisture intake. Adding water to kibble or feeding wet food can help dilute urine.',
    cat: 'Male cats with urinary issues are at risk of life-threatening blockages. A wet-food-heavy diet dilutes urine and reduces crystal formation. Stress reduction also helps — consider environmental enrichment.',
  },
  skin: {
    dog: '{petName} has skin & coat issues. Diets with limited protein sources and high omega-3 content may help. If symptoms persist, discuss an elimination diet with your veterinarian.',
    cat: '{petName} has skin & coat issues. Diets with limited protein sources and high omega-3 content may help. If symptoms persist, discuss an elimination diet with your veterinarian.',
  },
  hypothyroid: {
    dog: '{petName} has hypothyroidism. Dogs with this condition have a sluggish metabolism and gain weight easily. Strict portion control and a lower-fat diet are beneficial while medication is being balanced.',
    cat: null,
  },
  hyperthyroid: {
    dog: null,
    cat: '{petName} has hyperthyroidism. This is common in senior cats. If managing with an iodine-restricted diet, {petName} must eat ONLY that food — any other food breaks the restriction. If managing with medication, a high-calorie, high-protein diet helps combat muscle wasting.',
  },
};

/**
 * Returns the D-095 compliant advisory string for a condition + species,
 * with {petName} replaced. Returns null if no advisory exists.
 */
export function getConditionAdvisory(
  condition: string,
  species: Species,
  petName: string,
): string | null {
  const entry = CONDITION_ADVISORIES[condition];
  if (!entry) return null;

  const template = entry[species];
  if (!template) return null;

  return template.replace(/\{petName\}/g, petName);
}
