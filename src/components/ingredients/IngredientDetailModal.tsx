// IngredientDetailModal — Singleton modal for ingredient details (D-030, D-105).
// One modal instance on ResultScreen, content swapped via state.
// Layout: display_name → severity badge → tldr → position_context →
//         collapsible detail_body → citations footer.
// Ionicons only — zero emoji (D-084). D-095 compliant copy.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductIngredient, IngredientSeverity } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS, SEVERITY_DISPLAY_LABELS } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface IngredientDetailModalProps {
  ingredient: ProductIngredient | null; // null = modal hidden
  species: 'dog' | 'cat';
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────

// SEVERITY_COLORS + SEVERITY_DISPLAY_LABELS imported from constants.ts — single source of truth

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

function getPositionContext(ingredient: ProductIngredient): string | null {
  if (ingredient.position_reduction_eligible) {
    if (ingredient.position <= 5) {
      return 'This ingredient appears in the first five positions, indicating it is a primary component by weight.';
    }
    if (ingredient.position <= 10) {
      return 'This ingredient appears in positions 6-10. Its concern level is reduced based on its lower proportion in the formula.';
    }
    return 'This ingredient appears in a lower position, indicating a smaller proportion. Its concern level is reduced accordingly.';
  }
  return 'This ingredient is flagged regardless of its position on the label. Even small quantities raise the same concern.';
}

// ─── Component ──────────────────────────────────────────

export function IngredientDetailModal({
  ingredient,
  species,
  onClose,
}: IngredientDetailModalProps) {
  const [detailExpanded, setDetailExpanded] = useState(false);

  // Reset expanded state when ingredient changes
  useEffect(() => {
    setDetailExpanded(false);
  }, [ingredient?.canonical_name]);

  if (!ingredient) return null;

  const severity = getSeverity(ingredient, species);
  const color = SEVERITY_COLORS[severity];
  const label = SEVERITY_DISPLAY_LABELS[severity];
  const positionContext = getPositionContext(ingredient);

  return (
    <Modal
      visible={ingredient !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {formatName(ingredient)}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Ionicons
                name="close-outline"
                size={24}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Severity badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.severityDot, { backgroundColor: color }]} />
            <Text style={[styles.severityLabel, { color }]}>{label}</Text>
            <Text style={styles.positionText}>Position #{ingredient.position}</Text>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* TL;DR */}
            <Text style={styles.tldr}>
              {ingredient.tldr ??
                'Detailed information for this ingredient is being prepared.'}
            </Text>

            {/* Position context */}
            {positionContext && (
              <View style={styles.contextBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={Colors.textSecondary}
                />
                <Text style={styles.contextText}>{positionContext}</Text>
              </View>
            )}

            {/* Detail body — collapsible */}
            {ingredient.detail_body && (
              <View style={styles.detailSection}>
                <TouchableOpacity
                  style={styles.detailToggle}
                  onPress={() => setDetailExpanded(!detailExpanded)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={detailExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={16}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.detailToggleText}>Read more</Text>
                </TouchableOpacity>
                {detailExpanded && (
                  <Text style={styles.detailBody}>
                    {ingredient.detail_body}
                  </Text>
                )}
              </View>
            )}

            {/* Citations */}
            {ingredient.citations_display && (
              <View style={styles.citationsSection}>
                <Text style={styles.citationsHeader}>Sources</Text>
                <Text style={styles.citationsText}>
                  {ingredient.citations_display}
                </Text>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  positionText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginLeft: 'auto',
  },
  scrollArea: {
    flexGrow: 0,
  },
  tldr: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  contextBox: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  contextText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  detailSection: {
    marginBottom: Spacing.md,
  },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  detailToggleText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  detailBody: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
  citationsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
    paddingTop: 12,
  },
  citationsHeader: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  citationsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 40,
  },
});
