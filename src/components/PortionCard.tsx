// Portion Card — Displays daily calorie target and product portions.
// Standalone component for Pet Hub and scan result advisory.
// D-094: pet name always in context.
// D-095: factual language only, no prescriptive terms.
// D-106: portions are display-only, never modify scores.
// D-062: cat hepatic lipidosis amber warning card.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../types/pet';
import type { Product } from '../types';
import {
  lbsToKg,
  calculateRER,
  getDerMultiplier,
  calculateDailyPortion,
  calculateGoalWeightPortion,
} from '../services/portionCalculator';
import { isPremium } from '../utils/permissions';
import * as haptics from '../utils/haptics';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ───────────────────────────────────────────────

interface PortionCardProps {
  pet: Pet;
  product: Product | null;
  conditions: string[];
  isSupplemental?: boolean;
}

// ─── Exported Helpers (testable without render library) ──

/** Format kcal with comma separator. All pet calorie values < 10,000. */
export function formatCalories(kcal: number): string {
  const rounded = Math.round(kcal);
  if (rounded >= 1000) {
    return `${Math.floor(rounded / 1000)},${String(rounded % 1000).padStart(3, '0')}`;
  }
  return String(rounded);
}

/** Format cups to 1 decimal place. */
export function formatCups(cups: number): string {
  return cups.toFixed(1);
}

/** Format grams to nearest integer. */
export function formatGrams(grams: number): string {
  return String(Math.round(grams));
}

/** Compute age in whole months from DOB string (YYYY-MM-DD). */
export function getAgeMonths(dateOfBirth: string | null, now?: Date): number | undefined {
  if (!dateOfBirth) return undefined;
  // Parse as local time to avoid UTC midnight timezone shift
  const parts = dateOfBirth.split('-');
  if (parts.length < 3) return undefined;
  const dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dob.getTime())) return undefined;
  const ref = now ?? new Date();
  return (ref.getFullYear() - dob.getFullYear()) * 12 + (ref.getMonth() - dob.getMonth());
}

/** Truncate product name for inline portion text — strip package size info. */
function shortenProductName(name: string, maxLen = 40): string {
  // Strip common suffixes after comma (package size, format info)
  const commaIdx = name.indexOf(',');
  const short = commaIdx > 0 ? name.substring(0, commaIdx).trim() : name;
  if (short.length <= maxLen) return short;
  return short.substring(0, maxLen - 1).trim() + '\u2026';
}

/** Whether to show goal weight section. Premium-gated per permissions.ts. */
export function shouldShowGoalWeight(
  weightGoalLbs: number | null,
  weightCurrentLbs: number | null,
  conditions: string[],
  premium: boolean,
): boolean {
  return (
    premium &&
    weightGoalLbs != null &&
    weightCurrentLbs != null &&
    (conditions.includes('obesity') || conditions.includes('underweight'))
  );
}

// ─── Component ───────────────────────────────────────────

export default function PortionCard({ pet, product, conditions, isSupplemental }: PortionCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  const portionData = useMemo(() => {
    if (pet.weight_current_lbs == null) return null;

    const weightKg = lbsToKg(pet.weight_current_lbs);
    const rer = calculateRER(weightKg);
    const ageMonths = getAgeMonths(pet.date_of_birth);

    const multiplierResult = getDerMultiplier({
      species: pet.species,
      lifeStage: pet.life_stage,
      isNeutered: pet.is_neutered,
      activityLevel: pet.activity_level,
      ageMonths,
      conditions,
    });

    const der = Math.round(rer * multiplierResult.multiplier);

    const dailyPortion = product
      ? calculateDailyPortion(der, product.ga_kcal_per_cup, product.ga_kcal_per_kg)
      : null;

    const showGoal = shouldShowGoalWeight(
      pet.weight_goal_lbs,
      pet.weight_current_lbs,
      conditions,
      isPremium(),
    );

    let goalResult = null;
    let goalPortion = null;
    if (showGoal && pet.weight_goal_lbs != null) {
      goalResult = calculateGoalWeightPortion({
        currentWeightLbs: pet.weight_current_lbs,
        goalWeightLbs: pet.weight_goal_lbs,
        species: pet.species,
        lifeStage: pet.life_stage,
        isNeutered: pet.is_neutered,
        activityLevel: pet.activity_level,
        ageMonths,
        conditions,
      });
      if (product) {
        goalPortion = calculateDailyPortion(
          goalResult.derKcal,
          product.ga_kcal_per_cup,
          product.ga_kcal_per_kg,
        );
      }
    }

    return { der, multiplierResult, dailyPortion, showGoal, goalResult, goalPortion };
  }, [pet, product, conditions]);

  // Fire hepatic warning haptic when warning becomes visible
  useEffect(() => {
    if (portionData?.goalResult?.hepaticWarning) {
      haptics.hepaticWarning();
    }
  }, [portionData?.goalResult?.hepaticWarning]);

  // Supplemental products — portion calculation is nonsensical for toppers/mixers
  if (isSupplemental) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Serving Size</Text>
        <Text style={styles.supplementalText}>
          This product is a meal topper. Refer to package feeding guidelines for serving size.
        </Text>
      </View>
    );
  }

  // No weight — prompt user
  if (!portionData) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Daily Calories</Text>
        <Text style={styles.emptyText}>Add weight to see daily portions.</Text>
      </View>
    );
  }

  const { der, multiplierResult, dailyPortion, showGoal, goalResult, goalPortion } = portionData;

  return (
    <View style={styles.card}>
      {/* Header row with info toggle */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Daily Calories</Text>
        <TouchableOpacity onPress={() => setShowInfo(!showInfo)} activeOpacity={0.7}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* DER display */}
      <Text style={styles.derLine}>
        <Text style={styles.derValue}>{formatCalories(der)}</Text>
        <Text style={styles.derUnit}> kcal/day for {pet.name}</Text>
      </Text>

      {/* Quick cups conversion when kcal_per_cup available */}
      {product?.ga_kcal_per_cup != null && product.ga_kcal_per_cup > 0 && (() => {
        const cups = der / product.ga_kcal_per_cup;
        const isVerySmall = pet.species === 'cat' ? cups < 0.25 : cups < 0.33;
        return (
          <>
            <Text style={styles.cupsLine}>
              {'\u2248'} {formatCups(cups)} cups/day
            </Text>
            {isVerySmall && (
              <Text style={styles.cupsNote}>
                Portions are very small at this caloric density
              </Text>
            )}
          </>
        );
      })()}

      {/* Multiplier label */}
      <Text style={styles.multiplierLabel}>
        Based on: {multiplierResult.label} ({multiplierResult.multiplier}× RER)
      </Text>

      {/* Info tooltip */}
      {showInfo && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            RER = 70 × (weight in kg)^0.75{'\n'}
            DER = RER × {multiplierResult.multiplier} ({multiplierResult.source})
          </Text>
        </View>
      )}

      {/* Product portions: cups preferred, grams fallback */}
      {dailyPortion?.cups != null && product && (
        <Text style={styles.portionLine} numberOfLines={1}>
          ~{formatCups(dailyPortion.cups)} cups/day of {shortenProductName(product.name)}
        </Text>
      )}
      {dailyPortion?.cups == null && dailyPortion?.grams != null && product && (
        <Text style={styles.portionLine} numberOfLines={1}>
          ~{formatGrams(dailyPortion.grams)}g/day of {shortenProductName(product.name)}
        </Text>
      )}

      {/* Goal weight section (premium-gated) */}
      {showGoal && goalResult && (
        <View style={styles.goalSection}>
          <Text style={styles.goalTitle}>Goal Weight Portions</Text>
          <Text style={styles.goalDer}>
            <Text style={styles.derValue}>{formatCalories(goalResult.derKcal)}</Text>
            <Text style={styles.derUnit}> kcal/day</Text>
          </Text>
          {goalPortion?.cups != null && (
            <Text style={styles.goalPortion}>
              ~{formatCups(goalPortion.cups)} cups/day
            </Text>
          )}
          {goalPortion?.cups == null && goalPortion?.grams != null && (
            <Text style={styles.goalPortion}>
              ~{formatGrams(goalPortion.grams)}g/day
            </Text>
          )}
        </View>
      )}

      {/* Hepatic lipidosis warning — D-062, D-095 compliant */}
      {goalResult?.hepaticWarning && (
        <View style={styles.hepaticCard}>
          <View style={styles.hepaticHeader}>
            <Ionicons name="alert-circle" size={18} color={Colors.severityAmber} />
            <Text style={styles.hepaticTitle}>Gradual weight loss is important</Text>
          </View>
          <Text style={styles.hepaticBody}>
            Losing weight too quickly can strain the liver in cats. Consider discussing
            a weight loss plan with your veterinarian.
          </Text>
        </View>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  supplementalText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  derLine: {
    marginTop: Spacing.xs,
  },
  derValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.accent,
  },
  derUnit: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  cupsLine: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cupsNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  multiplierLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  infoBox: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  portionLine: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  goalSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  goalTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  goalDer: {
    marginTop: Spacing.xs,
  },
  goalPortion: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  hepaticCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  hepaticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  hepaticTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.severityAmber,
  },
  hepaticBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
