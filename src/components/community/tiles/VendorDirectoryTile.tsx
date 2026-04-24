// Kiba — M9 Community VendorDirectoryTile (Task 30)
// One of four tiles in the DiscoveryGrid 2x2. Static affordance — taps
// navigate to VendorDirectory (Task 22). D-084: Ionicons only.

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import type { CommunityStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function VendorDirectoryTile() {
  const navigation = useNavigation<Nav>();

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => navigation.navigate('VendorDirectory')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Vendor Directory. Brand contacts."
    >
      <View style={styles.iconWrap}>
        <Ionicons name="business-outline" size={20} color={Colors.accent} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        Vendor Directory
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        Brand contacts
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
    backgroundColor: Colors.accentTint,
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
