// Treat Battery Gauge — Visual horizontal bar showing daily treat budget usage.
// M2: consumedKcal always 0 (no pantry tracking). M5 pipes real data.
// D-094: pet name always in context.
// D-060: Treat budget = 10% of DER.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { InfoTooltip } from './ui/InfoTooltip';
import type { CalorieSource } from '../utils/calorieEstimation';

// ─── Props ───────────────────────────────────────────────

interface TreatBatteryGaugeProps {
  treatBudgetKcal: number;
  consumedKcal: number;
  petName: string;
  title?: string;
  calorieSource?: CalorieSource;
  treatCount?: number;
  onLogTreat?: () => void;
}

// ─── Exported Helpers (testable without render library) ──

/** Bar fill percentage. Clamped to 0 minimum, uncapped for "over budget" display. */
export function getBarPercent(consumed: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.max(0, (consumed / budget) * 100);
}

/** Bar color based on consumption percentage. */
export function getBarColor(percent: number): string {
  if (percent > 100) return Colors.severityRed;
  if (percent > 80) return Colors.severityAmber;
  return Colors.severityGreen;
}

/** Status label below bar. */
export function getStatusLabel(percent: number): string {
  if (percent > 100) return 'Over budget';
  return `${Math.round(percent)}% used`;
}

// ─── Component ───────────────────────────────────────────

export default function TreatBatteryGauge({
  treatBudgetKcal,
  consumedKcal,
  petName,
  title,
  calorieSource,
  treatCount,
  onLogTreat,
}: TreatBatteryGaugeProps) {
  // calorieSource === null means product has no calorie data AND Atwater can't estimate.
  // undefined means not passed (e.g. PetHubScreen general view) — show normally.
  const noCalorieData = calorieSource === null;

  const percent = getBarPercent(consumedKcal, treatBudgetKcal);
  const barColor = getBarColor(percent);
  // Visual fill capped at 100% width
  const fillWidth = Math.min(percent, 100);

  return (
    <View style={styles.card}>
      {/* Title */}
      <Text style={styles.title}>
        {title ?? `${petName}'s Treat Budget`}
      </Text>

      {noCalorieData ? (
        <>
          {/* No calorie data — show unavailable state */}
          <View style={styles.barTrack}>
            <Text style={styles.unavailableText}>Calorie data not available</Text>
          </View>
          <Text style={styles.unavailableHint}>
            This treat doesn't list calorie content and can't be estimated
          </Text>
        </>
      ) : (
        <>
          {/* Budget label */}
          <Text style={[styles.budgetLabel, { color: consumedKcal > 0 ? Colors.severityGreen : Colors.textSecondary }]}>
            {Math.round(consumedKcal)}/{Math.round(treatBudgetKcal)} kcal
          </Text>

          {/* Bar */}
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${fillWidth}%`,
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>

          {/* Treat count */}
          {treatCount != null && treatCount > 0 && (
            <Text style={styles.treatCountText}>
              {treatCount} treat{treatCount !== 1 ? 's' : ''} today
            </Text>
          )}

          {/* Atwater estimation note */}
          {calorieSource === 'estimated' && (
            <View style={styles.estimateRow}>
              <Text style={styles.estimateNote}>Calories estimated from nutritional profile</Text>
              <InfoTooltip
                maxWidth={280}
                text="This product doesn't list calorie content. Estimated using the Modified Atwater method (NRC, 2006) based on protein, fat, and carbohydrate percentages."
              />
            </View>
          )}
        </>
      )}

      {onLogTreat && (
        <>
          <View style={styles.logTreatSeparator} />
          <TouchableOpacity
            style={styles.logTreatRow}
            activeOpacity={0.7}
            onPress={onLogTreat}
          >
            <Ionicons name="restaurant-outline" size={16} color={Colors.accent} />
            <Text style={styles.logTreatText}>Log a Treat</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  budgetLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  barTrack: {
    height: 28,
    backgroundColor: Colors.chipSurface,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
  },
  barText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  statusLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  treatCountText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estimateNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  unavailableText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  unavailableHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  logTreatSeparator: {
    height: 1,
    backgroundColor: Colors.hairlineBorder,
  },
  logTreatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
  },
  logTreatText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
});
