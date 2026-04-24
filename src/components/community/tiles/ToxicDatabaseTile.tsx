// Kiba — M9 Community ToxicDatabaseTile (Task 30)
// One of four tiles in the DiscoveryGrid 2x2. Static affordance — taps
// navigate to ToxicDatabase (Task 21). D-084: Ionicons only.

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../../utils/constants';
import type { CommunityStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function ToxicDatabaseTile() {
  const navigation = useNavigation<Nav>();

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => navigation.navigate('ToxicDatabase')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Toxic Database. Foods, plants, meds, household risks."
    >
      <View style={[styles.iconWrap, { backgroundColor: `${SEVERITY_COLORS.danger}1A` }]}>
        <Ionicons name="skull-outline" size={20} color={SEVERITY_COLORS.danger} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        Toxic Database
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        Foods, plants, meds, household risks
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
});
