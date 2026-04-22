// BookmarkRow — list item for BookmarksScreen.
// Colocated sibling of PantryCard / ScanHistoryCard.

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { sanitizeBrand, stripBrandFromName } from '../../utils/formatters';
import { deriveBookmarkRowState, type BookmarkRowState } from '../../utils/bookmarkRowState';
import type { BookmarkCardData } from '../../types/bookmark';

interface BookmarkRowProps {
  card: BookmarkCardData;
  petName: string;
  isLastInSection: boolean;
  onPress: () => void;
}

export default function BookmarkRow({ card, petName, isLastInSection, onPress }: BookmarkRowProps) {
  const state = deriveBookmarkRowState(card);
  const a11yLabel = buildA11yLabel(card, petName, state);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        state.kind === 'recalled' && styles.rowRecalled,
        !isLastInSection && styles.rowDivider,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={a11yLabel}
    >
      {card.product.image_url ? (
        <Image source={{ uri: card.product.image_url }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.brandRow}>
          <Text style={styles.brand} numberOfLines={1}>
            {sanitizeBrand(card.product.brand)}
          </Text>
          {state.kind === 'bypass' && state.reason === 'vet_diet' && (
            <View style={styles.vetDietChip}>
              <Text style={styles.vetDietChipText}>Vet diet</Text>
            </View>
          )}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {stripBrandFromName(card.product.brand, card.product.name)}
        </Text>
      </View>
      <TrailingChip state={state} />
    </TouchableOpacity>
  );
}

function TrailingChip({ state }: { state: BookmarkRowState }) {
  if (state.kind === 'recalled') {
    return (
      <View style={styles.recalledChip}>
        <Text style={styles.recalledChipText}>Recalled</Text>
      </View>
    );
  }
  if (state.kind === 'scored') {
    return (
      <View style={[styles.pill, { backgroundColor: `${state.color}1A` }]}>
        <Text style={[styles.pillText, { color: state.color }]}>{state.score}%</Text>
      </View>
    );
  }
  if (state.kind === 'bypass') {
    return (
      <View style={styles.bypassChip}>
        <Text style={styles.bypassChipText}>—</Text>
      </View>
    );
  }
  return <PendingShimmer />;
}

function PendingShimmer() {
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

  // No a11y props: the parent TouchableOpacity's accessibilityLabel subsumes
  // this view. VoiceOver will read the full "score pending" label on the row.
  return <Animated.View testID="bookmark-row-pending" style={[styles.pendingPill, { opacity }]} />;
}

function buildA11yLabel(card: BookmarkCardData, petName: string, state: BookmarkRowState): string {
  const name = `${card.product.brand} ${card.product.name}`;
  switch (state.kind) {
    case 'recalled':
      return `${name}, recalled`;
    case 'scored':
      return `${state.score}% match for ${petName}, ${name}`;
    case 'bypass':
      return `${name}, ${state.reason === 'vet_diet' ? 'vet diet' : 'variety pack'}`;
    case 'pending':
      return `${name}, score pending`;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    paddingLeft: Spacing.lg - 3,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  image: { width: 40, height: 40, borderRadius: 8 },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  brand: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  vetDietChip: {
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vetDietChipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  recalledChip: {
    backgroundColor: `${Colors.severityRed}1A`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recalledChipText: {
    color: Colors.severityRed,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  bypassChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bypassChipText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  pendingPill: {
    width: 40,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.chipSurface,
  },
});
