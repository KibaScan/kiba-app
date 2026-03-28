// Portion Card — Displays daily calorie target and product portions.
// Standalone component for Pet Hub and scan result advisory.
// D-094: pet name always in context.
// D-095: factual language only, no prescriptive terms.
// D-106: portions are display-only, never modify scores.
// D-062: cat hepatic lipidosis amber warning card.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../types/pet';
import type { Product } from '../types';
import {
  lbsToKg,
  calculateRER,
  getDerMultiplier,
  calculateDailyPortion,
} from '../services/portionCalculator';
import { isPremium } from '../utils/permissions';
import { updatePet } from '../services/petService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveCalories, resolveKcalPerCup } from '../utils/calorieEstimation';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { usePantryStore } from '../stores/usePantryStore';
import { updatePetAssignment } from '../services/pantryService';
import { getAdjustedDER, WEIGHT_GOAL_MULTIPLIERS } from '../utils/weightGoal';
import WeightGoalSlider from './WeightGoalSlider';

// ─── Props ───────────────────────────────────────────────

interface PortionCardProps {
  pet: Pet;
  product: Product | null;
  conditions: string[];
  isSupplemental?: boolean;
  showPetName?: boolean;
  onBCSPress?: () => void;
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

const PORTION_UNIT_KEY = 'portionUnit';

/** Compute grams per cup from calorie density: (kcal_per_cup / kcal_per_kg) × 1000 */
export function computeGramsPerCup(kcalPerCup: number, kcalPerKg: number): number {
  return (kcalPerCup / kcalPerKg) * 1000;
}

/** Whether the product has sufficient calorie data for cups↔grams toggle. */
export function canShowPortionToggle(product: Product | null): {
  canToggle: boolean;
  gramsPerCup: number | null;
  isEstimated: boolean;
} {
  if (!product || product.ga_kcal_per_cup == null || product.ga_kcal_per_cup <= 0) {
    return { canToggle: false, gramsPerCup: null, isEstimated: false };
  }

  // Label kcal_per_kg — best source
  if (product.ga_kcal_per_kg != null && product.ga_kcal_per_kg > 0) {
    return {
      canToggle: true,
      gramsPerCup: computeGramsPerCup(product.ga_kcal_per_cup, product.ga_kcal_per_kg),
      isEstimated: false,
    };
  }

  // Atwater fallback — resolveCalories short-circuits at priority 2 when cups
  // exist, so null them to isolate the Atwater path (D-149)
  const atwater = resolveCalories({
    ...product,
    ga_kcal_per_cup: null,
    ga_kcal_per_kg: null,
  } as Product);
  if (atwater && atwater.kcalPerKg > 0) {
    return {
      canToggle: true,
      gramsPerCup: computeGramsPerCup(product.ga_kcal_per_cup, atwater.kcalPerKg),
      isEstimated: true,
    };
  }

  return { canToggle: false, gramsPerCup: null, isEstimated: false };
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

export default function PortionCard({ pet, product, conditions, isSupplemental, showPetName = true, onBCSPress }: PortionCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [portionUnit, setPortionUnit] = useState<'cups' | 'grams'>('cups');

  useEffect(() => {
    AsyncStorage.getItem(PORTION_UNIT_KEY).then((val) => {
      if (val === 'cups' || val === 'grams') setPortionUnit(val);
    });
  }, []);

  const handleToggleUnit = (unit: 'cups' | 'grams') => {
    setPortionUnit(unit);
    AsyncStorage.setItem(PORTION_UNIT_KEY, unit);
  };

  const handleLevelChange = useCallback(async (level: number) => {
    try {
      const oldLevel = pet.weight_goal_level ?? 0;
      await updatePet(pet.id, {
        weight_goal_level: level,
        health_reviewed_at: new Date().toISOString(),
      });

      // Scale serving sizes proportionally to DER change
      const oldMult = WEIGHT_GOAL_MULTIPLIERS[oldLevel] ?? 1.0;
      const newMult = WEIGHT_GOAL_MULTIPLIERS[level] ?? 1.0;
      if (oldMult !== newMult) {
        const ratio = newMult / oldMult;
        const items = usePantryStore.getState().items;
        const updates: Promise<unknown>[] = [];
        for (const item of items) {
          if (item.product.category === 'treat') continue;
          const asgn = item.assignments.find(
            (a) => a.pet_id === pet.id && a.feeding_frequency === 'daily',
          );
          if (!asgn) continue;
          const newServing = Math.round(asgn.serving_size * ratio * 100) / 100;
          updates.push(updatePetAssignment(asgn.id, { serving_size: newServing }));
        }
        await Promise.allSettled(updates);
      }

      // Reload pantry with updated servings + adjusted target_kcal
      await usePantryStore.getState().loadPantry(pet.id);
    } catch {
      // Silently fail — UI already reflects the change via store update
    }
  }, [pet]);

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

    const baseDer = Math.round(rer * multiplierResult.multiplier);
    const level = pet.weight_goal_level ?? 0;
    const der = level !== 0 ? getAdjustedDER(baseDer, level) : baseDer;

    const dailyPortion = product
      ? calculateDailyPortion(der, product.ga_kcal_per_cup, product.ga_kcal_per_kg)
      : null;

    return { baseDer, der, multiplierResult, dailyPortion };
  }, [pet, product, conditions]);

  const toggleData = useMemo(() => canShowPortionToggle(product), [product]);

  // Resolve kcal/cup — DB value first, estimated fallback for dry food
  const resolvedCup = useMemo(() => product ? resolveKcalPerCup(product) : null, [product]);

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

  const { baseDer, der, multiplierResult, dailyPortion } = portionData;

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
        <Text style={styles.derUnit}> kcal/day{showPetName ? ` for ${pet.name}` : ''}</Text>
      </Text>

      {/* Cups ↔ Grams toggle */}
      {toggleData.canToggle && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleSegment, portionUnit === 'cups' && styles.toggleSegmentActive]}
            onPress={() => handleToggleUnit('cups')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleLabel, portionUnit === 'cups' && styles.toggleLabelActive]}>Cups</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleSegment, portionUnit === 'grams' && styles.toggleSegmentActive]}
            onPress={() => handleToggleUnit('grams')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleLabel, portionUnit === 'grams' && styles.toggleLabelActive]}>Grams</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cups/day from resolved kcal/cup (DB or estimated) */}
      {resolvedCup && (() => {
        const cups = der / resolvedCup.kcalPerCup;
        const isVerySmall = pet.species === 'cat' ? cups < 0.25 : cups < 0.33;
        const useGrams = portionUnit === 'grams' && toggleData.gramsPerCup != null;
        return (
          <>
            <Text style={styles.cupsLine}>
              {'\u2248'} {useGrams
                ? `${formatGrams(cups * toggleData.gramsPerCup!)} g/day`
                : `${formatCups(cups)} cups/day`}
              {resolvedCup.isEstimated && <Text style={styles.estimatedTag}> (est.)</Text>}
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

      {/* kcal per cup — actionable density metric */}
      {resolvedCup && (
        <Text style={styles.portionLine}>
          {resolvedCup.kcalPerCup.toLocaleString()} kcal/cup{resolvedCup.isEstimated ? ' (est.)' : ''}
        </Text>
      )}

      {/* D-160: Weight goal slider */}
      {!isSupplemental && (
        <View style={styles.goalSection}>
          <WeightGoalSlider
            pet={pet}
            baseDER={baseDer}
            conditions={conditions}
            onLevelChange={handleLevelChange}
          />
          {onBCSPress && (
            <TouchableOpacity onPress={onBCSPress} style={styles.bcsLink} activeOpacity={0.7}>
              <Ionicons name="body-outline" size={14} color={Colors.accent} />
              <Text style={styles.bcsLinkText}>What's my pet's body condition?</Text>
            </TouchableOpacity>
          )}
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
  bcsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  bcsLinkText: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleSegment: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleSegmentActive: {
    backgroundColor: Colors.accent,
  },
  toggleLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  estimatedTag: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
