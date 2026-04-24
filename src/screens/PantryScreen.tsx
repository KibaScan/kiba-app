// Kiba — Pantry Screen (M5)
// Main Pantry tab: pet food inventory, diet completeness, filter/sort, remove/restock.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.
// D-155: Empty item handling. D-157: Mixed feeding removal nudge.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  filterItems,
  sortItems,
  shouldShowD157Nudge,
  getDietBannerConfig,
} from '../utils/pantryScreenHelpers';
import type { FilterChip, SortOption } from '../utils/pantryScreenHelpers';
import { PantryCard } from '../components/pantry/PantryCard';
import { FedThisTodaySheet } from '../components/pantry/FedThisTodaySheet';
import { SafeSwitchBanner } from '../components/pantry/SafeSwitchBanner';
import { WetTransitionCard } from '../components/pantry/WetTransitionCard';
import { PantryPetCarousel } from '../components/pantry/list/PantryPetCarousel';
import { PantryFilterChips } from '../components/pantry/list/PantryFilterChips';
import { PantrySortModal } from '../components/pantry/list/PantrySortModal';
import { PantrySharedRemoveModal } from '../components/pantry/list/PantrySharedRemoveModal';
import { PantryNoPetEmpty } from '../components/pantry/list/PantryNoPetEmpty';
import { PantryListEmpty } from '../components/pantry/list/PantryListEmpty';
import { getWetTransition, dismissWetTransition, clearWetTransition } from '../services/wetTransitionStorage';
import type { WetTransitionRecord } from '../utils/wetTransitionHelpers';
import SwipeableRow from '../components/ui/SwipeableRow';
import { canUseSafeSwaps } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import type { PantryCardData } from '../types/pantry';
import type { PantryStackParamList } from '../types/navigation';
import type { Product } from '../types';

// ─── Types ──────────────────────────────────────────────

type Props = NativeStackScreenProps<PantryStackParamList, 'PantryMain'>;

// ─── Component ──────────────────────────────────────────

export default function PantryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // ── Stores ──
  const pets = useActivePetStore(s => s.pets);
  const activePetId = useActivePetStore(s => s.activePetId);
  const setActivePet = useActivePetStore(s => s.setActivePet);
  const activePet = useMemo(() => pets.find(p => p.id === activePetId) ?? null, [pets, activePetId]);

  const items = usePantryStore(s => s.items);
  const dietStatus = usePantryStore(s => s.dietStatus);
  const activeSwitchData = usePantryStore(s => s.activeSwitchData);
  const loading = usePantryStore(s => s.loading);
  const loadPantry = usePantryStore(s => s.loadPantry);
  const removeItem = usePantryStore(s => s.removeItem);
  const restockItem = usePantryStore(s => s.restockItem);
  const logTreat = usePantryStore(s => s.logTreat);

  // ── Local state ──
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeSort, setActiveSort] = useState<SortOption>('default');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [removeSheetItem, setRemoveSheetItem] = useState<PantryCardData | null>(null);
  const [logFeedingItem, setLogFeedingItem] = useState<PantryCardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wetTransition, setWetTransition] = useState<WetTransitionRecord | null>(null);

  // ── Derived data ──
  const filteredItems = useMemo(() => filterItems(items, activeFilter), [items, activeFilter]);
  const displayItems = useMemo(() => sortItems(filteredItems, activeSort), [filteredItems, activeSort]);

  const sections = useMemo(() => {
    if (!activePetId) return [];

    // Base Foods
    const base = displayItems.filter(i => {
      const assignment = i.assignments.find(a => a.pet_id === activePetId);
      return assignment?.feeding_role === 'base';
    });

    // Rotational Wet
    const rotational = displayItems.filter(i => {
      const assignment = i.assignments.find(a => a.pet_id === activePetId);
      return assignment?.feeding_role === 'rotational';
    });

    // Treats & Supplements (catch-all for non role-assigned items)
    const treats = displayItems.filter(i => {
      const assignment = i.assignments.find(a => a.pet_id === activePetId);
      return !assignment?.feeding_role; // null/undefined -> treat/supplement
    });

    const res = [];
    if (base.length > 0) res.push({ title: 'Base Diet', data: base, type: 'base' });
    if (rotational.length > 0) res.push({ title: 'Rotational Foods', data: rotational, type: 'rotational' });
    if (treats.length > 0) res.push({ title: 'Treats & Supplements', data: treats, type: 'treats' });

    return res;
  }, [displayItems, activePetId]);

  const bannerConfig = useMemo(() => getDietBannerConfig(dietStatus), [dietStatus]);
  const recalledItems = useMemo(() => items.filter(i => i.product?.is_recalled), [items]);
  const hasMultiplePets = pets.length > 1;
  /** M9 Phase B: pantry item anchoring the active Safe Switch — locked from swipe/removal. */
  const lockedItemId = activeSwitchData?.switch.pantry_item_id ?? null;

  // ── Lifecycle ──
  useFocusEffect(
    useCallback(() => {
      if (!activePetId) return;
      let cancelled = false;
      // loadPantry now owns items + dietStatus + activeSwitchData (with per-pet
      // cache + stale-while-revalidate). Once it resolves, reconcile the wet
      // transition card against the authoritative safe-switch state.
      loadPantry(activePetId).then(async () => {
        if (cancelled) return;
        const hasSwitch = !!usePantryStore.getState().activeSwitchData;
        if (hasSwitch) {
          // Mutual exclusion: clear stale wet transition when Safe Switch is active
          await clearWetTransition(activePetId);
          if (!cancelled) setWetTransition(null);
        } else {
          const wt = await getWetTransition(activePetId);
          if (!cancelled) setWetTransition(wt);
        }
      });
      return () => { cancelled = true; };
    }, [activePetId, loadPantry]),
  );

  // ── Handlers ──
  const handleRefresh = useCallback(async () => {
    if (!activePetId) return;
    setRefreshing(true);
    await loadPantry(activePetId);
    setRefreshing(false);
  }, [activePetId, loadPantry]);

  const handleTap = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item?.product?.is_recalled) {
      navigation.navigate('RecallDetail', { productId: item.product_id });
    } else {
      navigation.navigate('EditPantryItem', { itemId });
    }
  }, [navigation, items]);

  const checkD157Nudge = useCallback((removedItem: PantryCardData) => {
    const remaining = items.filter(i => i.id !== removedItem.id);
    if (activePetId && shouldShowD157Nudge(removedItem, remaining, activePetId)) {
      const petName = activePet?.name ?? 'Your pet';
      Alert.alert('Intake Changed', `${petName}'s daily intake from pantry items has changed.`);
    }
  }, [items, activePetId, activePet]);

  const handleGaveTreat = useCallback(async (itemId: string) => {
    if (!activePetId) return;
    await logTreat(itemId, activePetId);
  }, [activePetId, logTreat]);

  const handleRestock = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await restockItem(item.id);
    Alert.alert('Restocked', `${item.product.name} restocked.`);
  }, [items, restockItem]);

  const handleRemove = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (item.assignments.length > 1) {
      setRemoveSheetItem(item);
      return;
    }

    Alert.alert(
      'Remove Item',
      `Remove ${item.product.name} from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await removeItem(item.id);
            checkD157Nudge(item);
          },
        },
      ],
    );
  }, [items, removeItem, checkD157Nudge]);

  const handleSharedRemoveAll = useCallback(async () => {
    if (!removeSheetItem) return;
    const item = removeSheetItem;
    setRemoveSheetItem(null);
    await removeItem(item.id);
    checkD157Nudge(item);
  }, [removeSheetItem, removeItem, checkD157Nudge]);

  const handleSharedRemovePetOnly = useCallback(async () => {
    if (!removeSheetItem || !activePetId) return;
    const item = removeSheetItem;
    setRemoveSheetItem(null);
    await removeItem(item.id, activePetId);
    checkD157Nudge(item);
  }, [removeSheetItem, activePetId, removeItem, checkD157Nudge]);

  const handlePetSwitch = useCallback((petId: string) => {
    setActivePet(petId);
    setActiveFilter('all');
    setActiveSort('default');
    setBannerDismissed(false);
  }, [setActivePet]);

  // ── No pet empty state ──
  if (!activePet) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Pantry</Text>
        </View>
        <PantryNoPetEmpty
          onAddPet={() => (navigation.getParent() as any)?.navigate('Me', {
            screen: 'CreatePet', params: { species: 'dog' },
          })}
        />
      </View>
    );
  }

  // ── Loading (first load, no cached items) ──
  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Pantry</Text>
        </View>
        <View style={styles.emptyCenter}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  // ── Main screen ──
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Pantry</Text>
          {activePet.feeding_style === 'custom' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('CustomFeedingStyle', { petId: activePet.id })}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ marginLeft: Spacing.sm }}
            >
              <Ionicons name="pie-chart-outline" size={22} color={Colors.accent} />
            </TouchableOpacity>
          )}
          {!hasMultiplePets && (
            <View style={styles.headerPet}>
              <View style={styles.headerAvatar}>
                {activePet.photo_url ? (
                  <Image source={{ uri: activePet.photo_url }} style={styles.headerPhoto} />
                ) : (
                  <Ionicons name="paw-outline" size={16} color={Colors.accent} />
                )}
              </View>
              <Text style={styles.headerPetName} numberOfLines={1}>{activePet.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Pet switcher */}
      {hasMultiplePets && (
        <PantryPetCarousel
          pets={pets}
          activePetId={activePetId}
          onSelect={handlePetSwitch}
        />
      )}

      {/* Recall alert banner — D-125: always free, top priority */}
      {recalledItems.length > 0 && (
        <TouchableOpacity
          style={styles.recallBanner}
          onPress={() => setActiveFilter('recalled')}
          activeOpacity={0.7}
        >
          <View style={{ marginTop: 2 }}>
            <Ionicons name="warning-outline" size={16} color={Colors.severityRed} />
          </View>
          <Text style={styles.recallBannerText}>
            Recall Alert: {recalledItems.length} product{recalledItems.length > 1 ? 's' : ''} in {activePet.name}'s pantry {recalledItems.length > 1 ? 'have' : 'has'} been recalled. Tap to review.
          </Text>
        </TouchableOpacity>
      )}

      {/* Diet completeness banner */}
      {bannerConfig && !(bannerConfig.dismissible && bannerDismissed) && (
        <View style={[
          styles.banner,
          { backgroundColor: `${bannerConfig.color}15`, borderLeftColor: bannerConfig.color },
        ]}>
          <View style={{ marginTop: 2 }}>
            <Ionicons name={bannerConfig.dismissible ? 'information-circle-outline' : 'warning-outline'} size={16} color={bannerConfig.color} />
          </View>
          <Text style={[styles.bannerText, { color: bannerConfig.color, flex: 1 }]}>
            {bannerConfig.message}
          </Text>
          {bannerConfig.dismissible && (
            <TouchableOpacity onPress={() => setBannerDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={bannerConfig.color} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Safe Switch banner (M7) */}
      {activeSwitchData && (
        <SafeSwitchBanner
          data={activeSwitchData}
          onPress={() => navigation.navigate('SafeSwitchDetail', { switchId: activeSwitchData.switch.id })}
        />
      )}

      {/* Wet transition guide (V2-3) */}
      {!activeSwitchData && wetTransition && (
        <WetTransitionCard
          record={wetTransition}
          onDismiss={() => {
            dismissWetTransition(activePetId!).then(() => setWetTransition(null));
          }}
        />
      )}

      {/* Filter / sort bar */}
      <PantryFilterChips
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        activeSort={activeSort}
        onOpenSort={() => setSortModalVisible(true)}
      />

      {/* Item list */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          // M9 Phase B: items anchoring an active Safe Switch are locked —
          // no swipe actions, no "Find a replacement", with a visual badge.
          const locked = item.id === lockedItemId;
          return (
            <SwipeableRow
              onDelete={locked ? undefined : () => handleRemove(item.id)}
              onEdit={locked ? undefined : () => handleTap(item.id)}
            >
              <PantryCard
                item={item}
                activePet={activePet}
                onTap={handleTap}
                onRestock={handleRestock}
                onRemove={handleRemove}
                onGaveTreat={handleGaveTreat}
                onLogFeeding={(i) => setLogFeedingItem(i)}
                isLocked={locked}
                isPremiumUser={canUseSafeSwaps()}
                onReplaceFood={activePet.feeding_style !== 'custom' ? (productId) => {
                  if (!canUseSafeSwaps()) {
                    (navigation.getParent() as any)?.navigate('Paywall', { trigger: 'safe_swap', petName: activePet?.name });
                    return;
                  }
                  navigation.navigate('Result', {
                    productId,
                    petId: activePetId,
                    pantryItemIdHint: item.id,
                  });
                } : undefined}
              />
            </SwipeableRow>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          displayItems.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <PantryListEmpty
            hasItems={items.length > 0}
            activeFilter={activeFilter}
            petName={activePet.name}
            onScanPress={() => (navigation.getParent() as any)?.navigate('Scan')}
          />
        }
      />

      {/* Sort modal */}
      <PantrySortModal
        visible={sortModalVisible}
        activeSort={activeSort}
        onSelect={setActiveSort}
        onClose={() => setSortModalVisible(false)}
      />

      {/* Shared remove modal */}
      <PantrySharedRemoveModal
        item={removeSheetItem}
        petName={activePet.name}
        onRemoveAll={handleSharedRemoveAll}
        onRemovePetOnly={handleSharedRemovePetOnly}
        onCancel={() => setRemoveSheetItem(null)}
      />

      {/* Fed This Today Sheet */}
      <FedThisTodaySheet
        isVisible={logFeedingItem !== null}
        petId={activePetId}
        pantryItem={logFeedingItem}
        assignment={
          logFeedingItem && activePet
            ? logFeedingItem.assignments.find(a => a.pet_id === activePet.id) ?? null
            : null
        }
        product={logFeedingItem?.product as unknown as Product}
        onDismiss={() => setLogFeedingItem(null)}
        onSuccess={() => {
          setLogFeedingItem(null);
          if (activePetId) {
             loadPantry(activePetId);
          }
        }}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  sectionHeaderText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
    paddingBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  headerPet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerPetName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    maxWidth: 100,
  },

  // Recall banner
  recallBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    backgroundColor: `${Colors.severityRed}15`,
  },
  recallBannerText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.severityRed,
    lineHeight: 18,
  },

  // Diet banner
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  bannerText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 88,
    gap: Spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // Loading empty center (spinner)
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
});
