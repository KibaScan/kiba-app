// Kiba — DCM Advisory Card
// Educational card for grain-free + legume DCM advisory (Layer 2, D-013).
// D-095: Factual language only. "Potential association," "no causal link established."
// D-084: No emoji. Ionicons only. D-094: Pet name in score impact line.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface DcmAdvisoryCardProps {
  legumesFound: Array<{ name: string; position: number }>;
  isGrainFree: boolean;
  hasTaurine: boolean;
  hasLCarnitine: boolean;
  dcmPenalty: number;
  petName: string;
}

// ─── Component ──────────────────────────────────────────

export function DcmAdvisoryCard({
  legumesFound,
  isGrainFree,
  hasTaurine,
  hasLCarnitine,
  dcmPenalty,
  petName,
}: DcmAdvisoryCardProps) {
  // Guard: only render when DCM advisory conditions are met
  if (!isGrainFree || legumesFound.length < 3) return null;

  const hasBothSupplements = hasTaurine && hasLCarnitine;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name="heart-outline"
          size={20}
          color={Colors.severityRed}
        />
        <Text style={styles.title}>Heart Health Advisory</Text>
      </View>

      <Text style={styles.body}>
        This product is grain-free and contains {legumesFound.length} legume
        ingredients in the first 7 positions:
      </Text>

      <View style={styles.bulletList}>
        {legumesFound.map((legume) => (
          <BulletRow
            key={`${legume.name}-${legume.position}`}
            text={`${legume.name} — position ${legume.position}`}
          />
        ))}
      </View>

      <Text style={styles.body}>
        The FDA has investigated a potential association between grain-free
        diets high in legumes and dilated cardiomyopathy (DCM) in dogs.
        Research is ongoing and no causal link has been established.
      </Text>

      {hasBothSupplements ? (
        <View style={styles.mitigationSection}>
          <Text style={styles.mitigationText}>
            This product includes taurine and L-carnitine supplementation,
            which are associated with heart health support in veterinary
            research. Score impact reduced from {'\u2212'}8 to {'\u2212'}5 points.
          </Text>
        </View>
      ) : (
        <Text style={styles.body}>
          This product does not include both taurine and L-carnitine
          supplementation.
        </Text>
      )}

      <Text style={styles.scoreImpact}>
        Score impact: {'\u2212'}{Math.abs(dcmPenalty)} points for {petName}
      </Text>
    </View>
  );
}

// ─── Bullet Row ─────────────────────────────────────────

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons
        name="chevron-forward-outline"
        size={12}
        color={Colors.textTertiary}
        style={styles.bulletIcon}
      />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.severityRed,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  body: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  bulletList: {
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletIcon: {
    marginTop: 3,
    marginRight: 6,
  },
  bulletText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  mitigationSection: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityGreen,
    paddingLeft: 10,
    marginBottom: Spacing.sm,
  },
  mitigationText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  scoreImpact: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
