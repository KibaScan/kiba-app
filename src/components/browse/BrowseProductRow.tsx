// BrowseProductRow — single product result in category browse.
// Shows image, brand, name, and score ring (or chevron for unscored).
// D-094: score framing. D-084: Ionicons only.

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import type { BrowseProduct } from '../../types/categoryBrowse';

interface Props {
  product: BrowseProduct;
  rank: number;
  petName: string;
  onPress: () => void;
}

function stripBrandPrefix(name: string, brand: string): string {
  if (!brand || !name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  const stripped = name.slice(brand.length).replace(/^[\s\-–—:]+/, '');
  return stripped || name;
}

export function BrowseProductRow({ product, rank, petName, onPress }: Props) {
  const hasScore = product.final_score !== null;
  const score = product.final_score ?? 0;
  const scoreColor = hasScore ? getScoreColor(score, product.is_supplemental) : Colors.textTertiary;
  const displayName = stripBrandPrefix(product.product_name, product.brand);
  const a11yLabel = hasScore
    ? `${product.brand || 'Unknown Brand'} ${displayName}, ${score}% match for ${petName}`
    : `${product.brand || 'Unknown Brand'} ${displayName}, no score yet`;

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityLabel={a11yLabel}>
      {({ pressed }) => (
        <>
          {/* Rank */}
          <Text style={styles.rank}>
            {rank}
          </Text>

          {/* Thumbnail */}
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name={product.is_vet_diet ? 'medkit-outline' : 'nutrition-outline'}
                size={18}
                color={Colors.textTertiary}
              />
            </View>
          )}

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand || 'Unknown Brand'}
            </Text>
            <Text style={styles.name} numberOfLines={2}>
              {displayName}
            </Text>
          </View>

          {/* Score pill or chevron */}
          {hasScore ? (
            <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
              <Text style={[styles.scorePillText, { color: scoreColor }]}>{score}%</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          )}

          {/* Press feedback overlay */}
          {pressed && (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.pressOverlay }]}
              pointerEvents="none"
            />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  rank: {
    width: 24,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
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
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
});
