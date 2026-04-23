import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../../utils/formatters';
import type { ProductSearchResult } from '../../services/topMatches';

interface SearchResultsListProps {
  searchResults: ProductSearchResult[];
  searchLoading: boolean;
  searchQuery: string;
  petName: string;
  onResultTap: (item: ProductSearchResult) => void;
}

export function SearchResultsList({
  searchResults,
  searchLoading,
  searchQuery,
  petName,
  onResultTap,
}: SearchResultsListProps) {
  return (
    <View style={styles.searchResultsContainer}>
      {searchResults.length > 0 ? (
        searchResults.map((item) => (
          <TouchableOpacity
            key={item.product_id}
            style={styles.searchResultRow}
            onPress={() => onResultTap(item)}
            activeOpacity={0.7}
            accessibilityLabel={item.final_score != null ? `${item.final_score}% match for ${petName}` : undefined}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.searchResultImage} />
            ) : (
              <View style={[styles.searchResultImage, styles.searchResultImagePlaceholder]}>
                <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
              </View>
            )}
            <View style={styles.searchResultInfo}>
              <Text style={styles.searchResultBrand} numberOfLines={1}>
                {sanitizeBrand(item.brand)}
              </Text>
              <Text style={styles.searchResultName} numberOfLines={2}>
                {stripBrandFromName(item.brand, item.product_name)}
              </Text>
            </View>
            {item.final_score != null ? (
              <View
                style={[
                  styles.scorePill,
                  { backgroundColor: `${getScoreColor(item.final_score, item.is_supplemental)}1A` },
                ]}
              >
                <Text
                  style={[
                    styles.scorePillText,
                    { color: getScoreColor(item.final_score, item.is_supplemental) },
                  ]}
                >
                  {item.final_score}%
                </Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>
        ))
      ) : searchLoading ? (
        <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.xl }} />
      ) : searchQuery.trim() ? (
        <View style={styles.searchEmptyState}>
          <Text style={styles.searchEmptyText}>
            No products found for &quot;{searchQuery}&quot;
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchResultsContainer: {
    gap: Spacing.xs,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  searchResultImagePlaceholder: {
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    gap: 2,
  },
  searchResultBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  searchEmptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
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
