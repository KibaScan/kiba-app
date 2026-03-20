// Kiba — Home Dashboard
import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { usePantryStore } from '../stores/usePantryStore';
import type { HomeStackParamList } from '../types/navigation';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const weeklyCount = useScanStore((s) => s.weeklyCount);
  const activePet = pets.find((p) => p.id === activePetId);

  const pantryItems = usePantryStore((s) => s.items);
  const loadPantry = usePantryStore((s) => s.loadPantry);

  const recalledItems = useMemo(
    () => pantryItems.filter(i => i.product?.is_recalled),
    [pantryItems],
  );

  // Load pantry on focus if store doesn't have data for the active pet (recall alerts are safety-critical)
  useFocusEffect(
    useCallback(() => {
      if (!activePetId) return;
      if (usePantryStore.getState()._petId !== activePetId) {
        loadPantry(activePetId);
      }
    }, [activePetId, loadPantry]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kiba</Text>
        {activePet && (
          <View style={styles.petBadgeRow}>
            <Ionicons name="paw-outline" size={14} color={Colors.accent} />
            <Text style={styles.petBadge}>Scanning for {activePet.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Recall alert cards — top priority, D-125: always free */}
        {recalledItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.recallCard}
            onPress={() => navigation.navigate('RecallDetail', { productId: item.product_id })}
            activeOpacity={0.7}
          >
            <Ionicons name="warning-outline" size={20} color={Colors.severityRed} />
            <View style={styles.recallCardContent}>
              <Text style={styles.recallCardTitle}>Recall Alert</Text>
              <Text style={styles.recallCardBody} numberOfLines={2}>
                {item.product.name} has been recalled.{activePet ? ` ${activePet.name} may be affected.` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyCount}>{weeklyCount}</Text>
          <Text style={styles.weeklyLabel}>Scans this week</Text>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={56} color={Colors.textTertiary} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.emptyTitle}>Scan your first product</Text>
          <Text style={styles.emptySubtitle}>
            Tap the scan button below to check{'\n'}a pet food, treat, or supplement.
          </Text>
        </View>

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 1,
  },
  petBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00B4D815',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  petBadge: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  recallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${Colors.severityRed}15`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallCardContent: {
    flex: 1,
  },
  recallCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.severityRed,
    marginBottom: 2,
  },
  recallCardBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  weeklyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  weeklyCount: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  weeklyLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
