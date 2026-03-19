// Kiba — "What Good Looks Like" Reference Card
// Expandable card showing what top-scoring products typically have.
// D-084: Ionicons only, no emoji. D-095: Factual, not prescriptive.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getQualityReference } from '../../content/explainers/whatGoodLooksLike';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  category: 'daily_food' | 'treat';
  species: 'dog' | 'cat';
}

export function WhatGoodLooksLike({ category, species }: Props) {
  const [expanded, setExpanded] = useState(false);

  const ref = getQualityReference(category, species);
  if (!ref) return null;

  const categoryLabel = category === 'daily_food'
    ? (species === 'dog' ? 'dog food' : 'cat food')
    : (species === 'dog' ? 'dog treat' : 'cat treat');

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Ionicons
          name="sparkles-outline"
          size={18}
          color={Colors.textSecondary}
        />
        <Text style={styles.headerText}>
          What does a great {categoryLabel} look like?
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.criteriaList}>
          {ref.criteria.map((criterion, i) => (
            <View key={i} style={styles.criterionRow}>
              <Ionicons
                name={criterion.icon as any}
                size={18}
                color={Colors.severityGreen}
                style={styles.criterionIcon}
              />
              <View style={styles.criterionContent}>
                <Text style={styles.criterionLabel}>{criterion.label}</Text>
                <Text style={styles.criterionDesc}>{criterion.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 8,
  },
  headerText: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  criteriaList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 12,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  criterionIcon: {
    marginTop: 1,
  },
  criterionContent: {
    flex: 1,
  },
  criterionLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  criterionDesc: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
