// Kiba — Top Matches Screen (M5, D-055)
// Premium: scored product rankings per pet. Free: paywall placeholder.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, getScoreColor } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useTopMatchesStore } from '../stores/useTopMatchesStore';
import type { CachedScore } from '../services/topMatches';
import type { SearchStackParamList } from '../types/navigation';

// ─── Types ──────────────────────────────────────────────

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchMain'>;
type CategoryFilter = 'daily_food' | 'treat' | 'all';

const CATEGORY_CHIPS: { key: CategoryFilter; label: string }[] = [
  { key: 'daily_food', label: 'Daily Food' },
  { key: 'treat', label: 'Treats' },
  { key: 'all', label: 'All' },
];

const CATEGORY_LABEL_MAP: Record<CategoryFilter, string> = {
  daily_food: 'daily food',
  treat: 'treat',
  all: '',
};

// ─── Component ──────────────────────────────────────────

export default function SearchScreen({ navigation }: Props) {
  const rootNav = useNavigation();

  // ── Stores ──
  const pets = useActivePetStore(s => s.pets);
  const activePetId = useActivePetStore(s => s.activePetId);
  const setActivePet = useActivePetStore(s => s.setActivePet);
  const activePet = useMemo(() => pets.find(p => p.id === activePetId) ?? null, [pets, activePetId]);

  const scores = useTopMatchesStore(s => s.scores);
  const loading = useTopMatchesStore(s => s.loading);
  const refreshing = useTopMatchesStore(s => s.refreshing);
  const error = useTopMatchesStore(s => s.error);
  const categoryFilter = useTopMatchesStore(s => s.categoryFilter);
  const searchQuery = useTopMatchesStore(s => s.searchQuery);
  const loadTopMatches = useTopMatchesStore(s => s.loadTopMatches);
  const setFilter = useTopMatchesStore(s => s.setFilter);
  const setSearch = useTopMatchesStore(s => s.setSearch);

  // ── Local state ──
  const [isPremium] = useState(() => canSearch());

  // ── Derived data ──
  const filteredScores = useMemo(() => {
    if (!searchQuery) return scores;
    const q = searchQuery.toLowerCase();
    return scores.filter(
      s => s.product_name.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q),
    );
  }, [scores, searchQuery]);

  const hasMultiplePets = pets.length > 1;

  // ── Lifecycle ──
  useFocusEffect(
    useCallback(() => {
      if (!activePetId || !canSearch()) return;
      let cancelled = false;
      loadTopMatches(activePetId).then(() => { if (cancelled) return; });
      return () => { cancelled = true; };
    }, [activePetId, loadTopMatches]),
  );

  // ── Handlers ──
  const handlePetSwitch = useCallback((petId: string) => {
    setActivePet(petId);
    setFilter('daily_food');
  }, [setActivePet, setFilter]);

  const handleProductTap = useCallback((item: CachedScore) => {
    navigation.navigate('Result', { productId: item.product_id, petId: activePetId });
  }, [navigation, activePetId]);

  const handlePaywall = useCallback(() => {
    (rootNav as any).navigate('Paywall', { trigger: 'search' });
  }, [rootNav]);

  // ── Free user paywall ──
  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
        </View>
        <View style={styles.content}>
          <TouchableOpacity style={styles.searchBar} onPress={handlePaywall} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.searchPlaceholder}>Search pet food products...</Text>
          </TouchableOpacity>
          <View style={styles.paywallCenter}>
            <Ionicons name="lock-closed" size={32} color={Colors.textTertiary} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.paywallTitle}>Premium Feature</Text>
            <Text style={styles.paywallSubtitle}>
              Top Matches and text search are available{'\n'}with Kiba Premium. Scan barcodes for free!
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={handlePaywall} activeOpacity={0.7}>
              <Text style={styles.upgradeText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── No pet state ──
  if (!activePet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Top Matches</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Ionicons name="paw-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No pet profile yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a pet profile to see{'\n'}personalized product matches
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── First load (no cached data yet) ──
  if (loading && scores.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Top Matches</Text>
            <View style={styles.headerPet}>
              <View style={styles.headerAvatar}>
                {activePet.photo_url ? (
                  <Image source={{ uri: activePet.photo_url }} style={styles.headerPhoto} />
                ) : (
                  <Ionicons name="paw-outline" size={16} color={Colors.accent} />
                )}
              </View>
            </View>
          </View>
        </View>
        <View style={styles.emptyCenter}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>
            {refreshing
              ? `Scoring products for ${activePet.name}...`
              : 'Loading matches...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──
  if (error && scores.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Top Matches</Text>
        </View>
        <View style={styles.emptyCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.severityRed} />
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadTopMatches(activePetId!)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ──
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Top Matches</Text>
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
        </View>
      </View>

      {/* Pet carousel */}
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
                      size={isActive ? 22 : 16}
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

      {/* Category filter chips */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContent}
        >
          {CATEGORY_CHIPS.map(chip => {
            const selected = categoryFilter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? Colors.accent : Colors.card,
                    borderColor: selected ? Colors.accent : Colors.cardBorder,
                  },
                ]}
                onPress={() => setFilter(chip.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.chipText,
                  { color: selected ? '#FFFFFF' : Colors.textSecondary },
                ]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search input */}
      <View style={styles.searchInputRow}>
        <View style={styles.searchInputBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by brand or name..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Refreshing banner */}
      {refreshing && scores.length > 0 && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.refreshText}>Updating matches for {activePet.name}...</Text>
        </View>
      )}

      {/* Product list */}
      <FlatList
        data={filteredScores}
        keyExtractor={item => item.product_id}
        initialNumToRender={25}
        maxToRenderPerBatch={25}
        contentContainerStyle={[
          styles.listContent,
          filteredScores.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productRow}
            onPress={() => handleProductTap(item)}
            activeOpacity={0.7}
          >
            {/* Product image */}
            <View style={styles.productImageWrap}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.productImage} />
              ) : (
                <Ionicons name="nutrition-outline" size={24} color={Colors.textTertiary} />
              )}
            </View>

            {/* Brand + Name */}
            <View style={styles.productInfo}>
              <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text>
              <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
              {item.is_partial_score && (
                <View style={styles.partialBadge}>
                  <Text style={styles.partialText}>Partial</Text>
                </View>
              )}
            </View>

            {/* Score badge */}
            <View style={styles.scoreBadge}>
              <Text style={[
                styles.scoreNumber,
                { color: getScoreColor(item.final_score, item.is_supplemental) },
              ]}>
                {item.final_score}
              </Text>
              <Text style={styles.scoreLabel}>% match</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyFilter}>
              <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyFilterText}>
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : `No ${CATEGORY_LABEL_MAP[categoryFilter]} matches found. Try a different filter.`}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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

  // Carousel
  carousel: {
    marginBottom: Spacing.sm,
  },
  carouselContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.md,
  },
  carouselItem: {
    alignItems: 'center',
    width: 56,
  },
  carouselAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00B4D815',
  },
  carouselAvatarActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  carouselAvatarInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.5,
  },
  carouselPhoto: {
    borderRadius: 24,
  },
  carouselPhotoActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  carouselPhotoInactive: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  carouselName: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  carouselNameInactive: {
    opacity: 0.5,
  },

  // Free user paywall
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBar: {
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
  },
  searchPlaceholder: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
  paywallCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  paywallTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  paywallSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 12,
  },
  upgradeText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter chips
  filterRow: {
    marginBottom: Spacing.sm,
  },
  filterChipsContent: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },

  // Search input
  searchInputRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchInputBar: {
    height: 40,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    padding: 0,
  },

  // Refresh banner
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: `${Colors.accent}15`,
    borderRadius: 8,
  },
  refreshText: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
  },

  // Product list
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 88,
    gap: Spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 12,
  },
  productImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#FFFFFF10',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productBrand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  partialBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.severityAmber}20`,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  partialText: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    fontWeight: '500',
  },

  // Score badge
  scoreBadge: {
    alignItems: 'center',
    minWidth: 48,
  },
  scoreNumber: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  // Empty / loading states
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
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
  loadingText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  retryText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyFilter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  emptyFilterText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
