// BrowseProductRow — single product result in category browse.
// Shows image, brand, name, and score ring (or chevron for unscored).
// D-094: score framing. D-084: Ionicons only.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import type { BrowseProduct } from '../../types/categoryBrowse';

interface Props {
  product: BrowseProduct;
  rank: number;
  onPress: () => void;
}

function stripBrandPrefix(name: string, brand: string): string {
  if (!brand || !name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  const stripped = name.slice(brand.length).replace(/^[\s\-–—:]+/, '');
  return stripped || name;
}

export function BrowseProductRow({ product, rank, onPress }: Props) {
  const hasScore = product.final_score !== null;
  const score = product.final_score ?? 0;
  const scoreColor = hasScore ? getScoreColor(score, product.is_supplemental) : Colors.textTertiary;
  const displayName = stripBrandPrefix(product.product_name, product.brand);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Rank */}
      <Text style={[styles.rank, rank <= 3 && hasScore ? { color: Colors.accent } : null]}>
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

      {/* Score ring or chevron */}
      {hasScore ? (
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{score}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

const RING_SIZE = 40;

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
  scoreRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
