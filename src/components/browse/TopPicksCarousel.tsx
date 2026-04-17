// TopPicksCarousel — Horizontal scrolling product carousel for HomeScreen.
// Shows personalized top picks from pet_product_scores cache, or a weaponized
// zero-state CTA when cache is empty. Width 160 = 2 full cards + peek on iPhone.
// D-094: suitability framing. D-095: UPVM compliance.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import { fetchCategoryTopPicks } from '../../services/categoryBrowseService';
import { batchScoreHybrid } from '../../services/batchScoreOnDevice';
import { useActivePetStore } from '../../stores/useActivePetStore';
import type { BrowseProduct, BrowseCategory } from '../../types/categoryBrowse';
import type { HomeStackParamList, TabParamList } from '../../types/navigation';
import { resolveSeeAllDestination } from './topPicksCarouselHelpers';

// ─── Constants ──────────────────────────────────────────

const CARD_WIDTH = 160;
const CARD_GAP = 12;
// Fetch more than we display — fetchScoredResults uses 3x overfetch, and with
// sub-filters like freeze-dried (≈11% of daily food), a small limit yields 0 hits.
// We only render 10 in the carousel but fetch 50 so post-query filtering works.
const FETCH_LIMIT = 50;
const DISPLAY_LIMIT = 10;

// ─── Types ──────────────────────────────────────────────

interface TopPicksCarouselProps {
  petId: string;
  petName: string;
  species: 'dog' | 'cat';
  activeCategory: BrowseCategory | null;
  activeSubFilter: string | null;
}

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// ─── Component ──────────────────────────────────────────

export function TopPicksCarousel({
  petId,
  petName,
  species,
  activeCategory,
  activeSubFilter,
}: TopPicksCarouselProps) {
  const navigation = useNavigation<HomeNav>();
  const tabNav = useNavigation<BottomTabNavigationProp<TabParamList>>();

  const [picks, setPicks] = useState<BrowseProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPicks = useCallback(async () => {
    setLoading(true);
    try {
      const category = activeCategory ?? 'daily_food';
      const results = await fetchCategoryTopPicks(
        petId,
        category,
        activeSubFilter,
        species,
        FETCH_LIMIT,
      );
      // Only show products with actual scores — unscored fallbacks aren't "top picks"
      const scored = results.filter(p => p.final_score != null);

      // If cache is sparse for this form, trigger form-specific batch scoring and reload
      if (scored.length < DISPLAY_LIMIT && category !== 'supplement') {
        const formMap: Record<string, string> = { dry: 'dry', wet: 'wet', freeze_dried: 'freeze_dried' };
        const dbForm = activeSubFilter ? formMap[activeSubFilter] ?? null : null;
        const dbCategory = category === 'toppers_mixers' ? 'daily_food' : category;
        const pet = useActivePetStore.getState().pets.find((p) => p.id === petId);
        if (pet && dbForm) {
          try {
            await batchScoreHybrid(petId, pet, dbCategory, dbForm);
            // Reload with fresh scores
            const refreshed = await fetchCategoryTopPicks(petId, category, activeSubFilter, species, FETCH_LIMIT);
            setPicks(refreshed.filter(p => p.final_score != null));
            return;
          } catch {
            // Fall through to show whatever we have
          }
        }
      }

      setPicks(scored);
    } catch {
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }, [petId, species, activeCategory, activeSubFilter]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const handleProductTap = useCallback(
    (productId: string) => {
      navigation.navigate('Result', { productId, petId });
    },
    [navigation, petId],
  );

  const handleSeeAll = useCallback(() => {
    const category = activeCategory ?? 'daily_food';
    const destination = resolveSeeAllDestination(category);
    navigation.navigate(destination, {
      category,
      petId,
      subFilter: activeSubFilter ?? undefined,
    });
  }, [navigation, activeCategory, activeSubFilter, petId]);

  const handleScanTap = useCallback(() => {
    tabNav.navigate('Scan');
  }, [tabNav]);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  // ── Zero-state handling ──
  if (picks.length === 0) {
    // If a sub-filter or non-default category is active, empty results just means
    // no matches for that filter — hide silently (not a cold start)
    if (activeSubFilter || (activeCategory && activeCategory !== 'daily_food')) {
      return null;
    }

    // True cold start: no scores at all → weaponized CTA
    return (
      <View style={styles.zeroStateCard}>
        <Ionicons name="sparkles-outline" size={32} color={Colors.accent} />
        <Text style={styles.zeroStateTitle}>
          Unlock {petName}&apos;s Top Picks
        </Text>
        <Text style={styles.zeroStateSubtitle}>
          Scan their current food to initialize the algorithm.
        </Text>
        <TouchableOpacity
          style={styles.zeroStateCta}
          onPress={handleScanTap}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
          <Text style={styles.zeroStateCtaText}>Scan a Product</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Carousel with picks ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Top Picks for {petName}</Text>
        <TouchableOpacity
          style={styles.headerSeeAll}
          onPress={handleSeeAll}
          activeOpacity={0.7}
        >
          <Text style={styles.headerSeeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={picks.slice(0, DISPLAY_LIMIT)}
        keyExtractor={(item) => item.product_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        renderItem={({ item }) => {
          const scoreColor =
            item.final_score != null
              ? getScoreColor(item.final_score, item.is_supplemental)
              : null;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleProductTap(item.product_id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardImageStage}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="cube-outline" size={28} color={Colors.textTertiary} />
                  </View>
                )}
              </View>
              <Text style={styles.cardBrand} numberOfLines={1}>
                {sanitizeBrand(item.brand)}
              </Text>
              <Text style={styles.cardName} numberOfLines={2}>
                {stripBrandFromName(item.brand, item.product_name)}
              </Text>
              {item.final_score != null && scoreColor && (
                <View
                  style={[
                    styles.cardScorePill,
                    { backgroundColor: `${scoreColor}1A` },
                  ]}
                >
                  <Text style={[styles.cardScoreText, { color: scoreColor }]}>
                    {item.final_score}%
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerSeeAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  listContent: {
    paddingRight: Spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.sm,
    gap: 4,
  },
  cardImageStage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: CARD_WIDTH - Spacing.sm * 2 - 24,
    height: 68,
    resizeMode: 'contain' as const,
  },
  cardImagePlaceholder: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBrand: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  cardName: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  cardScorePill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  cardScoreText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },

  // Zero-state CTA
  zeroStateCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  zeroStateTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  zeroStateSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  zeroStateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  zeroStateCtaText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
