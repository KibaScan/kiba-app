// Kiba — Category Top Picks Screen
// Showcase "top 20" experience for {category, petId, subFilter}. Hero + Leaderboard + Escape Hatch.
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements routed elsewhere.
// Spec: docs/superpowers/specs/2026-04-15-top-picks-dedicated-screen-design.md

import React, { useEffect } from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import type { HomeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryTopPicks'>;

export default function CategoryTopPicksScreen({ navigation, route }: Props) {
  const { category, petId, subFilter } = route.params;

  useEffect(() => {
    if (!canSearch()) navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.placeholder}>
        Top Picks — {category}
        {subFilter ? ` / ${subFilter}` : ''}
        {'\n'}pet: {petId}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  placeholder: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
});
