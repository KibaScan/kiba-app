// ScoreWaterfall — Visual breakdown of score calculation, layer by layer (D-094).
// Shows how the final suitability score was derived from 100 down.
// D-094: pet-named layer labels. D-084: zero emoji. D-095: no editorial copy.
// Interactive accordion: expand/collapse each layer for detailed breakdown.

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
import type { ScoredResult, Penalty, AppliedRule, PersonalizationDetail } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────

interface ScoreWaterfallProps {
  scoredResult: ScoredResult;
  petName: string;
  species: 'dog' | 'cat';
  category: 'daily_food' | 'treat';
}

// ─── Weights (must match scoring engine) ────────────────

const WEIGHTS = {
  daily_food: { iq: 0.55, np: 0.30, fc: 0.15 },
  daily_food_partial: { iq: 0.78, np: 0, fc: 0.22 }, // D-017: missing GA reweight
  treat: { iq: 1.0, np: 0, fc: 0 },
} as const;

// ─── Row Model ──────────────────────────────────────────

interface WaterfallRow {
  key: string;
  label: string;
  points: number;
}

function buildRows(
  scoredResult: ScoredResult,
  petName: string,
  species: 'dog' | 'cat',
  category: 'daily_food' | 'treat',
): WaterfallRow[] {
  const isPartial = scoredResult.isPartialScore && category === 'daily_food';
  const weightKey = category === 'treat'
    ? 'treat'
    : isPartial
      ? 'daily_food_partial'
      : 'daily_food';
  const w = WEIGHTS[weightKey];
  const { layer1, layer2, layer3 } = scoredResult;
  const rows: WaterfallRow[] = [];

  // Layer 1a — Ingredient Quality
  const iqDeduction = -Math.round((100 - layer1.ingredientQuality) * w.iq);
  rows.push({ key: 'iq', label: 'Ingredient Concerns', points: iqDeduction });

  // Layer 1b — Nutritional Profile (daily food only, hidden when partial)
  if (category === 'daily_food' && !isPartial) {
    const npDeduction = -Math.round((100 - layer1.nutritionalProfile) * w.np);
    rows.push({ key: 'np', label: `${petName}'s Nutritional Fit`, points: npDeduction });
  }

  // Layer 1c — Formulation (daily food only)
  if (category === 'daily_food') {
    const fcDeduction = -Math.round((100 - layer1.formulation) * w.fc);
    rows.push({ key: 'fc', label: 'Formulation Quality', points: fcDeduction });
  }

  // Layer 2 — Species Rules (D-094: "[Species] Safety Checks")
  const speciesLabel = species === 'dog' ? 'Canine Safety Checks' : 'Feline Safety Checks';
  rows.push({
    key: 'species',
    label: speciesLabel,
    points: layer2.speciesAdjustment,
  });

  // Layer 3 — Personalization
  const l3Total = layer3.personalizations.reduce(
    (sum, p) => sum + p.adjustment,
    0,
  );
  rows.push({ key: 'personalization', label: `${petName}'s Breed & Age Adjustments`, points: l3Total });

  // D-129: Allergen sensitivity row (only when allergen overrides fired)
  if (scoredResult.allergenDelta > 0) {
    rows.push({
      key: 'allergen',
      label: `${petName}'s Allergen Sensitivity`,
      points: -Math.round(scoredResult.allergenDelta),
    });
  }

  return rows;
}

// ─── Helpers ────────────────────────────────────────────

function formatPoints(points: number): string {
  if (points === 0) return '0 pts';
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function getPointsColor(points: number): string {
  if (points < 0) return Colors.severityRed;
  if (points > 0) return Colors.severityGreen;
  return Colors.textTertiary;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatIngredientName(canonicalName: string): string {
  return canonicalName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Expanded Content Renderers ─────────────────────────

function renderIqExpanded(penalties: Penalty[]): React.ReactNode {
  if (penalties.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>No ingredient concerns identified</Text>
    );
  }

  return penalties.map((penalty, i) => (
    <View
      key={`${penalty.ingredientName}-${penalty.position}-${i}`}
      style={styles.expandedItem}
    >
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {formatIngredientName(penalty.ingredientName)}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {`\u2212${Math.round(penalty.positionAdjustedPenalty)} pts`}
        </Text>
      </View>
      <Text style={styles.expandedItemReason} numberOfLines={2}>
        {penalty.reason}
      </Text>
      <TouchableOpacity activeOpacity={0.7}>
        <Text style={styles.expandedCitation}>{penalty.citationSource}</Text>
      </TouchableOpacity>
    </View>
  ));
}

function renderNpExpanded(scoredResult: ScoredResult): React.ReactNode {
  const npScore = scoredResult.layer1.nutritionalProfile;
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Nutritional adequacy scored {npScore}/100 based on guaranteed analysis values vs AAFCO thresholds
      </Text>
    </View>
  );
}

function renderFcExpanded(scoredResult: ScoredResult): React.ReactNode {
  const fcScore = scoredResult.layer1.formulation;
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Formulation completeness scored {fcScore}/100 based on AAFCO compliance, preservative quality, and protein source naming
      </Text>
    </View>
  );
}

function renderSpeciesExpanded(appliedRules: AppliedRule[]): React.ReactNode {
  const firedRules = appliedRules.filter((r) => r.fired);

  if (firedRules.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No species-specific adjustments applied
      </Text>
    );
  }

  return firedRules.map((rule) => (
    <View key={rule.ruleId} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {rule.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {rule.adjustment > 0 ? '+' : ''}{rule.adjustment} pts
        </Text>
      </View>
      {rule.citation && (
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.expandedCitation}>{rule.citation}</Text>
        </TouchableOpacity>
      )}
    </View>
  ));
}

function renderPersonalizationExpanded(
  personalizations: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  // Filter out breed_contraindications (shown separately as cards)
  const adjustments = personalizations.filter(
    (p) => p.type !== 'breed_contraindication',
  );

  if (adjustments.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No breed or age adjustments for {petName}'s profile
      </Text>
    );
  }

  return adjustments.map((p, i) => (
    <View key={`${p.type}-${p.label}-${i}`} style={styles.expandedItem}>
      <View style={styles.expandedItemRow}>
        <Text style={styles.expandedItemName} numberOfLines={1}>
          {p.label}
        </Text>
        <Text style={styles.expandedItemPoints}>
          {p.adjustment > 0 ? '+' : ''}{p.adjustment} pts
        </Text>
      </View>
    </View>
  ));
}

function renderAllergenExpanded(
  allergenWarnings: PersonalizationDetail[],
  petName: string,
): React.ReactNode {
  if (allergenWarnings.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>
        No allergen matches for {petName}
      </Text>
    );
  }

  return allergenWarnings.map((w, i) => (
    <View key={`allergen-${i}`} style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>{w.label}</Text>
    </View>
  ));
}

// ─── Component ──────────────────────────────────────────

export function ScoreWaterfall({
  scoredResult,
  petName,
  species,
  category,
}: ScoreWaterfallProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const rows = buildRows(scoredResult, petName, species, category);
  const maxMagnitude = Math.max(
    ...rows.map((r) => Math.abs(r.points)),
    1, // avoid division by zero
  );

  const toggleRow = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderExpandedContent = (key: string): React.ReactNode => {
    switch (key) {
      case 'iq':
        return renderIqExpanded(scoredResult.ingredientPenalties);
      case 'np':
        return renderNpExpanded(scoredResult);
      case 'fc':
        return renderFcExpanded(scoredResult);
      case 'species':
        return renderSpeciesExpanded(scoredResult.layer2.appliedRules);
      case 'personalization':
        return renderPersonalizationExpanded(
          scoredResult.layer3.personalizations,
          petName,
        );
      case 'allergen':
        return renderAllergenExpanded(scoredResult.layer3.allergenWarnings, petName);
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Score Breakdown</Text>

      {/* Baseline */}
      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Starts at 100</Text>
        <View style={styles.baselineDot} />
      </View>

      {/* Layer rows */}
      {rows.map((row) => {
        const isExpanded = expandedKey === row.key;
        const barWidthPercent = Math.max(
          (Math.abs(row.points) / maxMagnitude) * 100,
          3, // ~8-9px minimum on typical screen
        );
        const barColor = getPointsColor(row.points);
        const barFillColor = hexToRgba(barColor, 0.6);

        return (
          <View key={row.key} style={styles.row}>
            <TouchableOpacity
              style={styles.rowHeader}
              onPress={() => toggleRow(row.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <View style={styles.rowRight}>
                <Text style={[styles.rowPoints, { color: barColor }]}>
                  {formatPoints(row.points)}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={Colors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {row.points !== 0 && (
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barWidthPercent}%`,
                      backgroundColor: barFillColor,
                    },
                  ]}
                />
              </View>
            )}

            {isExpanded && (
              <View style={styles.expandedContainer}>
                {renderExpandedContent(row.key)}
              </View>
            )}
          </View>
        );
      })}

      {/* Final score */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final</Text>
        <Text style={styles.finalScore}>
          {scoredResult.finalScore}% match
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  baselineLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  baselineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowPoints: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 4,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  finalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  finalScore: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.accent,
  },

  // ─── Expanded Content ─────────────────────────────────
  expandedContainer: {
    backgroundColor: Colors.card,
    marginTop: 8,
    paddingLeft: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.cardBorder,
  },
  expandedItem: {
    marginBottom: 10,
  },
  expandedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedItemName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  expandedItemPoints: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  expandedItemReason: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  expandedCitation: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  expandedSummary: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  expandedEmpty: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
