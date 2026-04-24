// BookmarksScreen — dedicated list of up to 20 per-pet bookmarks.
// Row style mirrors HomeScreen's inline scan rows; delete via SwipeableRow.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { fetchBookmarkCards } from '../services/bookmarkService';
import { groupBookmarksByCategory, type BookmarkSection } from '../utils/bookmarkGrouping';
import SwipeableRow from '../components/ui/SwipeableRow';
import BookmarkRow from '../components/bookmarks/BookmarkRow';
import type { BookmarkCardData } from '../types/bookmark';
import { MAX_BOOKMARKS_PER_PET, BookmarkOfflineError } from '../types/bookmark';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Bookmarks'>,
  BottomTabNavigationProp<TabParamList>
>;

export default function BookmarksScreen() {
  const navigation = useNavigation<Nav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);
  const insets = useSafeAreaInsets();
  const petInitial = activePet
    ? String.fromCodePoint(activePet.name.codePointAt(0) ?? 0x2022).toLocaleUpperCase()
    : '?';
  const bookmarkIds = useBookmarkStore((s) => s.bookmarks.map((b) => b.id).join(','));
  const loadForPet = useBookmarkStore((s) => s.loadForPet);
  const toggle = useBookmarkStore((s) => s.toggle);
  const [cards, setCards] = useState<BookmarkCardData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo<BookmarkSection[]>(
    () => groupBookmarksByCategory(cards),
    [cards],
  );

  const refresh = useCallback(async () => {
    if (!activePet) return;
    setRefreshing(true);
    await loadForPet(activePet.id);
    const next = await fetchBookmarkCards(activePet);
    setCards(next);
    setRefreshing(false);
  }, [activePet, loadForPet]);

  useEffect(() => {
    if (!activePet) {
      setCards([]);
      return;
    }
    void fetchBookmarkCards(activePet).then(setCards);
  }, [activePet, bookmarkIds]);

  const handleDelete = async (productId: string) => {
    if (!activePetId) return;
    try {
      await toggle(activePetId, productId);
    } catch (err) {
      if (err instanceof BookmarkOfflineError) {
        Alert.alert('Offline', 'Bookmarks can be removed once you are back online.');
      } else {
        Alert.alert('Could not remove', err instanceof Error ? err.message : 'Unknown error');
      }
    }
  };

  if (!activePet) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Select a pet to see bookmarks</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.navBar, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {activePet.photo_url ? (
            <Image source={{ uri: activePet.photo_url }} style={styles.petPhoto} />
          ) : (
            <View style={styles.petPhotoFallback}>
              <Text style={styles.petPhotoInitial}>{petInitial}</Text>
            </View>
          )}
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {activePet.name}'s Bookmarks
          </Text>
          <View style={styles.spacer} />
          <View style={[styles.progressChip, cards.length >= 19 && styles.progressChipAmber]}>
            <Text style={[styles.progressChipText, cards.length >= 19 && styles.progressChipTextAmber]}>
              {cards.length}/{MAX_BOOKMARKS_PER_PET} saved
            </Text>
          </View>
        </View>
      </View>
      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="bookmark-outline"
            size={48}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the menu on any product page, or long-press a recent scan.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a product"
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.ctaLabel}>Scan a product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.bookmark.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Image source={section.iconSource} style={styles.sectionIcon} />
              <Text style={styles.sectionLabel}>
                {section.label} · {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <SwipeableRow
              onDelete={() => handleDelete(item.product.id)}
              deleteConfirmMessage={`Remove ${item.product.brand} ${item.product.name} from bookmarks?`}
              deleteLabel="Remove"
            >
              <BookmarkRow
                card={item}
                petName={activePet.name}
                isLastInSection={index === section.data.length - 1}
                onPress={() => {
                  if (item.product.is_recalled) {
                    navigation.navigate('RecallDetail', { productId: item.product.id });
                  } else {
                    navigation.navigate('Result', { productId: item.product.id, petId: activePetId! });
                  }
                }}
              />
            </SwipeableRow>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  petPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  petPhotoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petPhotoInitial: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  listContent: {
    paddingBottom: 88,
  },
  progressChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressChipAmber: {
    backgroundColor: Colors.severityAmberTint,
  },
  progressChipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  progressChipTextAmber: {
    color: Colors.severityAmber,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
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
  ctaLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    paddingBottom: 6,
    paddingHorizontal: Spacing.lg,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
