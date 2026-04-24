// Kiba — M9 Community KibaKitchenFeedScreen (Task 25)
// Approved community recipes list. RecipeDisclaimerBanner pinned above the
// list (spec §15.1 — must always be visible). Pull-to-refresh re-fetches.
//
// recipeService.fetchApprovedRecipes returns [] on offline AND on empty —
// we distinguish the two via isOnline() so the empty-state copy matches the
// actual condition (per spec: "Couldn't load recipes" when offline).
//
// CommunityStack has headerShown: false so we render our own back/title bar.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import { fetchApprovedRecipes } from '../services/recipeService';
import { isOnline } from '../utils/network';
import type { CommunityRecipe } from '../types/recipe';
import { RecipeDisclaimerBanner } from '../components/community/RecipeDisclaimerBanner';
import { RecipeFeedCard } from '../components/community/RecipeFeedCard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'KibaKitchenFeed'>;

const FEED_LIMIT = 20;

export default function KibaKitchenFeedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [online, setOnline] = useState<boolean>(true);

  const load = useCallback(async () => {
    const [reachable, rows] = await Promise.all([
      isOnline(),
      fetchApprovedRecipes(FEED_LIMIT),
    ]);
    setOnline(reachable);
    setRecipes(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCardPress = useCallback(
    (recipe: CommunityRecipe) => {
      navigation.navigate('KibaKitchenRecipeDetail', { recipeId: recipe.id });
    },
    [navigation],
  );

  const showOfflineEmpty = !loading && recipes.length === 0 && !online;
  const showRegularEmpty = !loading && recipes.length === 0 && online;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kiba Kitchen</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('KibaKitchenSubmit')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="New recipe"
        >
          <Ionicons name="add" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Persistent disclaimer */}
      <View style={styles.disclaimerWrap}>
        <RecipeDisclaimerBanner />
      </View>

      {showOfflineEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>Couldn’t load recipes</Text>
          <Text style={styles.emptyBody}>
            Check your connection and pull to refresh.
          </Text>
        </View>
      ) : showRegularEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="restaurant-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptyBody}>Be the first to submit.</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('KibaKitchenSubmit')}
            accessibilityRole="button"
            accessibilityLabel="Submit a recipe"
          >
            <Ionicons name="add" size={18} color={Colors.textPrimary} />
            <Text style={styles.ctaLabel}>Submit a recipe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
            />
          }
          renderItem={({ item }) => (
            <RecipeFeedCard
              recipe={item}
              onPress={() => handleCardPress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

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
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  disclaimerWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 88,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
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
  ctaLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
