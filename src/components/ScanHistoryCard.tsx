// Compact card for recent scan history entries.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS, getScoreColor } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import { formatRelativeTime } from '../utils/formatters';
import type { ScanHistoryItem } from '../types/scanHistory';

interface ScanHistoryCardProps {
  item: ScanHistoryItem;
  petName: string;
  onPress: (productId: string) => void;
}

export function ScanHistoryCard({ item, petName, onPress }: ScanHistoryCardProps) {
  const { product } = item;
  const displayName = stripBrandFromName(product.brand, product.name);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item.product_id)}
      activeOpacity={0.7}
    >
      {/* Product image */}
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
        </View>
      )}

      {/* Center: brand + name */}
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {/* Right: score + time */}
      <View style={styles.trailing}>
        <ScoreBadge
          score={item.final_score}
          isRecalled={product.is_recalled}
          isVetDiet={product.is_vet_diet}
          isSupplemental={product.is_supplemental}
          petName={petName}
        />
        <Text style={styles.time}>{formatRelativeTime(item.scanned_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Score Badge (matches PantryCard pattern) ────────────

function ScoreBadge({
  score,
  isRecalled,
  isVetDiet,
  isSupplemental,
  petName,
}: {
  score: number | null;
  isRecalled: boolean;
  isVetDiet: boolean;
  isSupplemental: boolean;
  petName: string;
}) {
  if (isRecalled) {
    return (
      <View style={[styles.badge, { backgroundColor: `${SEVERITY_COLORS.danger}1F` }]}>
        <Text style={[styles.badgeText, { color: SEVERITY_COLORS.danger }]}>Recalled</Text>
      </View>
    );
  }

  if (isVetDiet) {
    return (
      <View style={[styles.badge, { backgroundColor: '#6366F11F' }]}>
        <Text style={[styles.badgeText, { color: '#6366F1' }]}>Vet Diet</Text>
      </View>
    );
  }

  if (score == null) {
    return (
      <View style={[styles.badge, { backgroundColor: `${SEVERITY_COLORS.neutral}1F` }]}>
        <Text style={[styles.badgeText, { color: SEVERITY_COLORS.neutral }]}>No score</Text>
      </View>
    );
  }

  const color = getScoreColor(score, isSupplemental);
  return (
    <Text style={[styles.scoreText, { color }]}>
      {score}% match for {petName}
    </Text>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  time: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
});
