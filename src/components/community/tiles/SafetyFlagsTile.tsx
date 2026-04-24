// Kiba — M9 Community SafetyFlagsTile (Task 30)
// One of four tiles in the DiscoveryGrid 2x2. Static affordance — taps
// navigate to SafetyFlags (Task 28). D-084: Ionicons only.

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../../utils/constants';
import type { CommunityStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function SafetyFlagsTile() {
  const navigation = useNavigation<Nav>();

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => navigation.navigate('SafetyFlags')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Safety Flags. Report concerns, see community activity."
    >
      <View style={[styles.iconWrap, { backgroundColor: `${SEVERITY_COLORS.caution}1A` }]}>
        <Ionicons name="flag-outline" size={20} color={SEVERITY_COLORS.caution} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        Safety Flags
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        Report concerns, see community activity
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
