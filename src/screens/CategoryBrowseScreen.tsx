// Kiba — Category Browse Screen
// Full-screen product browse by category with sub-filter chips.
// Results sorted by personalized score (or alphabetical for supplements/vet diets).
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements unscored.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { fetchBrowseResults, fetchBrowseCounts } from '../services/categoryBrowseService';
import { SubFilterChipRow } from '../components/browse/SubFilterChipRow';
import { BrowseProductRow } from '../components/browse/BrowseProductRow';
import { SUB_FILTERS } from '../types/categoryBrowse';
import type { BrowseCategory, BrowseProduct, BrowseCounts } from '../types/categoryBrowse';
import type { HomeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryBrowse'>;

// ─── Category display config ──────────────────────────────

const CATEGORY_TITLES: Record<BrowseCategory, string> = {
  daily_food: 'Daily Food',
  toppers_mixers: 'Toppers & Mixers',
  treat: 'Treats',
  supplement: 'Supplements',
};

// Map sub-filter keys → browse counts keys for badge display
const COUNTS_KEY_MAP: Record<string, keyof BrowseCounts> = {
  // Daily food
  dry: 'daily_dry',
  wet: 'daily_wet',
  freeze_dried: 'daily_freeze_dried',
  vet_diet: 'daily_vet_diet',
  other: 'daily_other',
};

function getChipCounts(
  category: BrowseCategory,
  counts: BrowseCounts | null,
): Record<string, number> | undefined {
  if (!counts) return undefined;
  const filters = SUB_FILTERS[category];
  const result: Record<string, number> = {};
  for (const f of filters) {
    const mapped = COUNTS_KEY_MAP[f.key];
    if (mapped && counts[mapped] !== undefined) {
      result[f.key] = counts[mapped];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ─── Component ────────────────────────────────────────────

export default function CategoryBrowseScreen({ navigation, route }: Props) {
  const { category, petId } = route.params;
  const pets = useActivePetStore((s) => s.pets);
  const pet = pets.find((p) => p.id === petId);
  const species = pet?.species ?? 'dog';
  const petName = pet?.name ?? 'your pet';

  const [products, setProducts] = useState<BrowseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<BrowseCounts | null>(null);
  const mountedRef = useRef(true);

  // Paywall gate
  useEffect(() => {
    if (!canSearch()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Fetch counts once
  useEffect(() => {
    fetchBrowseCounts(species).then((c) => {
      if (mountedRef.current) setCounts(c);
    });
    return () => { mountedRef.current = false; };
  }, [species]);

  // Fetch first page when filter changes
  const loadFirstPage = useCallback(async (filterKey: string | null) => {
    setLoading(true);
    setProducts([]);
    setCursor(null);
    try {
      const page = await fetchBrowseResults(petId, category, filterKey, species, null);
      if (mountedRef.current) {
        setProducts(page.products);
        setCursor(page.nextCursor);
      }
    } catch {
      // silently fail — empty state will show
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [petId, category, species]);

  // Initial load + filter change
  useEffect(() => {
    loadFirstPage(activeFilter);
  }, [activeFilter, loadFirstPage]);

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchBrowseResults(petId, category, activeFilter, species, cursor);
      if (mountedRef.current) {
        setProducts((prev) => [...prev, ...page.products]);
        setCursor(page.nextCursor);
      }
    } catch {
      // silently fail
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [cursor, loadingMore, petId, category, activeFilter, species]);

  const handleFilterSelect = useCallback((key: string | null) => {
    setActiveFilter(key);
  }, []);

  const handleProductPress = useCallback((product: BrowseProduct) => {
    navigation.navigate('Result', { productId: product.product_id, petId });
  }, [navigation, petId]);

  // ─── Render ─────────────────────────────────────────────

  const filters = SUB_FILTERS[category];
  const chipCounts = getChipCounts(category, counts);
  const isUnscored = category === 'supplement' || activeFilter === 'vet_diet';
  const resultsLabel = isUnscored
    ? `${products.length} ${CATEGORY_TITLES[category].toLowerCase()}`
    : `${products.length}+ results for ${petName}`;

  const renderItem = useCallback(({ item, index }: { item: BrowseProduct; index: number }) => (
    <BrowseProductRow
      product={item}
      rank={index + 1}
      onPress={() => handleProductPress(item)}
    />
  ), [handleProductPress]);

  const keyExtractor = useCallback((item: BrowseProduct) => item.product_id, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{CATEGORY_TITLES[category]}</Text>
        <View style={styles.petBadge}>
          <Ionicons name="paw" size={12} color={Colors.accent} />
          <Text style={styles.petBadgeText}>{petName}</Text>
        </View>
      </View>

      {/* Sub-filter chips */}
      <SubFilterChipRow
        filters={filters}
        activeKey={activeFilter}
        onSelect={handleFilterSelect}
        counts={chipCounts}
      />

      {/* Results header */}
      {!loading && products.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{resultsLabel}</Text>
          {activeFilter && (
            <TouchableOpacity onPress={() => setActiveFilter(null)}>
              <Text style={styles.clearLink}>Clear filter</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Product list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyBody}>
            {activeFilter ? 'Try a different filter or clear your selection.' : 'No products available in this category.'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={products}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator style={styles.footer} size="small" color={Colors.accent} />
          ) : null}
          ItemSeparatorComponent={Separator}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  petBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  petBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  resultsCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  clearLink: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.hairlineBorder,
    marginLeft: Spacing.lg + 24 + Spacing.sm, // rank width + gap
  },
  footer: {
    paddingVertical: Spacing.lg,
  },
});
