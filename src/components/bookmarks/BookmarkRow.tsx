// BookmarkRow — list item for BookmarksScreen.
// Colocated sibling of PantryCard / ScanHistoryCard.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { sanitizeBrand, stripBrandFromName } from '../../utils/formatters';
import type { BookmarkCardData } from '../../types/bookmark';

interface BookmarkRowProps {
  card: BookmarkCardData;
  petName: string;
  isLastInSection: boolean;
  onPress: () => void;
}

export default function BookmarkRow({ card, petName, isLastInSection, onPress }: BookmarkRowProps) {
  const isRecalled = card.product.is_recalled;
  const isBypass =
    !isRecalled &&
    (card.product.is_vet_diet || card.product.is_variety_pack || card.final_score == null);
  const scoreColor =
    !isRecalled && !isBypass && card.final_score != null
      ? getScoreColor(card.final_score, card.product.is_supplemental)
      : null;

  const a11yLabel = isRecalled
    ? `${card.product.brand} ${card.product.name}, recalled`
    : scoreColor != null
    ? `${card.final_score}% match for ${petName}, ${card.product.brand} ${card.product.name}`
    : `${card.product.brand} ${card.product.name}${card.product.is_vet_diet ? ', vet diet' : ''}${card.product.is_variety_pack ? ', variety pack' : ''}`;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isRecalled && styles.rowRecalled,
        !isLastInSection && styles.rowDivider,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={a11yLabel}
    >
      {card.product.image_url ? (
        <Image source={{ uri: card.product.image_url }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.brandRow}>
          <Text style={styles.brand} numberOfLines={1}>
            {sanitizeBrand(card.product.brand)}
          </Text>
          {card.product.is_vet_diet && (
            <View style={styles.vetDietChip}>
              <Text style={styles.vetDietChipText}>Vet diet</Text>
            </View>
          )}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {stripBrandFromName(card.product.brand, card.product.name)}
        </Text>
      </View>
      {isRecalled ? (
        <View style={styles.recalledChip}>
          <Text style={styles.recalledChipText}>Recalled</Text>
        </View>
      ) : scoreColor ? (
        <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.pillText, { color: scoreColor }]}>{card.final_score}%</Text>
        </View>
      ) : (
        <View style={styles.bypassChip}>
          <Text style={styles.bypassChipText}>—</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    paddingLeft: Spacing.lg - 3,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  image: { width: 40, height: 40, borderRadius: 8 },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  brand: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  vetDietChip: {
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vetDietChipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  recalledChip: {
    backgroundColor: `${Colors.severityRed}1A`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recalledChipText: {
    color: Colors.severityRed,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  bypassChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bypassChipText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
