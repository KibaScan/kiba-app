import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import type { BookmarkCardData } from '../../types/bookmark';

interface BookmarksSectionProps {
  bookmarkCards: BookmarkCardData[];
  petName: string;
  activePetId: string | null;
  onCardPress: (productId: string, isRecalled: boolean) => void;
  onSeeAll: () => void;
}

export function BookmarksSection({
  bookmarkCards,
  petName,
  activePetId,
  onCardPress,
  onSeeAll,
}: BookmarksSectionProps) {
  return (
    <View style={styles.bookmarksSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.recentScansTitle}>Bookmarks</Text>
        <TouchableOpacity
          onPress={onSeeAll}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="See all bookmarks"
        >
          <Text style={styles.seeAllLink}>See all ›</Text>
        </TouchableOpacity>
      </View>
      {bookmarkCards.map((card) => {
        const scoreColor =
          card.final_score != null
            ? getScoreColor(card.final_score, card.product.is_supplemental)
            : null;
        return (
          <TouchableOpacity
            key={card.bookmark.id}
            style={[styles.scanRow, card.product.is_recalled && styles.rowRecalled]}
            onPress={() => onCardPress(card.product.id, card.product.is_recalled ?? false)}
            activeOpacity={0.7}
            accessibilityLabel={
              card.final_score != null
                ? `${card.final_score}% match for ${petName}, ${card.product.brand} ${card.product.name}`
                : `${card.product.brand} ${card.product.name}${card.product.is_recalled ? ', recalled product' : ''}`
            }
          >
            {card.product.image_url ? (
              <Image source={{ uri: card.product.image_url }} style={styles.scanRowImage} />
            ) : (
              <View style={styles.scanRowImagePlaceholder}>
                <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
              </View>
            )}
            <View style={styles.scanRowInfo}>
              <Text style={styles.scanRowBrand} numberOfLines={1}>
                {sanitizeBrand(card.product.brand)}
              </Text>
              <Text style={styles.scanRowName} numberOfLines={2}>
                {stripBrandFromName(card.product.brand, card.product.name)}
              </Text>
            </View>
            {scoreColor ? (
              <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
                <Text style={[styles.scorePillText, { color: scoreColor }]}>
                  {card.final_score}%
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bookmarksSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  seeAllLink: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
  recentScansTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    paddingLeft: Spacing.md - 3,
  },
  scanRowImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  scanRowImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanRowInfo: {
    flex: 1,
    gap: 2,
  },
  scanRowBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scanRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
});
