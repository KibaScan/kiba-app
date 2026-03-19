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
import type { ScoredResult, Penalty, AppliedRule, PersonalizationDetail, IngredientPenaltyResult, ProductIngredient } from '../../types/scoring';
import { Colors, FontSizes, Spacing, SCORING_WEIGHTS, SEVERITY_COLORS, AAFCO_STATEMENT_STATUS, getScoreColor } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';
import { InfoTooltip } from '../ui/InfoTooltip';

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
  category: 'daily_food' | 'treat' | 'supplemental';
  ingredients?: ProductIngredient[];
}

// Weights imported from constants.ts — single source of truth (D-010, D-136)
const WEIGHTS = SCORING_WEIGHTS;

// ─── Tooltip Copy ────────────────────────────────────────

const TOOLTIP_TEXT: Record<string, string> = {
  iq: 'Point values reflect ingredient quality, adjusted by position. Ingredients listed earlier carry more weight.',
  np: "How well this product's guaranteed analysis matches AAFCO nutritional standards for your pet's life stage.",
  fc: "Evaluates the product's AAFCO compliance statement, preservative type, and protein source naming.",
  species: 'Species-specific safety rules including heart health risk factors, carbohydrate load, and mandatory nutrient checks.',
  personalization: "Adjustments based on your pet's breed-specific nutritional needs and life stage.",
  allergen: "Ingredients that match allergens in your pet's health profile.",
};

const MONOSPACE_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

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
  category: 'daily_food' | 'treat' | 'supplemental',
): WaterfallRow[] {
  const isPartial = scoredResult.isPartialScore && category === 'daily_food';
  const weightKey = category === 'treat'
    ? 'treat'
    : category === 'supplemental'
      ? 'supplemental'
      : isPartial
        ? 'daily_food_partial'
        : 'daily_food';
  const w = WEIGHTS[weightKey];
  const { layer1, layer2, layer3 } = scoredResult;
  const rows: WaterfallRow[] = [];

  // Layer 1a — Ingredient Quality
  const iqDeduction = -Math.round((100 - layer1.ingredientQuality) * w.iq);
  rows.push({ key: 'iq', label: 'Ingredients', points: iqDeduction });

  // Layer 1b — Nutritional Profile (daily food + supplemental, hidden when partial)
  if ((category === 'daily_food' || category === 'supplemental') && !isPartial) {
    const npDeduction = -Math.round((100 - layer1.nutritionalProfile) * w.np);
    rows.push({ key: 'np', label: 'Nutritional Fit', points: npDeduction });
  }

  // Layer 1c — Formulation (daily food only — 0% for supplemental/treat)
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
  rows.push({ key: 'personalization', label: 'Breed & Age', points: l3Total });

  // D-129: Allergen sensitivity row (only when allergen overrides fired)
  if (scoredResult.allergenDelta > 0) {
    rows.push({
      key: 'allergen',
      label: 'Allergen Sensitivity',
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

function getPointsColor(points: number, severity?: 'danger' | 'caution' | 'good' | 'neutral'): string {
  if (points > 0) return Colors.severityGreen;
  if (points === 0) return Colors.textTertiary;
  // Negative: color matches ingredient severity when available
  if (severity === 'caution') return Colors.severityAmber;
  return Colors.severityRed; // danger or unspecified default
}

// formatIngredientName replaced by toDisplayName from utils/formatters

// ─── Proportional Rounding (Largest Remainder Method) ────
// Distributes an integer `total` among items proportionally to `values`,
// guaranteeing the sum of returned integers exactly equals `total`.

function distributeRounded(values: number[], total: number): number[] {
  if (total === 0 || values.length === 0) return values.map(() => 0);
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return values.map(() => 0);

  const scaled = values.map(v => (v / sum) * total);
  const floored = scaled.map(Math.floor);
  let remaining = total - floored.reduce((s, v) => s + v, 0);

  const indices = scaled
    .map((v, i) => ({ i, rem: v - floored[i] }))
    .sort((a, b) => b.rem - a.rem);

  for (const { i } of indices) {
    if (remaining <= 0) break;
    floored[i]++;
    remaining--;
  }

  return floored;
}

// ─── Ingredient-Specific Description (P1-6, D-095 compliant) ──

const ARTIFICIAL_COLORANTS = new Set([
  'red_40', 'yellow_5', 'yellow_6', 'blue_2', 'titanium_dioxide', 'red_3', 'blue_1',
]);
const SYNTHETIC_PRESERVATIVES = new Set([
  'bha', 'bht', 'tbhq', 'ethoxyquin',
]);

function getEnrichedReason(
  penalty: Penalty,
  ingredient?: ProductIngredient,
): string {
  // Already specific (unnamed species penalty from scoring engine)
  if (penalty.reason.includes('Unnamed species')) return penalty.reason;

  const name = toDisplayName(penalty.ingredientName);

  // Priority 1: tldr from ingredients_dict (D-105 content)
  if (ingredient?.tldr) return ingredient.tldr;

  // Priority 2: Property-based descriptions
  if (ingredient?.is_unnamed_species) {
    return `${name} — unnamed species source, variable supply chain`;
  }

  if (ARTIFICIAL_COLORANTS.has(penalty.ingredientName)) {
    return `${name} — artificial colorant, no nutritional function`;
  }

  if (SYNTHETIC_PRESERVATIVES.has(penalty.ingredientName)) {
    return `${name} — synthetic preservative linked to health concerns in animal studies`;
  }

  if (penalty.ingredientName.includes('by_product')) {
    return `${name} — byproduct, variable quality depending on source`;
  }

  if (penalty.ingredientName === 'propylene_glycol') {
    return `${name} — synthetic humectant, restricted in cat food by FDA`;
  }

  if (penalty.ingredientName === 'salt' && penalty.position <= 10) {
    return 'Added sodium — position suggests use as flavor enhancer';
  }

  if (penalty.ingredientName === 'sugar' || penalty.ingredientName === 'cane_molasses') {
    return `${name} — added sugar, no nutritional benefit`;
  }

  if (penalty.ingredientName === 'corn_syrup') {
    return `${name} — high-glycemic sweetener, no nutritional benefit`;
  }

  // Fallback
  return penalty.reason;
}

// ─── Expanded Content Renderers ─────────────────────────

function renderIqExpanded(
  ingredientResults: IngredientPenaltyResult[],
  headerPoints: number,
  ingredients?: ProductIngredient[],
): React.ReactNode {
  if (ingredientResults.length === 0) {
    return (
      <Text style={styles.expandedEmpty}>No ingredient concerns identified</Text>
    );
  }

  const absHeader = Math.abs(headerPoints);

  // Proportional distribution: scale position-weighted totals to match category-weighted header
  const rawTotals = ingredientResults.map(ir => ir.totalWeightedPoints);
  const displayTotals = distributeRounded(rawTotals, absHeader);

  // Build ingredient lookup for enriched reason text
  const ingredientMap = new Map<string, ProductIngredient>();
  if (ingredients) {
    for (const ing of ingredients) {
      ingredientMap.set(ing.canonical_name, ing);
    }
  }

  // Dev-mode math check
  const sum = displayTotals.reduce((s, v) => s + v, 0);
  const mathError = __DEV__ && sum !== absHeader;

  return (
    <>
      {ingredientResults.map((ir, idx) => {
        const displayTotal = displayTotals[idx];
        const dotColor = SEVERITY_COLORS[ir.severity];
        const ingredient = ingredientMap.get(ir.canonicalName);

        // Distribute ingredient total among sub-reasons
        const rawReasons = ir.reasons.map(r => r.weightedPoints);
        const displayReasons = distributeRounded(rawReasons, displayTotal);

        // Join unique citations for tooltip
        const citations = [...new Set(ir.reasons.map(r => r.citationSource))].join('; ');

        return (
          <View key={ir.canonicalName} style={styles.ingredientGroup}>
            {/* Parent row: dot + name + points + citation tooltip */}
            <View style={styles.ingredientParentRow}>
              <View style={[styles.severityDot, { backgroundColor: dotColor }]} />
              <Text style={styles.ingredientName}>
                {toDisplayName(ir.canonicalName)}
              </Text>
              <Text style={[styles.ingredientPoints, { color: dotColor }]}>
                {`\u2212${displayTotal}`}
              </Text>
              <View style={styles.ingredientTooltipWrap}>
                <InfoTooltip size={10} opacity={0.18} text={citations} />
              </View>
            </View>

            {/* Sub-reason rows with continuous left border */}
            <View style={[styles.subReasonContainer, { borderLeftColor: dotColor }]}>
              {ir.reasons.map((reason, ri) => {
                // Enrich generic engine text via getEnrichedReason, then strip name prefix
                const enriched = getEnrichedReason(
                  { ingredientName: ir.canonicalName, reason: reason.reason, rawPenalty: reason.rawPoints, positionAdjustedPenalty: reason.weightedPoints, position: ir.position, citationSource: reason.citationSource },
                  ingredient,
                );
                const dashIdx = enriched.indexOf(' \u2014 ');
                const displayReason = dashIdx >= 0
                  ? enriched.charAt(dashIdx + 3).toUpperCase() + enriched.slice(dashIdx + 4)
                  : enriched;

                return (
                  <View key={ri} style={styles.subReasonRow}>
                    <Text style={styles.subReasonText} numberOfLines={2}>
                      {displayReason}
                    </Text>
                    <Text style={styles.subReasonPoints}>
                      ({`\u2212${displayReasons[ri]}`})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      {__DEV__ && mathError && (
        <Text style={{ color: '#EF4444', fontSize: 11 }}>
          {'\u26A0'} Display math: items sum to {sum}, header shows {absHeader}
        </Text>
      )}
    </>
  );
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

function renderFcExpanded(_scoredResult: ScoredResult): React.ReactNode {
  return (
    <View style={styles.expandedItem}>
      <Text style={styles.expandedSummary}>
        Based on AAFCO compliance, preservative quality, and protein source naming
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

// ─── Collapsed Summary Logic ─────────────────────────────

function getSummaryContent(
  key: string,
  scoredResult: ScoredResult,
): { text: string; isGood: boolean } {
  switch (key) {
    case 'iq': {
      const count = scoredResult.ingredientPenalties.length;
      if (count === 0) return { text: 'No ingredient concerns', isGood: true };
      return { text: `${count} ingredient${count !== 1 ? 's' : ''} flagged`, isGood: false };
    }
    case 'np': {
      if (scoredResult.layer1.nutritionalProfile >= 100) {
        return { text: 'All nutrients within range', isGood: true };
      }
      return { text: 'Nutritional gaps detected', isGood: false };
    }
    case 'fc': {
      if (scoredResult.flags.includes('aafco_statement_not_available')) {
        return { text: AAFCO_STATEMENT_STATUS.missing.collapsedSummary, isGood: false };
      }
      if (scoredResult.flags.includes('aafco_statement_unrecognized')) {
        return { text: AAFCO_STATEMENT_STATUS.unrecognized.collapsedSummary, isGood: false };
      }
      return { text: 'Complete AAFCO statement verified', isGood: true };
    }
    case 'species': {
      const fired = scoredResult.layer2.appliedRules.filter((r) => r.fired);
      if (fired.length === 0) return { text: 'No species-specific concerns', isGood: true };
      return { text: fired[0].label, isGood: false };
    }
    case 'personalization': {
      const adjustments = scoredResult.layer3.personalizations.filter(
        (p) => p.type !== 'breed_contraindication',
      );
      if (adjustments.length === 0) return { text: 'No breed-specific adjustments', isGood: true };
      return { text: adjustments[0].label, isGood: false };
    }
    case 'allergen': {
      const warnings = scoredResult.layer3.allergenWarnings;
      if (warnings.length === 0) return { text: 'No allergen matches', isGood: true };
      return { text: warnings[0].label, isGood: false };
    }
    default:
      return { text: '', isGood: false };
  }
}

// ─── Component ──────────────────────────────────────────

export function ScoreWaterfall({
  scoredResult,
  petName,
  species,
  category,
  ingredients,
}: ScoreWaterfallProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const rows = buildRows(scoredResult, petName, species, category);
  const maxMagnitude = Math.max(
    ...rows.map((r) => Math.abs(r.points)),
    1, // avoid division by zero
  );
  const isSupplemental = category === 'supplemental';
  const scoreColor = getScoreColor(scoredResult.finalScore, isSupplemental);
  const verdictLabel = scoredResult.finalScore >= 85 ? 'Excellent match'
    : scoredResult.finalScore >= 70 ? 'Good match'
    : scoredResult.finalScore >= 65 ? 'Fair match'
    : scoredResult.finalScore >= 51 ? 'Low match'
    : 'Poor match';

  const toggleRow = (key: string) => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderExpandedContent = (key: string, rowPoints: number): React.ReactNode => {
    switch (key) {
      case 'iq':
        return renderIqExpanded(scoredResult.ingredientResults, rowPoints, ingredients);
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
      {/* Baseline */}
      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Starts at 100</Text>
        <View style={styles.baselineDot} />
      </View>

      {/* Layer rows */}
      {rows.map((row) => {
        const isExpanded = expandedKey === row.key;
        const barColor = getPointsColor(row.points);
        const barWidthPercent = row.points === 0
          ? 0
          : Math.min(Math.abs(row.points) / 50, 1) * 100;
        const barFillColor = Math.abs(row.points) >= 10
          ? SEVERITY_COLORS.danger
          : SEVERITY_COLORS.caution;
        const summary = getSummaryContent(row.key, scoredResult);

        return (
          <View key={row.key} style={styles.row}>
            <TouchableOpacity
              style={styles.rowHeader}
              onPress={() => toggleRow(row.key)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>
                  {row.label}
                </Text>
                {TOOLTIP_TEXT[row.key] && (
                  <View style={styles.tooltipWrap}>
                    <InfoTooltip text={TOOLTIP_TEXT[row.key]} />
                  </View>
                )}
              </View>
              <Text style={[styles.rowPoints, { color: barColor }]}>
                {formatPoints(row.points)}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={Colors.textSecondary}
                style={styles.chevron}
              />
            </TouchableOpacity>

            {/* Collapsed summary */}
            {!isExpanded && summary.text !== '' && (
              <View style={styles.summaryRow}>
                {summary.isGood && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={SEVERITY_COLORS.good}
                    style={styles.summaryIcon}
                  />
                )}
                <Text
                  style={[
                    styles.summaryText,
                    summary.isGood && { color: SEVERITY_COLORS.good },
                  ]}
                  numberOfLines={1}
                >
                  {summary.text}
                </Text>
              </View>
            )}

            {/* Progress bar */}
            <View style={styles.barTrack}>
              {barWidthPercent > 0 && (
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${barWidthPercent}%`,
                      backgroundColor: barFillColor,
                    },
                  ]}
                />
              )}
            </View>

            {isExpanded && (
              <View style={styles.expandedContainer}>
                {renderExpandedContent(row.key, row.points)}
              </View>
            )}
          </View>
        );
      })}

      {/* Final score */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final</Text>
        <Text style={[styles.finalScore, { color: scoreColor }]}>
          {scoredResult.finalScore}% · {verdictLabel}
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
    marginBottom: 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tooltipWrap: {
    marginLeft: 8,
  },
  rowPoints: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    flexShrink: 0,
  },
  chevron: {
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryIcon: {
    marginRight: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  barTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  finalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  finalScore: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
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

  // ─── Grouped Ingredient Rows ───────────────────────────
  ingredientGroup: {
    marginBottom: 10,
  },
  ingredientParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  ingredientPoints: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONOSPACE_FONT,
    marginRight: 6,
  },
  ingredientTooltipWrap: {
    flexShrink: 0,
  },
  subReasonContainer: {
    marginLeft: 3,
    paddingLeft: 19,
    borderLeftWidth: 2,
    marginTop: 4,
  },
  subReasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  subReasonText: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    flex: 1,
    marginRight: 8,
  },
  subReasonPoints: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    fontFamily: MONOSPACE_FONT,
  },
});
