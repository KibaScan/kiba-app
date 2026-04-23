// Kiba — TodayMixCard
// Today's mix recipe: proportion gauge + vertical recipe lines + instruction.
// D-084: Zero emoji. Fix 1: Vertical recipe layout.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

interface TodayMixProduct {
  brand: string;
}

interface TodayMix {
  oldPct: number;
  newPct: number;
}

interface TodayMixCardProps {
  currentDay: number;
  todayMix: TodayMix;
  oldProduct: TodayMixProduct;
  newProduct: TodayMixProduct;
  oldName: string;
  newName: string;
  oldAmount: number;
  newAmount: number;
  oldUnitStr: string;
  newUnitStr: string;
  petName: string;
}

export default function TodayMixCard({
  currentDay,
  todayMix,
  oldProduct,
  newProduct,
  oldName,
  newName,
  oldAmount,
  newAmount,
  oldUnitStr,
  newUnitStr,
  petName,
}: TodayMixCardProps) {
  return (
    <View style={styles.todayCard}>
      <Text style={styles.todaySectionLabel}>TODAY'S MIX</Text>
      <Text style={styles.todayDayText}>Day {currentDay}</Text>

      {/* Proportion gauge — fully saturated segments with inline labels */}
      <View style={styles.proportionBar}>
        {todayMix.oldPct > 0 && (
          <View style={[styles.proportionSegment, {
            flex: todayMix.oldPct,
            backgroundColor: Colors.severityAmber,
          }]}>
            {todayMix.oldPct >= 18 && (
              <Text style={styles.proportionLabel}>{todayMix.oldPct}%</Text>
            )}
          </View>
        )}
        <View style={[styles.proportionSegment, {
          flex: todayMix.newPct,
          backgroundColor: Colors.severityGreen,
        }]}>
          {todayMix.newPct >= 18 && (
            <Text style={styles.proportionLabel}>{todayMix.newPct}%</Text>
          )}
        </View>
      </View>

      {/* Recipe layout — vertical, color-coded to match proportion bar */}
      <View style={styles.recipeLayout}>
        {todayMix.oldPct > 0 && (
          <View style={styles.recipeLine}>
            <View style={[styles.recipeDot, { backgroundColor: Colors.severityAmber }]} />
            <Text style={styles.recipeAmount}>{oldAmount} {oldUnitStr} ({todayMix.oldPct}%)</Text>
            <Text style={styles.recipeSep}>·</Text>
            <Text style={styles.recipeBrand} numberOfLines={1}>{oldProduct.brand}</Text>
          </View>
        )}
        <View style={styles.recipeLine}>
          <View style={[styles.recipeDot, { backgroundColor: Colors.severityGreen }]} />
          <Text style={styles.recipeAmount}>{newAmount} {newUnitStr} ({todayMix.newPct}%)</Text>
          <Text style={styles.recipeSep}>·</Text>
          <Text style={styles.recipeBrand} numberOfLines={1}>{newProduct.brand}</Text>
        </View>
      </View>

      <Text style={styles.mixInstruction}>
        {todayMix.newPct === 100
          ? `Serve 100% ${truncate(newName, 25)} in ${petName}'s bowl`
          : `Mix both foods together in ${petName}'s bowl`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  todayCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.accent,
    gap: 10,
  },
  todaySectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  todayDayText: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },

  // Proportion gauge — fully saturated, taller, inline labels
  proportionBar: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 2,
  },
  proportionSegment: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  proportionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Fix 1: Vertical recipe layout
  recipeLayout: { gap: 8, marginTop: 2 },
  recipeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recipeDot: { width: 8, height: 8, borderRadius: 4 },
  recipeAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  recipeSep: { fontSize: FontSizes.sm, color: Colors.textTertiary },
  recipeBrand: { fontSize: FontSizes.sm, color: Colors.textSecondary, flex: 1 },

  mixInstruction: { fontSize: FontSizes.sm, color: Colors.textTertiary, lineHeight: 18 },
});
