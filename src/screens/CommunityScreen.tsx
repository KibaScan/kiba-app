// Kiba — Community Tab (M9, Task 20)
// Real shell layout per spec §3:
//   XPRibbon  ·  FeaturedRecipeHero (placeholder)  ·  RecallBanner
//   DiscoveryGrid (placeholder)  ·  BlogCarousel (placeholder)  ·  SubredditFooter
//
// XPRibbon respects D-070 (subtle, not hero). Zero emoji per D-084 — Ionicons.
// FeaturedRecipeHero / DiscoveryGrid / BlogCarousel are inert placeholders;
// Tasks 25 / 30 / 26 will replace them.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { XPRibbon } from '../components/community/XPRibbon';
import { RecallBanner } from '../components/community/RecallBanner';
import { SubredditFooter } from '../components/community/SubredditFooter';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <XPRibbon />

        {/* FeaturedRecipeHero — Task 25 */}
        <View style={{ height: 0 }} />

        <RecallBanner />

        {/* DiscoveryGrid — Task 30 */}
        <View style={{ height: 0 }} />

        {/* BlogCarousel — Task 26 */}
        <View style={{ height: 0 }} />

        <SubredditFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 88,
  },
});
