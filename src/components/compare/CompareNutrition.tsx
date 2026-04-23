// CompareNutrition — Two-column nutrition DMB comparison (protein/fat/fiber/moisture/kcal).
// Pure presentational component. Props provided by CompareScreen (state stays in parent).
// Clinical-copy rule (D-095): no color-coded "winner" for nutrition rows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { resolveKcalPerCup } from '../../utils/calorieEstimation';
import type { Product } from '../../types';

// ─── Constants ────────────────────────────────────────────

const NUTRITION_ROWS = [
  { key: 'protein', label: 'Protein', field: 'ga_protein_pct' as const },
  { key: 'fat', label: 'Fat', field: 'ga_fat_pct' as const },
  { key: 'fiber', label: 'Fiber', field: 'ga_fiber_pct' as const },
  { key: 'moisture', label: 'Moisture', field: 'ga_moisture_pct' as const },
];

// ─── Component ────────────────────────────────────────────

type Props = {
  productA: Product;
  productB: Product;
};

export function CompareNutrition({ productA, productB }: Props) {
  const cupA = resolveKcalPerCup(productA);
  const cupB = resolveKcalPerCup(productB);

  const fmtCup = (r: { kcalPerCup: number; isEstimated: boolean } | null) =>
    r == null ? '—' : `${r.kcalPerCup.toLocaleString()}${r.isEstimated ? '*' : ''}`;

  return (
    <View style={ss.section}>
      <Text style={ss.sectionTitle}>Nutrition (DMB)</Text>
      {productA.ga_protein_pct == null && productB.ga_protein_pct == null ? (
        <Text style={ss.emptyText}>No nutritional data available</Text>
      ) : (
        <>
          {NUTRITION_ROWS.map(({ key, label, field }) => {
            const valA = productA[field];
            const valB = productB[field];
            // Clinical-copy rule (D-095): no color-coded "winner" for
            // nutrition rows — "higher fat" isn't universally better.
            // Use subtle bold/dim differentiation only.
            const comparable = valA != null && valB != null;
            const aHeavier = comparable && (valA as number) > (valB as number);
            const bHeavier = comparable && (valB as number) > (valA as number);
            return (
              <View key={key} style={ss.nutritionRow}>
                <Text style={[
                  ss.nutritionValue,
                  aHeavier && ss.nutritionValueHeavier,
                  bHeavier && ss.nutritionValueLighter,
                ]}>
                  {valA != null ? `${valA}%` : '—'}
                </Text>
                <Text style={ss.nutritionLabel}>{label}</Text>
                <Text style={[
                  ss.nutritionValue,
                  bHeavier && ss.nutritionValueHeavier,
                  aHeavier && ss.nutritionValueLighter,
                ]}>
                  {valB != null ? `${valB}%` : '—'}
                </Text>
              </View>
            );
          })}
          {/* kcal/cup row — resolved with estimation fallback */}
          {(cupA != null || cupB != null) && (() => {
            const comparable = cupA != null && cupB != null;
            const aHeavier = comparable && cupA!.kcalPerCup > cupB!.kcalPerCup;
            const bHeavier = comparable && cupB!.kcalPerCup > cupA!.kcalPerCup;
            return (
              <View style={ss.nutritionRow}>
                <Text style={[
                  ss.nutritionValue,
                  aHeavier && ss.nutritionValueHeavier,
                  bHeavier && ss.nutritionValueLighter,
                ]}>
                  {fmtCup(cupA)}
                </Text>
                <Text style={ss.nutritionLabel}>kcal/cup</Text>
                <Text style={[
                  ss.nutritionValue,
                  bHeavier && ss.nutritionValueHeavier,
                  aHeavier && ss.nutritionValueLighter,
                ]}>
                  {fmtCup(cupB)}
                </Text>
              </View>
            );
          })()}
          {(productA.ga_protein_pct == null || productB.ga_protein_pct == null) && (
            <Text style={ss.partialNote}>Partial data — some values unavailable</Text>
          )}
        </>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  nutritionLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  nutritionValue: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  nutritionValueHeavier: {
    fontWeight: '800',
  },
  nutritionValueLighter: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  partialNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
