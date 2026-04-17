// TopPickRankRow — Leaderboard row (#2-#20) for CategoryTopPicksScreen.
// Prominent rank badge + product image + brand/name + single insight + score pill.
// Matte Premium card anatomy. D-094: "X% match" framing (score pill).

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import type { TopPickEntry, InsightBullet } from '../../types/categoryBrowse';

interface TopPickRankRowProps {
  pick: TopPickEntry;
  rank: number;
  petName: string;
  insight: InsightBullet | null;
  onPress: () => void;
}

export function TopPickRankRow({ pick, rank, petName, insight, onPress }: TopPickRankRowProps) {
  const scoreColor = pick.final_score != null
    ? getScoreColor(pick.final_score, pick.is_supplemental)
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={
        pick.final_score != null
          ? `${pick.product_name}, rank ${rank}, ${pick.final_score}% match for ${petName}`
          : `${pick.product_name}, rank ${rank}`
      }
    >
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>

      <View style={styles.imageStage}>
        {pick.image_url ? (
          <Image source={{ uri: pick.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="cube-outline" size={22} color={Colors.textTertiary} />
          </View>
        )}
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.brand} numberOfLines={1}>{sanitizeBrand(pick.brand)}</Text>
        <Text style={styles.name} numberOfLines={2}>{stripBrandFromName(pick.brand, pick.product_name)}</Text>
        {insight && (
          <View style={styles.insightRow}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.accent} />
            <Text style={styles.insightText} numberOfLines={1}>{insight.text}</Text>
          </View>
        )}
      </View>

      {pick.final_score != null && scoreColor && (
        <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{pick.final_score}% match</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  rankBadge: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  imageStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
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
    lineHeight: 18,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  insightText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  scorePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
