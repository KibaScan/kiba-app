// Kiba — Home Dashboard
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { supabase } from '../services/supabase';
import type { HomeStackParamList } from '../types/navigation';
import type { Product } from '../types';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const weeklyCount = useScanStore((s) => s.weeklyCount);
  const addToScanCache = useScanStore((s) => s.addToScanCache);
  const activePet = pets.find((p) => p.id === activePetId);
  const [devLoading, setDevLoading] = useState(false);

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
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyCount}>{weeklyCount}</Text>
          <Text style={styles.weeklyLabel}>Scans this week</Text>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={48} color={Colors.textTertiary} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.emptyTitle}>Scan your first product</Text>
          <Text style={styles.emptySubtitle}>
            Tap the scan button below to check{'\n'}a pet food, treat, or supplement.
          </Text>
        </View>

        {/* DEV-ONLY: Test Result Screen — delete before M2 */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devButton}
            disabled={devLoading}
            onPress={async () => {
              const TEST_PRODUCT_ID = 'afd04040-425b-5742-9100-9e370c1c3cc9';
              setDevLoading(true);
              try {
                const { data, error } = await supabase
                  .from('products')
                  .select('*')
                  .eq('id', TEST_PRODUCT_ID)
                  .single();
                if (error || !data) {
                  Alert.alert('DEV Error', error?.message ?? 'Product not found');
                  return;
                }
                addToScanCache(data as Product);
                navigation.navigate('Result', { productId: TEST_PRODUCT_ID, petId: activePetId });
              } catch (e: unknown) {
                Alert.alert('DEV Error', e instanceof Error ? e.message : 'Unknown error');
              } finally {
                setDevLoading(false);
              }
            }}
          >
            <Text style={styles.devBadge}>DEV</Text>
            <Text style={styles.devButtonText}>
              {devLoading ? 'Loading...' : 'Test Result Screen'}
            </Text>
          </TouchableOpacity>
        )}
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

  // DEV-ONLY — delete before M2
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FF3B30',
    borderRadius: 10,
    marginBottom: Spacing.lg,
  },
  devBadge: {
    fontSize: FontSizes.xs,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  devButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
