// Kiba — M9 Community RecipeFeedCard (Task 25)
// Card row used by KibaKitchenFeedScreen. Pure presentation; the screen owns
// data + navigation. Cover image floats top-left; title + subtitle stack on the
// right; species + life-stage badges sit on a hairline divider underneath.
// Matte Premium tokens — cardSurface + hairlineBorder + 16px radius.
// D-084: Ionicons only.

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { CommunityRecipe } from '../../types/recipe';

interface Props {
  recipe: CommunityRecipe;
  onPress: () => void;
}

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

export function RecipeFeedCard({ recipe, onPress }: Props) {
  const speciesLabel = SPECIES_LABEL[recipe.species];
  const lifeStageLabel = LIFE_STAGE_LABEL[recipe.life_stage];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. ${speciesLabel}. ${lifeStageLabel}.`}
    >
      <View style={styles.row}>
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
              size={28}
              color={Colors.textTertiary}
            />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {recipe.title}
          </Text>
          {recipe.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
              {recipe.subtitle}
            </Text>
          ) : null}

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons
                name={recipe.species === 'cat' ? 'paw-outline' : 'paw'}
                size={11}
                color={Colors.textSecondary}
                style={styles.badgeIcon}
              />
              <Text style={styles.badgeText}>{speciesLabel}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lifeStageLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  cover: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
