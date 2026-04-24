// Kiba — M9 Community FeaturedRecipeHero (Task 25)
// Replaces the placeholder slot in CommunityScreen. Self-fetches the most
// recently approved recipe and renders one of three states:
//   loading  → shimmer card
//   empty    → "Submit the first recipe" CTA → KibaKitchenSubmit
//   populated → cover-image hero → KibaKitchenFeed
// D-084: Ionicons only. D-095: descriptive copy, no medical claims.
//
// Lives inside CommunityStack — both navigation targets are on the same stack.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { fetchApprovedRecipes } from '../../services/recipeService';
import type { CommunityRecipe } from '../../types/recipe';
import type { CommunityStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

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

interface Props {
  /** Optional override for tests / Storybook to skip the network fetch. */
  initialRecipe?: CommunityRecipe | null;
  /** When true, treats `initialRecipe === null` as the resolved-empty state. */
  initialResolved?: boolean;
}

export function FeaturedRecipeHero({
  initialRecipe = null,
  initialResolved = false,
}: Props) {
  const navigation = useNavigation<Nav>();
  const [recipe, setRecipe] = useState<CommunityRecipe | null>(initialRecipe);
  const [resolved, setResolved] = useState<boolean>(initialResolved);

  useEffect(() => {
    if (initialResolved) return;
    let cancelled = false;
    fetchApprovedRecipes(1)
      .then((rows) => {
        if (cancelled) return;
        setRecipe(rows[0] ?? null);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Treat failure as "no recipe" — never block the screen with a partial
        // banner. Service already returns [] on offline.
        setRecipe(null);
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialResolved]);

  if (!resolved) return <HeroShimmer />;

  if (!recipe) {
    return (
      <TouchableOpacity
        style={styles.emptyCard}
        onPress={() => navigation.navigate('KibaKitchenSubmit')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Submit the first recipe"
      >
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name="restaurant-outline"
            size={24}
            color={Colors.accent}
          />
        </View>
        <View style={styles.emptyBody}>
          <Text style={styles.emptyTitle}>Kiba Kitchen</Text>
          <Text style={styles.emptySubtitle}>
            Submit the first recipe
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  const speciesLabel = SPECIES_LABEL[recipe.species];
  const lifeStageLabel = LIFE_STAGE_LABEL[recipe.life_stage];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('KibaKitchenFeed')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Featured recipe: ${recipe.title}. ${speciesLabel}. ${lifeStageLabel}.`}
    >
      <Text style={styles.eyebrow}>KIBA KITCHEN</Text>
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
            size={36}
            color={Colors.textTertiary}
          />
        </View>
      )}
      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {recipe.title}
      </Text>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{speciesLabel}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{lifeStageLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function HeroShimmer() {
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
    <View style={styles.card} testID="featured-recipe-hero-shimmer">
      <Animated.View style={[styles.shimmerEyebrow, { opacity }]} />
      <Animated.View style={[styles.shimmerCover, { opacity }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
      <Animated.View style={[styles.shimmerLineNarrow, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Populated card
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  eyebrow: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
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

  // Empty (CTA) card
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 2,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // Shimmer
  shimmerEyebrow: {
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '30%',
    marginBottom: Spacing.sm,
  },
  shimmerCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: Colors.chipSurface,
    marginBottom: Spacing.sm,
  },
  shimmerLineWide: {
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '70%',
  },
  shimmerLineNarrow: {
    marginTop: 6,
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '40%',
  },
});
