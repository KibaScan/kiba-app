// Kiba — Result Screen (Score Display Placeholder)
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, FontSizes, Spacing } from '../utils/constants';

export default function ResultScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Result</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.scorePlaceholder}>
          <Text style={styles.scoreValue}>--</Text>
          <Text style={styles.scoreLabel}>% match for your pet</Text>
        </View>

        <View style={styles.waterfallPlaceholder}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.layerRow}>
            <Text style={styles.layerLabel}>Ingredient Concerns</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
          <View style={styles.layerRow}>
            <Text style={styles.layerLabel}>Nutritional Fit</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
          <View style={styles.layerRow}>
            <Text style={styles.layerLabel}>Breed & Age Adjustments</Text>
            <Text style={styles.layerValue}>--</Text>
          </View>
        </View>

        <Text style={styles.placeholder}>
          Scoring engine coming in M1.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  scorePlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  scoreLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  waterfallPlaceholder: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  layerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  layerLabel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  layerValue: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  placeholder: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
});
