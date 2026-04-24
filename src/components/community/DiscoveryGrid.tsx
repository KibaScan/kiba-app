// Kiba — M9 Community DiscoveryGrid (Task 30)
// 2x2 tile grid mounted in CommunityScreen between RecallBanner and
// BlogCarousel. Each tile is its own component (own fetch + nav logic):
//
//   [ToxicDatabaseTile]       [VendorDirectoryTile]
//   [KibaIndexHighlightsTile] [SafetyFlagsTile]
//
// 3 tiles navigate (CommunityStack); KibaIndexHighlightsTile is a
// self-contained mini preview (no destination route in the current MVP).
// D-084: Ionicons only.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { ToxicDatabaseTile } from './tiles/ToxicDatabaseTile';
import { VendorDirectoryTile } from './tiles/VendorDirectoryTile';
import { KibaIndexHighlightsTile } from './tiles/KibaIndexHighlightsTile';
import { SafetyFlagsTile } from './tiles/SafetyFlagsTile';

export function DiscoveryGrid() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discover</Text>
      <View style={styles.grid}>
        <ToxicDatabaseTile />
        <VendorDirectoryTile />
        <KibaIndexHighlightsTile />
        <SafetyFlagsTile />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
