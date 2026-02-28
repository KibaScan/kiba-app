// GATable — Guaranteed Analysis nutritional panel with AAFCO context (D-038).
// Carb estimation row with tap-to-expand explainer (D-104).
// DMB disclosure for wet food (D-016). Zero emoji (D-084). D-095 compliant copy.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../types';
import type { ScoredResult, CarbEstimate } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { MOISTURE_THRESHOLD } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface GATableProps {
  product: Product;
  scoredResult: ScoredResult;
  species: 'dog' | 'cat';
}

// ─── AAFCO Minimums (adult maintenance) ─────────────────

const AAFCO_MINS = {
  dog: { protein: 18, fat: 5.5 },
  cat: { protein: 26, fat: 9 },
} as const;

// ─── Helpers ────────────────────────────────────────────

function toDmb(asFed: number, moisture: number): number {
  return (asFed / (100 - moisture)) * 100;
}

function barColor(value: number, min: number): string {
  if (value < min) return Colors.severityRed;
  if (value < min + 2) return Colors.severityAmber;
  return Colors.severityGreen;
}

function carbLabelColor(label: string | null): string {
  if (label === 'Low') return Colors.severityGreen;
  if (label === 'Moderate') return Colors.severityAmber;
  return '#FF9500'; // High — orange
}

function confidenceBadgeColor(confidence: CarbEstimate['confidence']): string {
  if (confidence === 'exact') return Colors.severityGreen;
  if (confidence === 'estimated') return Colors.severityAmber;
  return Colors.textTertiary;
}

function isCarbEstimateValid(
  ce: CarbEstimate | null,
): ce is CarbEstimate & { valueDmb: number } {
  return ce != null && ce.valueDmb != null && !isNaN(ce.valueDmb);
}

interface BonusNutrient {
  label: string;
  value: string;
}

function collectBonusNutrients(product: Product): BonusNutrient[] {
  const nutrients: BonusNutrient[] = [];
  if (product.ga_dha_pct != null) nutrients.push({ label: 'DHA', value: `${product.ga_dha_pct}%` });
  if (product.ga_omega3_pct != null) nutrients.push({ label: 'Omega-3', value: `${product.ga_omega3_pct}%` });
  if (product.ga_omega6_pct != null) nutrients.push({ label: 'Omega-6', value: `${product.ga_omega6_pct}%` });
  if (product.ga_taurine_pct != null) nutrients.push({ label: 'Taurine', value: `${product.ga_taurine_pct}%` });
  if (product.ga_l_carnitine_mg != null) nutrients.push({ label: 'L-Carnitine', value: `${product.ga_l_carnitine_mg} mg/kg` });
  if (product.ga_zinc_mg_kg != null) nutrients.push({ label: 'Zinc', value: `${product.ga_zinc_mg_kg} mg/kg` });
  if (product.ga_probiotics_cfu != null) nutrients.push({ label: 'Probiotics', value: product.ga_probiotics_cfu });
  return nutrients;
}

// ─── Component ──────────────────────────────────────────

export function GATable({ product, scoredResult, species }: GATableProps) {
  const [carbExpanded, setCarbExpanded] = useState(false);

  const { ga_protein_pct, ga_fat_pct, ga_fiber_pct, ga_moisture_pct } = product;
  const hasAnyGa =
    ga_protein_pct != null ||
    ga_fat_pct != null ||
    ga_fiber_pct != null ||
    ga_moisture_pct != null;

  if (!hasAnyGa) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionHeader}>Nutritional Profile</Text>
        <Text style={styles.emptyText}>
          Nutritional data not available for this product
        </Text>
      </View>
    );
  }

  const moisture = ga_moisture_pct ?? 0;
  const isWetFood = moisture > MOISTURE_THRESHOLD;
  const mins = AAFCO_MINS[species];
  const carbEstimate = scoredResult.carbEstimate;
  const bonusNutrients = collectBonusNutrients(product);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Nutritional Profile</Text>

      {/* Core macros */}
      {ga_protein_pct != null && (
        <MacroRow
          label="Crude Protein"
          value={ga_protein_pct}
          moisture={moisture}
          isWetFood={isWetFood}
          aafcoMin={mins.protein}
        />
      )}
      {ga_fat_pct != null && (
        <MacroRow
          label="Crude Fat"
          value={ga_fat_pct}
          moisture={moisture}
          isWetFood={isWetFood}
          aafcoMin={mins.fat}
        />
      )}
      {ga_fiber_pct != null && (
        <MacroRow
          label="Crude Fiber"
          value={ga_fiber_pct}
          moisture={moisture}
          isWetFood={isWetFood}
        />
      )}
      {ga_moisture_pct != null && (
        <View style={styles.macroRow}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroLabel}>Moisture</Text>
            <Text style={styles.macroValue}>{ga_moisture_pct}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(ga_moisture_pct, 100)}%`,
                  backgroundColor: Colors.accent,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Carb estimation (D-104) */}
      {isCarbEstimateValid(carbEstimate) ? (
        <View style={styles.carbSection}>
          <TouchableOpacity
            style={styles.carbRow}
            onPress={() => setCarbExpanded(!carbExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.carbHeader}>
              <Text style={styles.macroLabel}>Carbohydrate (est.)</Text>
              <View style={styles.carbValueRow}>
                <Text style={styles.macroValue}>
                  ~{Math.round(carbEstimate.valueDmb)}%
                </Text>
                {carbEstimate.qualitativeLabel && (
                  <Text
                    style={[
                      styles.qualLabel,
                      { color: carbLabelColor(carbEstimate.qualitativeLabel) },
                    ]}
                  >
                    {carbEstimate.qualitativeLabel}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.carbBadgeRow}>
              <View
                style={[
                  styles.confidenceBadge,
                  { backgroundColor: `${confidenceBadgeColor(carbEstimate.confidence)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.confidenceText,
                    { color: confidenceBadgeColor(carbEstimate.confidence) },
                  ]}
                >
                  {carbEstimate.confidence.charAt(0).toUpperCase() +
                    carbEstimate.confidence.slice(1)}
                </Text>
              </View>
              <Ionicons
                name={carbExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textTertiary}
              />
            </View>
          </TouchableOpacity>

          {carbExpanded && (
            <View style={styles.carbExplainer}>
              <Text style={styles.explainerFormula}>
                100 - {ga_protein_pct ?? '?'}% protein - {ga_fat_pct ?? '?'}%
                fat - {ga_fiber_pct ?? '?'}% fiber - {moisture}% moisture -{' '}
                {carbEstimate.ashUsedPct ?? '?'}% ash
                {carbEstimate.confidence === 'estimated' ? ' (est.)' : ''} = ~
                {Math.round(carbEstimate.valueDmb)}%
              </Text>
              <Text style={styles.explainerText}>
                Ash is the mineral content remaining after incineration — an
                industry-standard measurement.
              </Text>
              <Text style={styles.explainerText}>
                {species === 'cat'
                  ? 'Cats are obligate carnivores with limited carbohydrate metabolism.'
                  : 'Dogs can metabolize carbohydrates but excessive amounts may displace protein and fat.'}
              </Text>
              <Text style={styles.explainerCitation}>
                AAFCO Official Publication; NRC Nutrient Requirements (2006)
                Ch. 3
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.carbSection}>
          <View style={styles.carbHeader}>
            <Text style={styles.macroLabel}>Carbohydrate (est.)</Text>
            <View style={styles.carbValueRow}>
              <Text style={styles.macroValue}>Unknown</Text>
              <View
                style={[
                  styles.confidenceBadge,
                  { backgroundColor: `${Colors.severityNone}20` },
                ]}
              >
                <Text style={[styles.confidenceText, { color: Colors.severityNone }]}>
                  Unknown
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* DMB disclaimer (D-016) */}
      {isWetFood && (
        <Text style={styles.dmbNote}>
          Values adjusted for moisture content (Dry Matter Basis)
        </Text>
      )}

      {/* LLM-extracted disclaimer */}
      {scoredResult.llmExtracted && (
        <Text style={styles.llmNote}>
          Nutritional data extracted from label — verify with manufacturer for
          precision use
        </Text>
      )}

      {/* Bonus nutrients */}
      {bonusNutrients.length > 0 && (
        <View style={styles.bonusSection}>
          <Text style={styles.bonusHeader}>Supplemental Nutrients</Text>
          <View style={styles.bonusGrid}>
            {bonusNutrients.map((n) => (
              <View key={n.label} style={styles.bonusItem}>
                <Text style={styles.bonusLabel}>{n.label}</Text>
                <View style={styles.bonusBadge}>
                  <Text style={styles.bonusValue}>{n.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── MacroRow Sub-component ─────────────────────────────

function MacroRow({
  label,
  value,
  moisture,
  isWetFood,
  aafcoMin,
  aafcoMax,
}: {
  label: string;
  value: number;
  moisture: number;
  isWetFood: boolean;
  aafcoMin?: number;
  aafcoMax?: number;
}) {
  const dmbValue = isWetFood ? toDmb(value, moisture) : value;
  const displayColor = aafcoMin != null
    ? barColor(dmbValue, aafcoMin)
    : Colors.accent;

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {isWetFood
            ? `${value}% as-fed (${dmbValue.toFixed(1)}% DMB)`
            : `${value}%`}
        </Text>
      </View>
      <View style={styles.barContainer}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(dmbValue, 100)}%`,
                backgroundColor: displayColor,
              },
            ]}
          />
        </View>
        {aafcoMin != null && (
          <View
            style={[
              styles.aafcoMarkerLine,
              { left: `${Math.min(aafcoMin, 100)}%` },
            ]}
          />
        )}
        {aafcoMax != null && (
          <View
            style={[
              styles.aafcoMarkerLineDashed,
              { left: `${Math.min(aafcoMax, 100)}%` },
            ]}
          />
        )}
      </View>
      {aafcoMin != null && (
        <Text style={styles.aafcoLabel}>AAFCO min: {aafcoMin}%</Text>
      )}
      {aafcoMax != null && (
        <Text style={styles.aafcoLabel}>AAFCO max: {aafcoMax}%</Text>
      )}
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
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

  // ─── Macro Rows
  macroRow: {
    marginBottom: 14,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  macroLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  macroValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  barContainer: {
    position: 'relative',
    height: 10,
    justifyContent: 'center',
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  aafcoMarkerLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  aafcoMarkerLineDashed: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderStyle: 'dashed',
  },
  aafcoLabel: {
    fontSize: FontSizes.xs,
    color: '#A0A0A0',
    marginTop: 3,
  },

  // ─── Carb Estimation (D-104)
  carbSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
    paddingTop: 12,
    marginTop: 2,
  },
  carbRow: {
    paddingBottom: 4,
  },
  carbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  carbValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  carbBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  carbExplainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  explainerFormula: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  explainerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  explainerCitation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ─── DMB Note (D-016)
  dmbNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  llmNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
  },

  // ─── Bonus Nutrients
  bonusSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
    paddingTop: 12,
    marginTop: 4,
  },
  bonusHeader: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  bonusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bonusLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  bonusBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bonusValue: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.severityGreen,
  },
});
