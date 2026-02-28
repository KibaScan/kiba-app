// BreedContraindicationCard — Red warning card for binary breed-specific risks (D-112).
// Zero score impact — visual warnings only. Ionicons only — zero emoji (D-084).
// D-095 compliant copy: factual, mechanism-based, no editorial language.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PersonalizationDetail } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface BreedContraindicationCardProps {
  contraindications: PersonalizationDetail[]; // filtered to type === 'breed_contraindication'
}

// ─── Component ──────────────────────────────────────────

export function BreedContraindicationCard({
  contraindications,
}: BreedContraindicationCardProps) {
  if (contraindications.length === 0) return null;

  return (
    <View style={styles.container}>
      {contraindications.map((ci, index) => (
        <View key={`${ci.label}-${index}`} style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons
              name="warning-outline"
              size={18}
              color={Colors.severityRed}
            />
            <Text style={styles.headerText}>Breed Alert</Text>
          </View>
          <Text style={styles.reasonText}>{ci.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    gap: 8,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.severityRed,
  },
  reasonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
