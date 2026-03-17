// SeverityBadgeStrip — 4-5 worst-scoring ingredients as tappable color-coded chips (D-108).
// Only shows danger + caution severity ingredients. Sorted worst-first, then by position.
// Ionicons only — zero emoji (D-084).

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ProductIngredient } from '../types/scoring';
import type { IngredientSeverity } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { toDisplayName } from '../utils/formatters';

// ─── Severity Icon Map (WCAG colorblind support) ────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const SEVERITY_ICONS: Record<'danger' | 'caution', IoniconsName> = {
  danger: 'warning-outline',
  caution: 'alert-circle-outline',
};

// ─── Props ──────────────────────────────────────────────

interface SeverityBadgeStripProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
}

// ─── Helpers ────────────────────────────────────────────

const MAX_BADGES = 5;

const SEVERITY_ORDER: Record<string, number> = {
  danger: 0,
  caution: 1,
};

function getSeverity(
  ingredient: ProductIngredient,
  species: 'dog' | 'cat',
): IngredientSeverity {
  return species === 'cat'
    ? ingredient.cat_base_severity
    : ingredient.dog_base_severity;
}

function formatName(ingredient: ProductIngredient): string {
  if (ingredient.display_name) return ingredient.display_name;
  return toDisplayName(ingredient.canonical_name);
}

// ─── Component ──────────────────────────────────────────

export function SeverityBadgeStrip({
  ingredients,
  species,
  onIngredientPress,
}: SeverityBadgeStripProps) {
  // Filter to danger/caution only
  const concerning = ingredients.filter((i) => {
    const sev = getSeverity(i, species);
    return sev === 'danger' || sev === 'caution';
  });

  if (concerning.length === 0) return null;

  // Sort: danger first, then caution, then by position
  const sorted = [...concerning].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)] ?? 2;
    const sevB = SEVERITY_ORDER[getSeverity(b, species)] ?? 2;
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  const visible = sorted.slice(0, MAX_BADGES);

  const [showFades, setShowFades] = useState({ left: false, right: true });

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number }; contentSize: { width: number }; layoutMeasurement: { width: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setShowFades({
      left: contentOffset.x > 4,
      right: contentOffset.x < contentSize.width - layoutMeasurement.width - 4,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.scrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {visible.map((ingredient) => {
            const severity = getSeverity(ingredient, species) as 'danger' | 'caution';
            const color = severity === 'danger' ? Colors.severityRed : Colors.severityAmber;
            return (
              <TouchableOpacity
                key={`${ingredient.canonical_name}-${ingredient.position}`}
                style={[
                  styles.chip,
                  severity === 'danger' ? styles.chipDanger : styles.chipCaution,
                ]}
                onPress={() => onIngredientPress(ingredient)}
                activeOpacity={0.7}
              >
                <Ionicons name={SEVERITY_ICONS[severity]} size={14} color={color} />
                <Text
                  style={[styles.chipText, { color }]}
                  numberOfLines={1}
                >
                  {formatName(ingredient)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Fade overlays to indicate scrollable content */}
        {showFades.left && (
          <LinearGradient
            colors={[Colors.background, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fadeLeft}
            pointerEvents="none"
          />
        )}
        {showFades.right && (
          <LinearGradient
            colors={['transparent', Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fadeRight}
            pointerEvents="none"
          />
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
  scrollWrapper: {
    position: 'relative',
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    minHeight: 36,
  },
  chipDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  chipCaution: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
