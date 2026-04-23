// Kiba — ComparisonCard
// Product comparison header: old → new with score badge.
// D-084: Zero emoji. D-168: score framing — dense surface, {score}% only.

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';

interface ComparisonCardProduct {
  brand: string;
  image_url?: string | null;
}

interface ComparisonCardProps {
  oldProduct: ComparisonCardProduct;
  newProduct: ComparisonCardProduct;
  newScore: number | null | undefined;
}

export default function ComparisonCard({ oldProduct, newProduct, newScore }: ComparisonCardProps) {
  return (
    <View style={styles.comparisonCard}>
      <View style={styles.comparisonProduct}>
        <View style={styles.imageStage}>
          {oldProduct.image_url ? (
            <Image source={{ uri: oldProduct.image_url }} style={styles.comparisonImage} />
          ) : (
            <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
          )}
        </View>
        <Text style={styles.comparisonName} numberOfLines={2}>{oldProduct.brand}</Text>
      </View>

      <View style={styles.comparisonArrowCol}>
        <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} />
        {/* Score badge centered between products — only new product score */}
        {newScore != null && (
          <View style={[styles.miniScoreBadge, { backgroundColor: `${getScoreColor(newScore)}33` }]}>
            <Text
              style={[styles.miniScoreText, { color: getScoreColor(newScore) }]}
              accessibilityLabel={`${newScore}%`}
            >
              {newScore}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.comparisonProduct}>
        <View style={styles.imageStage}>
          {newProduct.image_url ? (
            <Image source={{ uri: newProduct.image_url }} style={styles.comparisonImage} />
          ) : (
            <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
          )}
        </View>
        <Text style={styles.comparisonName} numberOfLines={2}>{newProduct.brand}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  comparisonProduct: { flex: 1, alignItems: 'center', gap: 6, minHeight: 90 },
  imageStage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonImage: { width: 48, height: 48, borderRadius: 8, resizeMode: 'contain' as const },
  comparisonArrowCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 18,
  },
  comparisonName: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', minHeight: 28 },
  miniScoreBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniScoreText: { fontSize: 10, fontWeight: '700' },
});
