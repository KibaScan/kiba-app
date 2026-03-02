// Treat Battery Gauge — Visual horizontal bar showing daily treat budget usage.
// M2: consumedKcal always 0 (no pantry tracking). M5 pipes real data.
// D-094: pet name always in context.
// D-060: Treat budget = 10% of DER.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ───────────────────────────────────────────────

interface TreatBatteryGaugeProps {
  treatBudgetKcal: number;
  consumedKcal: number;
  petName: string;
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
}: TreatBatteryGaugeProps) {
  const percent = getBarPercent(consumedKcal, treatBudgetKcal);
  const barColor = getBarColor(percent);
  // Visual fill capped at 100% width
  const fillWidth = Math.min(percent, 100);

  return (
    <View style={styles.card}>
      {/* Title */}
      <Text style={styles.title}>
        {petName}'s Treat Budget
      </Text>

      {/* Budget label */}
      <Text style={styles.budgetLabel}>
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
        {/* Percentage text overlaid on bar */}
        <Text style={styles.barText}>
          {Math.round(percent)}%
        </Text>
      </View>

      {/* Status label */}
      <Text style={[styles.statusLabel, { color: barColor }]}>
        {getStatusLabel(percent)}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
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
    backgroundColor: Colors.background,
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
});
