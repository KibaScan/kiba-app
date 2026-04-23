// FedThisTodayActionCard — Featured Action Card for EditPantryItemScreen.
// Prominent accent-color CTA for as_needed + active + non-recalled items.
// Closes the second entry-point gap for topper / rotational items whose
// PantryCard Log feeding button is one screen away.
// See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md §3b.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';

interface Props {
  onPress: () => void;
}

export function FedThisTodayActionCard({ onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.fedTodayCard}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Log a feeding to deduct inventory"
    >
      <View style={styles.fedTodayIconBox}>
        <Ionicons name="restaurant-outline" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.fedTodayTextContainer}>
        <Text style={styles.fedTodayTitle}>Fed This Today</Text>
        <Text style={styles.fedTodaySubtitle}>
          Log a feeding to deduct inventory
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fedTodayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  fedTodayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  fedTodayTextContainer: {
    flex: 1,
  },
  fedTodayTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fedTodaySubtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
