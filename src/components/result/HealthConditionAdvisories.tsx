// Kiba — Health Condition Advisories (M6)
// Plain functional placeholder — will be redesigned by a designer later.
// D-095 compliant: all advisory text from conditionAdvisories.ts, no prescriptive language.
// D-094: suitability framing, factual score impact display.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getConditionAdvisory } from '../../data/conditionAdvisories';
import type { PersonalizationDetail } from '../../types/scoring';

// ─── Props ──────────────────────────────────────────────

interface HealthConditionAdvisoriesProps {
  conditions: string[];
  species: 'dog' | 'cat';
  petName: string;
  personalizations: PersonalizationDetail[];  // pre-filtered to type==='condition'
  finalScore: number;
}

// ─── Display name map ───────────────────────────────────

const CONDITION_DISPLAY_NAMES: Record<string, string> = {
  obesity: 'Overweight / Obese',
  underweight: 'Underweight',
  gi_sensitive: 'Sensitive Stomach',
  diabetes: 'Diabetes',
  pancreatitis: 'Pancreatitis',
  ckd: 'Kidney Disease',
  cardiac: 'Heart Disease',
  urinary: 'Urinary Issues',
  joint: 'Joint Issues',
  skin: 'Skin & Coat Issues',
  hypothyroid: 'Hypothyroidism',
  hyperthyroid: 'Hyperthyroidism',
};

// ─── Zero-out detection ─────────────────────────────────

function isCardiacDcmZeroOut(
  finalScore: number,
  personalizations: PersonalizationDetail[],
): boolean {
  if (finalScore !== 0) return false;
  return personalizations.some(
    (p) => p.type === 'condition' && p.label.includes('DCM'),
  );
}

// ─── Component ──────────────────────────────────────────

export function HealthConditionAdvisories({
  conditions,
  species,
  petName,
  personalizations,
  finalScore,
}: HealthConditionAdvisoriesProps) {
  if (conditions.length === 0) return null;

  const zeroedOut = isCardiacDcmZeroOut(finalScore, personalizations);

  // ─── Cardiac + DCM zero-out: prominent warning ────────
  if (zeroedOut) {
    return (
      <View style={styles.container}>
        <View style={styles.zeroOutCard}>
          <View style={styles.zeroOutHeader}>
            <Ionicons name="warning" size={22} color={Colors.severityRed} />
            <Text style={styles.zeroOutTitle}>
              Critical Warning for {petName}
            </Text>
          </View>
          <Text style={styles.zeroOutBody}>
            {petName} has heart disease. This product contains pulse ingredients
            linked to DCM in dogs. Discuss alternatives with your veterinarian
            immediately.
          </Text>
          <Text style={styles.zeroOutScore}>
            This product scored 0% match due to this combination.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Normal advisory cards ────────────────────────────

  // Group personalizations by condition for score impact display
  const adjustmentsByCondition = new Map<string, PersonalizationDetail[]>();
  for (const p of personalizations) {
    if (p.type !== 'condition') continue;
    // Extract condition name from label — personalizations include condition in label
    for (const cond of conditions) {
      // Match if the personalization label relates to this condition
      // Personalizations from conditionScoring have the condition name embedded
      const existing = adjustmentsByCondition.get(cond) ?? [];
      adjustmentsByCondition.set(cond, existing);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="medkit-outline" size={20} color={Colors.textPrimary} />
        <Text style={styles.headerText}>Health Profile for {petName}</Text>
      </View>

      {/* Per-condition cards */}
      {conditions.map((condition) => {
        const displayName = CONDITION_DISPLAY_NAMES[condition] ?? condition;
        const advisory = getConditionAdvisory(condition, species, petName);

        // Find personalizations matching this condition
        const condPersonalizations = personalizations.filter(
          (p) => p.type === 'condition',
        );

        // Sum score impact for this condition — parse from label "(+N)" or "(-N)"
        const condAdjustments = condPersonalizations.filter((p) => {
          const lower = p.label.toLowerCase();
          const condLower = condition.toLowerCase().replace(/_/g, ' ');
          // Match by condition keywords in the label
          return lower.includes(condLower) ||
            // Also match specific patterns from conditionScoring rule names
            (condition === 'obesity' && (lower.includes('fiber') || lower.includes('l-carnitine') || lower.includes('fat') || lower.includes('caloric'))) ||
            (condition === 'gi_sensitive' && (lower.includes('digestib') || lower.includes('fiber') || lower.includes('novel protein'))) ||
            (condition === 'underweight' && (lower.includes('caloric') || lower.includes('protein') || lower.includes('fat'))) ||
            (condition === 'ckd' && (lower.includes('kidney') || lower.includes('phosphorus') || lower.includes('protein'))) ||
            (condition === 'cardiac' && (lower.includes('heart') || lower.includes('sodium') || lower.includes('taurine') || lower.includes('dcm'))) ||
            (condition === 'diabetes' && (lower.includes('carb') || lower.includes('glycemic') || lower.includes('fiber'))) ||
            (condition === 'pancreatitis' && (lower.includes('fat') || lower.includes('pancrea'))) ||
            (condition === 'urinary' && (lower.includes('urin') || lower.includes('moisture') || lower.includes('mineral'))) ||
            (condition === 'joint' && (lower.includes('joint') || lower.includes('omega') || lower.includes('glucosamine'))) ||
            (condition === 'skin' && (lower.includes('skin') || lower.includes('omega') || lower.includes('zinc'))) ||
            (condition === 'hypothyroid' && (lower.includes('thyroid') || lower.includes('iodine') || lower.includes('fat') || lower.includes('metabolism'))) ||
            (condition === 'hyperthyroid' && (lower.includes('thyroid') || lower.includes('iodine') || lower.includes('protein')));
        });

        const totalImpact = condAdjustments.reduce((sum, p) => sum + p.adjustment, 0);

        return (
          <View key={condition} style={styles.card}>
            <Text style={styles.conditionName}>{displayName}</Text>

            {advisory && (
              <Text style={styles.advisoryText}>{advisory}</Text>
            )}

            {condAdjustments.length > 0 && (
              <View style={styles.impactRow}>
                <Text
                  style={[
                    styles.impactValue,
                    { color: totalImpact > 0 ? Colors.severityGreen : totalImpact < 0 ? Colors.severityAmber : Colors.textSecondary },
                  ]}
                >
                  Score impact: {totalImpact > 0 ? '+' : ''}{totalImpact} pts
                </Text>
                {condAdjustments.length === 1 && (
                  <Text style={styles.impactReason}>
                    ({condAdjustments[0].label.replace(/\s*\([+-]?\d+\)\s*$/, '')})
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        Based on veterinary nutrition guidelines. Discuss therapeutic diets with your veterinarian.
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  headerText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Normal condition card
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  conditionName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  advisoryText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  impactRow: {
    marginTop: Spacing.xs,
  },
  impactValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  impactReason: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Zero-out card
  zeroOutCard: {
    backgroundColor: Colors.severityRed + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.severityRed + '40',
    padding: Spacing.lg,
  },
  zeroOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  zeroOutTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.severityRed,
  },
  zeroOutBody: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  zeroOutScore: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Disclaimer
  disclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
});
