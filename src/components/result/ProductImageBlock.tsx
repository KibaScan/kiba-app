// ProductImageBlock — product hero image with gradient fades (D-093).
// Pure presentational: receives imageUrl, renders image + gradient overlays.
// No score, no bypass — safe to extract.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../utils/constants';

interface Props {
  imageUrl: string;
}

export function ProductImageBlock({ imageUrl }: Props) {
  return (
    <View style={styles.productImageContainer}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.productImage}
        resizeMode="contain"
      />
      <LinearGradient
        colors={['transparent', Colors.background]}
        style={styles.imageGradientBottom}
      />
      <LinearGradient
        colors={[Colors.background, 'transparent', 'transparent', Colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.imageGradientSides}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  productImageContainer: {
    width: '100%',
    height: 200,
    marginBottom: 16,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  imageGradientSides: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
