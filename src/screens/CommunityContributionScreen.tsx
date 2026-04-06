// Kiba — Community Contribution (Placeholder)
// D-091: Full Level 4 Hybrid flow deferred to M3.
// This screen shows when a scanned UPC is not in the database.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { ScanStackParamList } from '../types/navigation';

type ScreenRoute = RouteProp<ScanStackParamList, 'CommunityContribution'>;
type ScreenNav = NativeStackNavigationProp<ScanStackParamList, 'CommunityContribution'>;

export default function CommunityContributionScreen() {
  const navigation = useNavigation<ScreenNav>();
  const route = useRoute<ScreenRoute>();
  const { scannedUpc } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Not Found</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="search-outline" size={56} color={Colors.textTertiary} />
        </View>

        <Text style={styles.heading}>We don't have this product yet</Text>
        <Text style={styles.body}>
          Community contributions are coming in M3.{'\n'}
          You'll be able to photograph ingredient labels{'\n'}
          and help other pet owners.
        </Text>

        <View style={styles.upcBadge}>
          <Ionicons name="barcode-outline" size={16} color={Colors.textTertiary} />
          <Text style={styles.upcText}>{scannedUpc}</Text>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heading: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.cardSurface,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  upcText: {
    fontSize: FontSizes.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.textTertiary,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    backgroundColor: Colors.accent,
  },
  scanButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
