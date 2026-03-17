// ConcernTags — Consumer-facing category badges above the fold (D-107).
// Tags answer "what KIND of problem?" — informational only, no score impact.
// Ionicons only — zero emoji (D-084, D-111).

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductIngredient } from '../types/scoring';
import type { Product } from '../types';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { detectFlavorDeception } from '../utils/flavorDeception';

// ─── Types ──────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ConcernTagDef {
  id: string;
  label: string;
  icon: IoniconsName;
  members: string[];
  tooltip: string;
}

// ─── Props ──────────────────────────────────────────────

interface ConcernTagsProps {
  ingredients: ProductIngredient[];
  product: Product;
  species: 'dog' | 'cat';
  /** D-137: true when evaluateDcmRisk().fires — gates Heart Risk tag */
  dcmFires?: boolean;
}

// ─── Static Tag Map (D-107) ─────────────────────────────
// Ordered by display priority: heart_risk > synthetic_additive >
// artificial_color > unnamed_source > added_sugar

const CONCERN_TAG_DEFS: ConcernTagDef[] = [
  {
    id: 'heart_risk',
    label: 'Heart Risk',
    icon: 'heart-outline',
    members: [
      'peas', 'lentils', 'chickpeas', 'pea_protein', 'pea_starch',
    ],
    tooltip:
      'Contains pulse ingredients in positions associated with high dietary load. The FDA has investigated a potential link between pulse-heavy diets and dilated cardiomyopathy (DCM) in dogs.',
  },
  {
    id: 'synthetic_additive',
    label: 'Synthetic Additive',
    icon: 'flask-outline',
    members: [
      'bha', 'bht', 'tbhq', 'propylene_glycol', 'ethoxyquin',
      'sodium_nitrite', 'potassium_sorbate', 'calcium_propionate',
      'phosphoric_acid',
    ],
    tooltip:
      'Contains synthetic preservatives. Some synthetic preservatives have been associated with health concerns in animal studies.',
  },
  {
    id: 'artificial_color',
    label: 'Artificial Color',
    icon: 'color-palette-outline',
    members: [
      'red_40', 'yellow_5', 'yellow_6', 'blue_2', 'titanium_dioxide',
      'red_3', 'blue_1',
    ],
    tooltip:
      'Contains artificial colorants with no nutritional purpose. Some studies have linked synthetic dyes to behavioral changes in animals.',
  },
  {
    id: 'unnamed_source',
    label: 'Unnamed Source',
    icon: 'help-circle-outline',
    members: [
      'meat_meal', 'animal_fat', 'animal_digest', 'natural_flavor',
      'poultry_by_product_meal', 'meat_by_products', 'poultry_fat',
    ],
    tooltip:
      'Contains protein or fat sources without species identification. This limits allergy management and indicates variable supply chains.',
  },
  {
    id: 'added_sugar',
    label: 'Added Sugar',
    icon: 'cube-outline',
    members: ['sugar', 'cane_molasses'],
    tooltip:
      'Contains added sugars that contribute calories without nutritional benefit. Excess sugar intake is associated with dental issues and weight gain.',
  },
];

const MAX_VISIBLE = 3;

// ─── Component ──────────────────────────────────────────

export function ConcernTags({ ingredients, product, species, dcmFires }: ConcernTagsProps) {
  const [expanded, setExpanded] = useState(false);

  const ingredientNames = new Set(ingredients.map((i) => i.canonical_name));

  const firedTags: ConcernTagDef[] = CONCERN_TAG_DEFS.filter((tag) => {
    if (tag.id === 'heart_risk') {
      // D-137: dogs only, fires when DCM pulse load result fires
      if (species !== 'dog') return false;
      return dcmFires === true;
    }
    // Other tags: any member present in ingredient list
    return tag.members.some((member) => ingredientNames.has(member));
  });

  // D-133: Label Mismatch tag — flavor deception detection
  const deception = detectFlavorDeception(product.name, ingredients);
  if (deception.detected && deception.namedProtein && deception.actualPrimaryProtein) {
    firedTags.push({
      id: 'label_mismatch',
      label: 'Label Mismatch',
      icon: 'swap-horizontal-outline',
      members: [],
      tooltip: `Product name highlights ${deception.namedProtein}, but ${deception.actualPrimaryProtein} is the primary ingredient.`,
    });
  }

  if (firedTags.length === 0) return null;

  const visibleTags = expanded ? firedTags : firedTags.slice(0, MAX_VISIBLE);
  const overflowCount = firedTags.length - MAX_VISIBLE;

  return (
    <View style={styles.container}>
      <View style={styles.tagRow}>
        {visibleTags.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={styles.tag}
            onPress={() => Alert.alert(tag.label, tag.tooltip)}
            activeOpacity={0.7}
          >
            <Ionicons name={tag.icon} size={14} color={Colors.textPrimary} />
            <Text style={styles.tagLabel}>{tag.label}</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}
        {overflowCount > 0 && !expanded && (
          <TouchableOpacity
            style={styles.overflowChip}
            onPress={() => setExpanded(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.overflowText}>+{overflowCount} more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
    minHeight: 36,
  },
  tagLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  overflowChip: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  overflowText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
