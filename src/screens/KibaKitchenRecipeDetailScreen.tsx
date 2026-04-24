// Kiba — M9 Community KibaKitchenRecipeDetailScreen (Task 25)
// Single-recipe detail view. Persistent RecipeDisclaimerBanner BOTH at the top
// AND at the bottom (spec §6.4 — disclaimer must always be in view regardless
// of scroll position).
//
// State machine:
//   loading       → shimmer
//   not-found     → "Recipe removed" placeholder
//   killed        → same "Recipe removed" placeholder (fetchRecipeById does NOT
//                   filter is_killed; we guard client-side)
//   populated     → cover, title, badges, ingredients, prep steps
//
// Task 27 update: the previously-stubbed "Report issue" overflow menu was
// REMOVED rather than wired into SafetyFlagSheet. score_flags has FK
// constraints on BOTH pet_id and product_id (migration 045), and a community
// recipe has neither — it's a recipe UUID, not a product. The cleanest path
// is to keep the schema honest: when a dedicated `recipe_flags` table or
// equivalent surface exists, we'll re-add a recipe-aware report entry. Until
// then, recipe concerns can route through Studio email / manual flow.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import { fetchRecipeById } from '../services/recipeService';
import type { CommunityRecipe } from '../types/recipe';
import { RecipeDisclaimerBanner } from '../components/community/RecipeDisclaimerBanner';

type Props = NativeStackScreenProps<
  CommunityStackParamList,
  'KibaKitchenRecipeDetail'
>;

type DetailState =
  | { status: 'loading' }
  | { status: 'missing' } // not found OR is_killed=true
  | { status: 'ok'; recipe: CommunityRecipe };

const SPECIES_LABEL: Record<CommunityRecipe['species'], string> = {
  dog: 'Dog',
  cat: 'Cat',
  both: 'Dog & Cat',
};

const LIFE_STAGE_LABEL: Record<CommunityRecipe['life_stage'], string> = {
  puppy: 'Puppy',
  adult: 'Adult',
  senior: 'Senior',
  all: 'All ages',
};

export default function KibaKitchenRecipeDetailScreen({
  route,
  navigation,
}: Props) {
  const insets = useSafeAreaInsets();
  const { recipeId } = route.params;

  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchRecipeById(recipeId);
        if (cancelled) return;
        // Service does NOT filter is_killed — guard client-side to keep the
        // detail screen safe against rows users navigated to before the kill
        // signal propagated.
        if (!row || row.is_killed) {
          setState({ status: 'missing' });
        } else {
          setState({ status: 'ok', recipe: row });
        }
      } catch {
        if (cancelled) return;
        setState({ status: 'missing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  // Header is rendered the same regardless of state so back always works.
  // Overflow menu was removed in Task 27 (see file header comment) — recipes
  // can't satisfy score_flags' product_id FK, so the entry was deleted rather
  // than wired with a sentinel-product hack.
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Recipe</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (state.status === 'loading') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <DetailShimmer />
      </View>
    );
  }

  if (state.status === 'missing') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.missingCard}>
          <Ionicons
            name="close-circle-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.missingTitle}>Recipe removed</Text>
          <Text style={styles.missingBody}>
            This recipe is no longer available.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to recipes"
          >
            <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
            <Text style={styles.backButtonLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { recipe } = state;
  const speciesLabel = SPECIES_LABEL[recipe.species];
  const lifeStageLabel = LIFE_STAGE_LABEL[recipe.life_stage];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top disclaimer (spec §6.4) */}
        <RecipeDisclaimerBanner />

        {recipe.cover_image_url ? (
          <Image
            source={{ uri: recipe.cover_image_url }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons
              name="restaurant-outline"
              size={40}
              color={Colors.textTertiary}
            />
          </View>
        )}

        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.subtitle ? (
          <Text style={styles.subtitle}>{recipe.subtitle}</Text>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{speciesLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{lifeStageLabel}</Text>
          </View>
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionLabel}>Ingredients</Text>
        <View style={styles.section}>
          {recipe.ingredients.map((ing, idx) => (
            <View
              key={`${ing.name}-${idx}`}
              style={[
                styles.ingredientRow,
                idx === recipe.ingredients.length - 1 && styles.ingredientRowLast,
              ]}
              accessibilityRole="text"
              accessibilityLabel={`${ing.name}, ${ing.quantity} ${ing.unit}`}
            >
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>
                {ing.quantity}
                {ing.unit ? ` ${ing.unit}` : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Prep steps */}
        <Text style={styles.sectionLabel}>Prep Steps</Text>
        <View style={styles.section}>
          {recipe.prep_steps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Bottom disclaimer (spec §6.4 — must appear at top AND bottom) */}
        <View style={styles.bottomDisclaimerWrap}>
          <RecipeDisclaimerBanner />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Shimmer ────────────────────────────────────────────

function DetailShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.shimmerWrap} testID="recipe-detail-shimmer">
      <Animated.View style={[styles.shimmerCover, { opacity }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
      <Animated.View style={[styles.shimmerLineNarrow, { opacity }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity, marginTop: Spacing.lg }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
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
  headerSpacer: { width: 24 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Hero
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.cardSurface,
    marginTop: Spacing.lg,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  badge: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Sections
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  // Ingredient rows
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  ingredientQty: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // Prep step rows
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.chipSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  bottomDisclaimerWrap: {
    marginTop: Spacing.lg,
  },
  bottomSpacer: { height: 88 },

  // Missing state
  missingCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  missingTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  missingBody: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  backButtonLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // Shimmer
  shimmerWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  shimmerCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.chipSurface,
    marginBottom: Spacing.lg,
  },
  shimmerLineWide: {
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '70%',
    marginBottom: 6,
  },
  shimmerLineNarrow: {
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '40%',
  },
});
