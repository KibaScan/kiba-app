// Kiba — M9 Community BlogListScreen (Task 26)
// Vertical full-bleed list of all published blog posts (reverse chronological).
// State machine:
//   loading  → shimmer skeleton (3 placeholder cards)
//   empty    → "No articles yet — check back soon."
//   populated → FlatList of BlogPostCards, full-width
// Pull-to-refresh re-calls fetchPublishedPosts.
//
// CommunityStack has headerShown: false → render our own back/title bar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Easing,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import { fetchPublishedPosts, type BlogPost } from '../services/blogService';
import { BlogPostCard } from '../components/community/BlogPostCard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'BlogList'>;

const LIST_LIMIT = 50;

export default function BlogListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const load = useCallback(async () => {
    const rows = await fetchPublishedPosts(LIST_LIMIT);
    setPosts(rows);
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

  const renderItem: ListRenderItem<BlogPost> = ({ item }) => (
    <BlogPostCard
      post={item}
      onPress={() => navigation.navigate('BlogDetail', { postId: item.id })}
      style={styles.card}
    />
  );

  const showEmpty = !loading && posts.length === 0;

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
        <Text style={styles.headerTitle}>Articles</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ListShimmer />
      ) : showEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="book-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptyBody}>Check back soon.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
            />
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

// ─── Shimmer ────────────────────────────────────────────

function ListShimmer() {
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
    <View style={styles.shimmerWrap} testID="blog-list-shimmer">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[styles.shimmerCard, { opacity }]}
        />
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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

  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 88,
  },
  card: {
    width: '100%',
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

  // Shimmer
  shimmerWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  shimmerCard: {
    width: '100%',
    aspectRatio: 16 / 11,
    borderRadius: 14,
    backgroundColor: Colors.chipSurface,
  },
});
