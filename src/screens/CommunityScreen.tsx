// Kiba — Community Tab (Placeholder)
// Teaser sections for upcoming features: Kiba Kitchen, Blog, Kiba Index,
// Symptom Detective, Community Contributions.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Section Data ───────────────────────────────────────

const SECTIONS: readonly {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  description: string;
}[] = [
  {
    title: 'Kiba Kitchen',
    icon: 'restaurant-outline',
    tint: '#F97316',
    description: 'Homemade pet food recipes, scored by our engine. Coming soon.',
  },
  {
    title: 'Pet Health & Nutrition',
    icon: 'newspaper-outline',
    tint: Colors.textSecondary,
    description: 'Expert articles on pet food, health, and nutrition. Coming soon.',
  },
  {
    title: 'Kiba Index',
    icon: 'thumbs-up-outline',
    tint: Colors.severityAmber,
    description:
      'Rate your pet\u2019s food \u2014 Taste Test and Tummy Check ratings from real pet owners. Coming soon.',
  },
  {
    title: 'Symptom Detective',
    icon: 'pulse-outline',
    tint: Colors.severityRed,
    description:
      'Track daily symptoms and detect ingredient sensitivities over time. Coming soon.',
  },
  {
    title: 'Help Grow Kiba',
    icon: 'people-outline',
    tint: Colors.accent,
    description:
      'Scanned a product we don\u2019t have? Your contributions help every pet owner.',
  },
];

// ─── Component ──────────────────────────────────────────

export default function CommunityScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: `${section.tint}15` }]}>
              <Ionicons name={section.icon} size={24} color={section.tint} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardDescription}>{section.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
