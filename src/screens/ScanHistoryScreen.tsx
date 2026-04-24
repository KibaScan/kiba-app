// ScanHistoryScreen — up to 20 deduped recent scans per pet. Immutable (no delete).
// Long-press row → BookmarkToggleSheet.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, getScoreColor } from '../utils/constants';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { getRecentScans } from '../services/scanHistoryService';
import { sanitizeBrand, stripBrandFromName } from '../utils/formatters';
import { BookmarkToggleSheet } from '../components/common/BookmarkToggleSheet';
import { BookmarksFullError, BookmarkOfflineError } from '../types/bookmark';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'ScanHistory'>,
  BottomTabNavigationProp<TabParamList>
>;

type ScanRow = Awaited<ReturnType<typeof getRecentScans>>[number];

export default function ScanHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [longPressTarget, setLongPressTarget] = useState<{ productId: string } | null>(null);

  const toggle = useBookmarkStore((s) => s.toggle);
  const isBookmarked = useBookmarkStore((s) =>
    longPressTarget && activePetId ? s.isBookmarked(activePetId, longPressTarget.productId) : false,
  );

  const refresh = useCallback(async () => {
    if (!activePetId) return;
    setRefreshing(true);
    const rows = await getRecentScans(activePetId, 20);
    setScans(rows);
    setRefreshing(false);
  }, [activePetId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLongPressToggle = async () => {
    if (!activePetId || !longPressTarget) return;
    try {
      await toggle(activePetId, longPressTarget.productId);
    } catch (err) {
      if (err instanceof BookmarksFullError) {
        Alert.alert('Bookmarks full', 'Remove one to save another.');
      } else if (err instanceof BookmarkOfflineError) {
        Alert.alert('Offline', 'Bookmarks can be added once you are back online.');
      }
    }
  };

  if (!activePet) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Select a pet to see history</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.navBar, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Scans</Text>
        <Text style={styles.subtitle}>
          {activePet.name} · {scans.length} recent
        </Text>
      </View>
      {scans.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="barcode-outline"
            size={48}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySubtitle}>Your scan history appears here.</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a product"
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.ctaLabel}>Scan a product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
          renderItem={({ item }) => {
            const scoreColor =
              item.final_score != null
                ? getScoreColor(item.final_score, item.product.is_supplemental)
                : null;
            return (
              <TouchableOpacity
                style={[styles.row, item.product.is_recalled && styles.rowRecalled]}
                onPress={() => {
                  if (item.product.is_recalled) {
                    navigation.navigate('RecallDetail', { productId: item.product_id });
                  } else {
                    navigation.navigate('Result', { productId: item.product_id, petId: activePetId });
                  }
                }}
                onLongPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setLongPressTarget({ productId: item.product_id });
                }}
                delayLongPress={400}
                activeOpacity={0.7}
                accessibilityLabel={
                  item.final_score != null
                    ? `${item.final_score}% match for ${activePet.name}, ${item.product.brand} ${item.product.name}`
                    : `${item.product.brand} ${item.product.name}${item.product.is_recalled ? ', recalled product' : ''}`
                }
              >
                {item.product.image_url ? (
                  <Image source={{ uri: item.product.image_url }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.brand} numberOfLines={1}>
                    {sanitizeBrand(item.product.brand)}
                  </Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {stripBrandFromName(item.product.brand, item.product.name)}
                  </Text>
                </View>
                {scoreColor ? (
                  <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
                    <Text style={[styles.pillText, { color: scoreColor }]}>{item.final_score}%</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
      {longPressTarget && (
        <BookmarkToggleSheet
          visible={longPressTarget !== null}
          onClose={() => setLongPressTarget(null)}
          isBookmarked={isBookmarked}
          onToggle={handleLongPressToggle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  listContent: { paddingBottom: 88 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    paddingLeft: Spacing.lg - 3,
  },
  image: { width: 40, height: 40, borderRadius: 8 },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  brand: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.lg,
  },
  ctaLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
