// Kiba — Category Top Picks Screen
// Showcase "top 20" experience for {category, petId, subFilter}. Hero + Leaderboard + Escape Hatch.
// Spec: docs/superpowers/specs/2026-04-15-top-picks-dedicated-screen-design.md
// D-094: suitability framing. D-095: UPVM compliance. D-096: supplements routed elsewhere.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, SafeAreaView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { fetchCategoryTopPicks } from '../services/categoryBrowseService';
import { getPetAllergens } from '../services/petService';
import { generateTopPickInsights, type InsightContext } from '../services/topPickInsights';
import { TopPickHeroCard } from '../components/browse/TopPickHeroCard';
import { TopPickRankRow } from '../components/browse/TopPickRankRow';
import { getTopPicksTitle, getCategoryTitle, getFilterLabel } from './categoryTopPicksHelpers';
import type { HomeStackParamList } from '../types/navigation';
import type { TopPickEntry, InsightBullet } from '../types/categoryBrowse';

type Props = NativeStackScreenProps<HomeStackParamList, 'CategoryTopPicks'>;

const HEALTHY_THRESHOLD = 10;

export default function CategoryTopPicksScreen({ navigation, route }: Props) {
  const { category, petId, subFilter } = route.params;
  const pets = useActivePetStore((s) => s.pets);
  const pet = pets.find((p) => p.id === petId);
  const species = pet?.species ?? 'dog';
  const petName = pet?.name ?? 'your pet';

  const [picks, setPicks] = useState<TopPickEntry[]>([]);
  const [insightsMap, setInsightsMap] = useState<Record<string, InsightBullet[]>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Paywall gate
  useEffect(() => {
    if (!canSearch()) navigation.goBack();
  }, [navigation]);

  // Hide tab bar on focus (matches CompareScreen pattern)
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  // Fetch picks + compute insights
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const [results, allergens] = await Promise.all([
          fetchCategoryTopPicks(petId, category, subFilter ?? null, species, 20),
          getPetAllergens(petId).catch(() => []),
        ]);
        if (!mountedRef.current) return;

        const ctx: InsightContext = {
          lifeStage: pet?.life_stage ?? null,
          weightGoalLevel: pet?.weight_goal_level ?? 0,
          activityLevel: pet?.activity_level ?? 'moderate',
          allergens: allergens.map((a) => a.allergen),
          category,
          petName,
        };

        const map: Record<string, InsightBullet[]> = {};
        for (const entry of results) {
          map[entry.product_id] = generateTopPickInsights(entry, ctx);
        }

        setPicks(results);
        setInsightsMap(map);
      } catch {
        if (mountedRef.current) {
          setPicks([]);
          setInsightsMap({});
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [petId, category, subFilter, pet?.species, pet?.name, pet?.life_stage, pet?.weight_goal_level, pet?.activity_level]);

  const handleProductTap = useCallback(
    (productId: string) => navigation.navigate('Result', { productId, petId }),
    [navigation, petId],
  );

  const handleEscapeTap = useCallback(() => {
    navigation.navigate('CategoryBrowse', { category, petId, subFilter });
  }, [navigation, category, petId, subFilter]);

  const title = getTopPicksTitle(category, subFilter ?? null, petName);
  const categoryTitle = getCategoryTitle(category);
  const filterLabel = getFilterLabel(category, subFilter ?? null) ?? categoryTitle;
  const isPartial = picks.length > 0 && picks.length < HEALTHY_THRESHOLD;
  const isEmpty = !loading && picks.length === 0;

  const subHeaderText = picks.length >= HEALTHY_THRESHOLD
    ? `Ranked 1–${picks.length} matches for ${petName}`
    : `Ranked 1–${picks.length} — limited results for this filter`;

  const escapeCopyHealthy = `Didn't find the right fit? Browse all ${categoryTitle} →`;
  const escapeCopyPartial = `Browse all ${categoryTitle} →`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.petBadge}>
          <Ionicons name="paw" size={12} color={Colors.accent} />
          <Text style={styles.petBadgeText}>{petName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading top picks…</Text>
        </View>
      ) : isEmpty ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={28} color={Colors.accent} />
            <Text style={styles.emptyTitle}>No scored picks yet</Text>
            <Text style={styles.emptyBody}>
              We haven&apos;t scored any {filterLabel.toLowerCase()} for {petName} yet. Browse the full catalog below.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.escapeButton, styles.escapeButtonPrimary]}
            onPress={handleEscapeTap}
            activeOpacity={0.7}
          >
            <Text style={[styles.escapeButtonText, styles.escapeButtonTextPrimary]}>
              {escapeCopyPartial}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subHeader}>{subHeaderText}</Text>

          <TopPickHeroCard
            pick={picks[0]}
            petName={petName}
            insights={insightsMap[picks[0].product_id] ?? []}
            onPress={() => handleProductTap(picks[0].product_id)}
          />

          {picks.length > 1 && (
            <>
              <Text style={styles.leaderboardLabel}>The Leaderboard</Text>
              {picks.slice(1).map((pick, rankOffset) => (
                <TopPickRankRow
                  key={pick.product_id}
                  pick={pick}
                  rank={rankOffset + 2}
                  insight={insightsMap[pick.product_id]?.[0] ?? null}
                  onPress={() => handleProductTap(pick.product_id)}
                />
              ))}
            </>
          )}

          <TouchableOpacity
            style={[styles.escapeButton, isPartial && styles.escapeButtonPrimary]}
            onPress={handleEscapeTap}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.escapeButtonText, isPartial && styles.escapeButtonTextPrimary]}
            >
              {isPartial ? escapeCopyPartial : escapeCopyHealthy}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  },
  petBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  subHeader: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  leaderboardLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptyCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  escapeButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  escapeButtonPrimary: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}1A`,
  },
  escapeButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  escapeButtonTextPrimary: {
    color: Colors.accent,
  },
});
