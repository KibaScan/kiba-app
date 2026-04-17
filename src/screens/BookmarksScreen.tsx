// BookmarksScreen — dedicated list of up to 20 per-pet bookmarks.
// Row style mirrors HomeScreen's inline scan rows; delete via SwipeableRow.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { Colors, Spacing, getScoreColor } from '../utils/constants';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { fetchBookmarkCards, removeBookmark } from '../services/bookmarkService';
import { sanitizeBrand, stripBrandFromName } from '../utils/formatters';
import SwipeableRow from '../components/ui/SwipeableRow';
import type { BookmarkCardData } from '../types/bookmark';
import { MAX_BOOKMARKS_PER_PET } from '../types/bookmark';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Bookmarks'>,
  BottomTabNavigationProp<TabParamList>
>;

export default function BookmarksScreen() {
  const navigation = useNavigation<Nav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);
  const bookmarkIds = useBookmarkStore((s) => s.bookmarks.map((b) => b.id).join(','));
  const loadForPet = useBookmarkStore((s) => s.loadForPet);
  const [cards, setCards] = useState<BookmarkCardData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      await removeBookmark(activePetId, productId);
      await loadForPet(activePetId);
    } catch (err) {
      Alert.alert('Could not remove', err instanceof Error ? err.message : 'Unknown error');
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
      <View style={styles.header}>
        <Text style={styles.title}>Bookmarks</Text>
        <Text style={styles.subtitle}>
          {activePet.name} · {cards.length}/{MAX_BOOKMARKS_PER_PET}
        </Text>
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
        <FlatList
          data={cards}
          keyExtractor={(c) => c.bookmark.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
          renderItem={({ item }) => (
            <SwipeableRow
              onDelete={() => handleDelete(item.product.id)}
              deleteConfirmMessage={`Remove ${item.product.brand} ${item.product.name} from bookmarks?`}
              deleteLabel="Remove"
            >
              <BookmarkRow card={item} petName={activePet.name} petId={activePetId!} navigation={navigation} />
            </SwipeableRow>
          )}
        />
      )}
    </View>
  );
}

function BookmarkRow({
  card,
  petName,
  petId,
  navigation,
}: {
  card: BookmarkCardData;
  petName: string;
  petId: string;
  navigation: Nav;
}) {
  const scoreColor =
    card.final_score != null ? getScoreColor(card.final_score, card.product.is_supplemental) : null;
  return (
    <TouchableOpacity
      style={[styles.row, card.product.is_recalled && styles.rowRecalled]}
      onPress={() => {
        if (card.product.is_recalled) {
          navigation.navigate('RecallDetail', { productId: card.product.id });
        } else {
          navigation.navigate('Result', { productId: card.product.id, petId });
        }
      }}
      activeOpacity={0.7}
      accessibilityLabel={
        card.final_score != null
          ? `${card.final_score}% match for ${petName}, ${card.product.brand} ${card.product.name}`
          : `${card.product.brand} ${card.product.name}${card.product.is_recalled ? ', recalled product' : ''}`
      }
    >
      {card.product.image_url ? (
        <Image source={{ uri: card.product.image_url }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {sanitizeBrand(card.product.brand)}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {stripBrandFromName(card.product.brand, card.product.name)}
        </Text>
      </View>
      {scoreColor ? (
        <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.pillText, { color: scoreColor }]}>{card.final_score}%</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
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
  brand: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
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
});
