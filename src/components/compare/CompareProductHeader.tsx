// CompareProductHeader — Product card displayed in the two-column header row.
// Pure presentational component. Props provided by CompareScreen (state stays in parent).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreRing } from '../scoring/ScoreRing';
import { Colors, FontSizes, Spacing, getVerdictLabel } from '../../utils/constants';
import { stripBrandFromName } from '../../utils/formatters';
import type { Product } from '../../types';

type Props = {
  product: Product;
  score: number;
  petName: string;
  species: 'dog' | 'cat';
  isPartial: boolean;
};

export function CompareProductHeader({ product, score, petName, species, isPartial }: Props) {
  const firstName = petName === 'your pet' ? null : petName.split(' ')[0];
  return (
    <View style={ss.productCard}>
      <View style={ss.productImageStage}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={ss.productImage} resizeMode="contain" />
        ) : (
          <Ionicons name="cube-outline" size={32} color={Colors.textTertiary} />
        )}
      </View>
      <Text style={ss.productBrand} numberOfLines={1}>{product.brand}</Text>
      <Text style={ss.productName} numberOfLines={2}>
        {stripBrandFromName(product.brand, product.name)}
      </Text>
      <View style={ss.scoreRingWrapper}>
        <ScoreRing
          score={score}
          petName={petName}
          petPhotoUri={null}
          species={species}
          isPartialScore={isPartial}
          size="small"
        />
      </View>
      {/* D-168: CompareScreen is a dense surface — verdict label here, full phrase in ScoreRing's accessibilityLabel. */}
      <Text style={ss.matchLabel}>{getVerdictLabel(score, firstName)}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  productCard: {
    flex: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    alignItems: 'center',
  },
  productImageStage: {
    width: '100%',
    height: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBrand: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    minHeight: 36,
  },
  scoreRingWrapper: {
    marginBottom: Spacing.xs,
  },
  matchLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
