// Kiba — Pantry Screen (M5)
// Main Pantry tab: pet food inventory, diet completeness, filter/sort, remove/restock.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.
// D-155: Empty item handling. D-157: Mixed feeding removal nudge.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  SectionList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../utils/constants';
import { PantryCard } from '../components/pantry/PantryCard';
import { FedThisTodaySheet } from '../components/pantry/FedThisTodaySheet';
import { SafeSwitchBanner } from '../components/pantry/SafeSwitchBanner';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getActiveSwitchForPet } from '../services/safeSwitchService';
import type { PantryCardData, DietCompletenessResult } from '../types/pantry';
import type { SafeSwitchCardData } from '../types/safeSwitch';
import type { PantryStackParamList } from '../types/navigation';
import type { Product } from '../types';

// ─── Types ──────────────────────────────────────────────

export type FilterChip = 'all' | 'dry' | 'wet' | 'treats' | 'supplemental' | 'recalled' | 'running_low';
export type SortOption = 'default' | 'name' | 'score' | 'days_remaining';

type Props = NativeStackScreenProps<PantryStackParamList, 'PantryMain'>;

// ─── Exported Helpers (pure, testable) ──────────────────

export function filterItems(items: PantryCardData[], filter: FilterChip): PantryCardData[] {
  switch (filter) {
    case 'all': return items;
    case 'dry': return items.filter(i => i.product.product_form === 'dry');
    case 'wet': return items.filter(i => i.product.product_form === 'wet');
    case 'treats': return items.filter(i => i.product.category === 'treat');
    case 'supplemental': return items.filter(i => i.product.is_supplemental);
    case 'recalled': return items.filter(i => i.product.is_recalled);
    case 'running_low': return items.filter(i => i.is_low_stock && !i.is_empty);
  }
}

export function sortItems(items: PantryCardData[], sort: SortOption): PantryCardData[] {
  if (sort === 'default') return items;
  const sorted = [...items];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.product.name.localeCompare(b.product.name));
    case 'score':
      return sorted.sort((a, b) => (b.resolved_score ?? -1) - (a.resolved_score ?? -1));
    case 'days_remaining':
      return sorted.sort((a, b) => (a.days_remaining ?? Infinity) - (b.days_remaining ?? Infinity));
  }
}

export function shouldShowD157Nudge(
  removedItem: PantryCardData,
  remainingItems: PantryCardData[],
  petId: string,
): boolean {
  if (removedItem.product.category !== 'daily_food') return false;
  const removedAssignment = removedItem.assignments.find(a => a.pet_id === petId);
  if (!removedAssignment || removedAssignment.feeding_frequency !== 'daily') return false;
  return remainingItems.some(
    item => item.product.category === 'daily_food'
      && item.assignments.some(a => a.pet_id === petId && a.feeding_frequency === 'daily'),
  );
}

export function getDietBannerConfig(
  dietStatus: DietCompletenessResult | null,
): { show: boolean; color: string; message: string } | null {
  if (!dietStatus) return null;
  if (dietStatus.status === 'complete' || dietStatus.status === 'empty') return null;
  if (dietStatus.status === 'amber_warning') {
    return { show: true, color: Colors.severityAmber, message: dietStatus.message ?? '' };
  }
  if (dietStatus.status === 'red_warning') {
    return { show: true, color: Colors.severityRed, message: dietStatus.message ?? '' };
  }
  return null;
}

// ─── Filter Chip Config ─────────────────────────────────

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dry', label: 'Dry' },
  { key: 'wet', label: 'Wet' },
  { key: 'treats', label: 'Treats' },
  { key: 'supplemental', label: 'Supplemental' },
  { key: 'recalled', label: 'Recalled' },
  { key: 'running_low', label: 'Running Low' },
];

function getChipAccentColor(chip: FilterChip): string {
  switch (chip) {
    case 'supplemental': return '#14B8A6';
    case 'recalled': return Colors.severityRed;
    case 'running_low': return Colors.severityAmber;
    default: return Colors.accent;
  }
}

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'name', label: 'Name (A\u2013Z)' },
  { key: 'score', label: 'Score (high to low)' },
  { key: 'days_remaining', label: 'Days remaining (urgent first)' },
];

const FILTER_LABEL_MAP: Record<FilterChip, string> = {
  all: '', dry: 'dry', wet: 'wet', treats: 'treat',
  supplemental: 'supplemental', recalled: 'recalled', running_low: 'low stock',
};

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
  const loading = usePantryStore(s => s.loading);
  const loadPantry = usePantryStore(s => s.loadPantry);
  const removeItem = usePantryStore(s => s.removeItem);
  const restockItem = usePantryStore(s => s.restockItem);
  const logTreat = usePantryStore(s => s.logTreat);

  // ── Local state ──
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('default');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [removeSheetItem, setRemoveSheetItem] = useState<PantryCardData | null>(null);
  const [logFeedingItem, setLogFeedingItem] = useState<PantryCardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSwitchData, setActiveSwitchData] = useState<SafeSwitchCardData | null>(null);

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
      loadPantry(activePetId).then(() => { if (cancelled) return; });
      // Load active safe switch
      getActiveSwitchForPet(activePetId).then(data => {
        if (!cancelled) setActiveSwitchData(data);
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
  }, [setActivePet]);

  // ── No pet empty state ──
  if (!activePet) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Pantry</Text>
        </View>
        <View style={styles.emptyCenter}>
          <View style={styles.emptyIconPlatter}>
            <Ionicons name="paw-outline" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No pet profile yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a pet profile to start{'\n'}building their pantry
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => (navigation.getParent() as any)?.navigate('Me', {
              screen: 'CreatePet', params: { species: 'dog' },
            })}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>Add Your Pet</Text>
          </TouchableOpacity>
        </View>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          style={styles.carousel}
        >
          {pets.map(pet => {
            const isActive = pet.id === activePetId;
            return (
              <TouchableOpacity
                key={pet.id}
                onPress={() => !isActive && handlePetSwitch(pet.id)}
                activeOpacity={0.7}
                style={styles.carouselItem}
              >
                <View style={[
                  styles.carouselAvatar,
                  isActive ? styles.carouselAvatarActive : styles.carouselAvatarInactive,
                ]}>
                  {pet.photo_url ? (
                    <Image
                      source={{ uri: pet.photo_url }}
                      style={[
                        styles.carouselPhoto,
                        isActive ? styles.carouselPhotoActive : styles.carouselPhotoInactive,
                      ]}
                    />
                  ) : (
                    <Ionicons
                      name="paw-outline"
                      size={isActive ? 20 : 16}
                      color={Colors.accent}
                    />
                  )}
                </View>
                <Text
                  style={[styles.carouselName, !isActive && styles.carouselNameInactive]}
                  numberOfLines={1}
                >
                  {pet.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
      {bannerConfig && (
        <View style={[
          styles.banner,
          { backgroundColor: `${bannerConfig.color}15`, borderLeftColor: bannerConfig.color },
        ]}>
          <View style={{ marginTop: 2 }}>
            <Ionicons name="warning-outline" size={16} color={bannerConfig.color} />
          </View>
          <Text style={[styles.bannerText, { color: bannerConfig.color }]}>
            {bannerConfig.message}
          </Text>
        </View>
      )}

      {/* Safe Switch banner (M7) */}
      {activeSwitchData && (
        <SafeSwitchBanner
          data={activeSwitchData}
          onPress={() => navigation.navigate('SafeSwitchDetail', { switchId: activeSwitchData.switch.id })}
        />
      )}

      {/* Filter / sort bar */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContent}
          style={styles.filterChips}
        >
          {FILTER_CHIPS.map(chip => {
            const selected = activeFilter === chip.key;
            const accentColor = getChipAccentColor(chip.key);
            return (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: accentColor }
                    : { backgroundColor: Colors.hairlineBorder },
                ]}
                onPress={() => setActiveFilter(chip.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.chipText,
                  selected
                    ? { color: '#FFFFFF' }
                    : { color: Colors.textSecondary },
                ]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={20}
            color={activeSort !== 'default' ? Colors.accent : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

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
                onFindReplacement={(productId) => {
                  navigation.navigate('Result', {
                    productId,
                    petId: activePetId,
                    pantryItemIdHint: item.id,
                  });
                }}
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
          items.length === 0 ? (
            <View style={styles.emptyCenter}>
              <View style={styles.emptyIconPlatter}>
                <Ionicons name="scan-outline" size={40} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>Pantry is empty</Text>
              <Text style={styles.emptySubtitle}>
                Scan a product to add it to{'\n'}{activePet.name}'s pantry
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => (navigation.getParent() as any)?.navigate('Scan')}
                activeOpacity={0.7}
              >
                <Ionicons name="scan-outline" size={18} color={Colors.accent} />
                <Text style={styles.ctaText}>Scan a Product</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyFilter}>
              <View style={styles.emptyIconPlatter}>
                <Ionicons name="filter-outline" size={40} color={Colors.accent} />
              </View>
              <Text style={styles.emptyFilterText}>
                No {FILTER_LABEL_MAP[activeFilter]} items in pantry
              </Text>
            </View>
          )
        }
      />

      {/* Sort modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalVisible(false)}>
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.modalTitle}>Sort By</Text>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.key}
              style={styles.modalOption}
              onPress={() => { setActiveSort(option.key); setSortModalVisible(false); }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.modalOptionText,
                activeSort === option.key && { color: Colors.accent },
              ]}>
                {option.label}
              </Text>
              {activeSort === option.key && (
                <Ionicons name="checkmark" size={18} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Shared remove modal */}
      <Modal
        visible={removeSheetItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveSheetItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRemoveSheetItem(null)}>
          <BlurView intensity={30} style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.modalTitle}>Remove Item</Text>
          <Text style={styles.modalSubtitle}>
            {removeSheetItem?.product.name} is shared with multiple pets.
          </Text>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={handleSharedRemoveAll}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: SEVERITY_COLORS.danger }]}>
              Remove for all pets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={handleSharedRemovePetOnly}
            activeOpacity={0.7}
          >
            <Text style={styles.modalOptionText}>
              Remove for {activePet.name} only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => setRemoveSheetItem(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalOptionText, { color: Colors.textTertiary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Fed This Today Sheet */}
      <FedThisTodaySheet
        isVisible={logFeedingItem !== null}
        petId={activePetId}
        pantryItem={logFeedingItem}
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

  // Pet carousel
  carousel: {
    flexGrow: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  carouselContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 0,
    paddingBottom: 2,
    gap: 10,
    alignItems: 'center',
  },
  carouselItem: {
    alignItems: 'center',
    width: 52,
  },
  carouselAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    overflow: 'hidden',
  },
  carouselAvatarActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  carouselAvatarInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.6,
  },
  carouselPhoto: {
    borderRadius: 22,
  },
  carouselPhotoActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  carouselPhotoInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  carouselName: {
    fontSize: 10,
    color: Colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  carouselNameInactive: {
    opacity: 0.5,
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

  // Filter / sort bar
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 2,
  },
  filterChips: {
    flex: 1,
  },
  filterChipsContent: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  sortButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.hairlineBorder,
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

  // Empty states
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.accent}15`,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  ctaText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  emptyFilter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  emptyFilterText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  emptyIconPlatter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${Colors.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },

  // Modal (sort + shared remove)
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    opacity: 0.3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  modalSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
  },
  modalOptionText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
});
