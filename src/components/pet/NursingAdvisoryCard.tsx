// Kiba — Nursing Advisory Card
// Informational card for pets under 4 weeks old scanning solid food.
// D-095 compliant: factual language, vet consult recommendation, not prescriptive.
// Species-agnostic — same message for puppies and kittens.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

export function NursingAdvisoryCard() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={Colors.severityAmber}
        />
        <Text style={styles.title}>Very Young Pet Advisory</Text>
      </View>
      <Text style={styles.body}>
        Pets under 4 weeks old should be primarily nursing. Consult your
        veterinarian before introducing solid food.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.severityAmber,
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
  },
});
