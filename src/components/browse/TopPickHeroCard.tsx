// TopPickHeroCard — Crown Jewel for CategoryTopPicksScreen.
// Featured Action Card anatomy — cardSurface bg, accent-tint border, circular score badge,
// "Best overall match for {Pet}" trophy badge, up to 3 insight bullets.
// D-094: suitability framing. D-095: UPVM compliance.
//
// Score display note: uses a lightweight circular score badge, NOT the full ScoreRing.
// ScoreRing requires petPhotoUri + species (pet profile context), which the browse layer
// doesn't pass down. Matches Gemini V2 mockup (compact ring, no pet photo in center).

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import type { TopPickEntry, InsightBullet } from '../../types/categoryBrowse';

interface TopPickHeroCardProps {
  pick: TopPickEntry;
  petName: string;
  insights: InsightBullet[];
  onPress: () => void;
}

export function TopPickHeroCard({ pick, petName, insights, onPress }: TopPickHeroCardProps) {
  const scoreColor = pick.final_score != null
    ? getScoreColor(pick.final_score, pick.is_supplemental)
    : Colors.textTertiary;

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: scoreColor }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${pick.product_name}, best overall match`}
    >
      <View style={styles.accentBadge}>
        <Ionicons name="trophy" size={14} color={scoreColor} />
        <Text style={[styles.accentBadgeText, { color: scoreColor }]}>
          Best overall match for {petName}
        </Text>
      </View>

      <View style={styles.topRow}>
        <View style={styles.imageStage}>
          {pick.image_url ? (
            <Image source={{ uri: pick.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="cube-outline" size={40} color={Colors.textTertiary} />
            </View>
          )}
        </View>

        {pick.final_score != null && (
          <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}1A` }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {pick.final_score}%
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.brand} numberOfLines={1}>{sanitizeBrand(pick.brand)}</Text>
      <Text style={styles.name} numberOfLines={2}>{stripBrandFromName(pick.brand, pick.product_name)}</Text>

      {insights.length > 0 && (
        <View style={styles.insightsList}>
          {insights.slice(0, 3).map((b) => (
            <View key={b.kind} style={styles.insightRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
              <Text style={styles.insightText}>{b.text}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 2,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  accentBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.chipSurface,
    borderRadius: 12,
  },
  accentBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  imageStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  scoreBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  brand: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  insightsList: {
    gap: 6,
    marginTop: 4,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
});
