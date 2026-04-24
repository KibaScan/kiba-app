// Kiba — Community Tab (M9, Task 20 + Task 25 + Task 26)
// Real shell layout per spec §3:
//   XPRibbon  ·  FeaturedRecipeHero  ·  RecallBanner
//   DiscoveryGrid (placeholder)  ·  BlogCarousel  ·  SubredditFooter
//
// XPRibbon respects D-070 (subtle, not hero). Zero emoji per D-084 — Ionicons.
// DiscoveryGrid is still an inert placeholder; Task 30 will replace it.
// BlogCarousel self-fetches and collapses to null on empty/offline.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { XPRibbon } from '../components/community/XPRibbon';
import { RecallBanner } from '../components/community/RecallBanner';
import { SubredditFooter } from '../components/community/SubredditFooter';
import { FeaturedRecipeHero } from '../components/community/FeaturedRecipeHero';
import { BlogCarousel } from '../components/community/BlogCarousel';

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

        <FeaturedRecipeHero />

        <RecallBanner />

        {/* DiscoveryGrid — Task 30 */}
        <View style={{ height: 0 }} />

        <BlogCarousel />

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
