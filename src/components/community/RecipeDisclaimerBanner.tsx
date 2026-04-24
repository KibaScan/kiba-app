// Kiba — M9 Community RecipeDisclaimerBanner (Task 24 + Task 25)
// Static AAFCO / veterinarian disclaimer per spec §15.1. Rendered on the submit
// form AND on the detail screen (top and bottom). Single source of truth so we
// can't drift between surfaces.
// D-095 UPVM compliance — clinical tone, no prescriptive language.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

export const RECIPE_DISCLAIMER_TEXT =
  'Community recipe. Not veterinarian-reviewed. Not a complete-and-balanced AAFCO diet — feed as an occasional supplement only, not as your pet’s primary food. Consult your veterinarian before making dietary changes.';

export function RecipeDisclaimerBanner() {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons
        name="information-circle-outline"
        size={18}
        color={Colors.severityAmber}
        style={styles.icon}
      />
      <Text style={styles.text}>{RECIPE_DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.severityAmberTint,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
