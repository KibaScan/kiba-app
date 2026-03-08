// Kiba — "What Good Looks Like" static reference content
// 4 variants: (daily_food | treat) × (dog | cat)
// D-095: Factual criteria only — "typically have" not "should have"
// D-084: Ionicons references, no emoji

export interface QualityCriterion {
  label: string;
  description: string;
  icon: string; // Ionicon name
}

export interface QualityReference {
  category: 'daily_food' | 'treat';
  species: 'dog' | 'cat';
  title: string;
  criteria: QualityCriterion[];
}

const references: QualityReference[] = [
  {
    category: 'daily_food',
    species: 'dog',
    title: 'What top-scoring dog foods typically have',
    criteria: [
      {
        label: 'Named animal protein first',
        description: 'A named animal protein (e.g. chicken, salmon) as the first ingredient',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'No artificial additives',
        description: 'No artificial colors, flavors, or preservatives (BHA, BHT, ethoxyquin)',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'AAFCO nutritional adequacy',
        description: 'An AAFCO statement confirming complete and balanced nutrition',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Named fat sources',
        description: 'Named fat sources (e.g. chicken fat) rather than unnamed "animal fat"',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Omega-3 supplementation',
        description: 'Added DHA or EPA for skin, coat, and cognitive support',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Moderate fiber',
        description: 'Fiber content in the 2-5% range for healthy digestion',
        icon: 'checkmark-circle-outline',
      },
    ],
  },
  {
    category: 'daily_food',
    species: 'cat',
    title: 'What top-scoring cat foods typically have',
    criteria: [
      {
        label: 'Named animal protein first',
        description: 'A named animal protein (e.g. chicken, salmon) as the first ingredient',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Taurine supplementation',
        description: 'Added taurine, an essential amino acid for cats',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'No artificial colors',
        description: 'Free of artificial colors and dyes',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'AAFCO nutritional adequacy',
        description: 'An AAFCO statement confirming complete and balanced nutrition',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Named fat sources',
        description: 'Named fat sources rather than unnamed "animal fat"',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Moderate carbohydrate content',
        description: 'Lower carbohydrate levels, consistent with cats being obligate carnivores',
        icon: 'checkmark-circle-outline',
      },
    ],
  },
  {
    category: 'treat',
    species: 'dog',
    title: 'What top-scoring dog treats typically have',
    criteria: [
      {
        label: 'Named protein source first',
        description: 'A named protein source as the first ingredient',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'No artificial colors or flavors',
        description: 'Free of artificial colors and flavors',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Minimal fillers',
        description: 'No corn, wheat, or soy as first ingredients',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Limited ingredients',
        description: 'Single-ingredient or limited-ingredient formulas tend to score highest',
        icon: 'checkmark-circle-outline',
      },
    ],
  },
  {
    category: 'treat',
    species: 'cat',
    title: 'What top-scoring cat treats typically have',
    criteria: [
      {
        label: 'Named animal protein first',
        description: 'A named animal protein as the first ingredient',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'No artificial colors',
        description: 'Free of artificial colors and dyes',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'No propylene glycol',
        description: 'Free of propylene glycol, which is associated with toxicity in cats',
        icon: 'checkmark-circle-outline',
      },
      {
        label: 'Limited plant-based fillers',
        description: 'Minimal plant-based fillers, prioritizing animal-sourced ingredients',
        icon: 'checkmark-circle-outline',
      },
    ],
  },
];

export function getQualityReference(
  category: 'daily_food' | 'treat',
  species: 'dog' | 'cat',
): QualityReference | null {
  return references.find(
    (r) => r.category === category && r.species === species,
  ) ?? null;
}
