// Kiba — M9 Community BlogCarousel (Task 26)
// Self-fetching horizontal carousel of the 3 most-recent published blog posts.
// State machine:
//   loading   → shimmer row (3 placeholder cards)
//   empty     → renders null (Community screen layout collapses cleanly)
//   populated → horizontal FlatList of BlogPostCards + "See all →" tail chip
//
// The empty branch returning null is intentional per spec — there is no
// "coming soon" placeholder. The neighbouring SubredditFooter / DiscoveryGrid
// own the visual rhythm when the carousel is hidden.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { fetchPublishedPosts, type BlogPost } from '../../services/blogService';
import type { CommunityStackParamList } from '../../types/navigation';
import { BlogPostCard } from './BlogPostCard';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

const CAROUSEL_LIMIT = 3;
const CARD_WIDTH = 240;
const CARD_SPACING = Spacing.md;

interface Props {
  /** Optional override for tests / Storybook to skip the network fetch. */
  initialPosts?: BlogPost[] | null;
  /** When true, treats `initialPosts` as the resolved value (skips fetch). */
  initialResolved?: boolean;
}

export function BlogCarousel({
  initialPosts = null,
  initialResolved = false,
}: Props) {
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<BlogPost[] | null>(initialPosts);
  const [resolved, setResolved] = useState<boolean>(initialResolved);

  useEffect(() => {
    if (initialResolved) return;
    let cancelled = false;
    fetchPublishedPosts(CAROUSEL_LIMIT)
      .then((rows) => {
        if (cancelled) return;
        setPosts(rows);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Treat failure as empty — never block the screen with a partial
        // banner. Service already returns [] on offline.
        setPosts([]);
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialResolved]);

  if (!resolved) return <CarouselShimmer />;

  // Empty state collapses entirely — Community layout reflows cleanly.
  if (!posts || posts.length === 0) return null;

  const renderItem: ListRenderItem<BlogPost> = ({ item }) => (
    <BlogPostCard
      post={item}
      onPress={() => navigation.navigate('BlogDetail', { postId: item.id })}
      style={styles.card}
    />
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>READ</Text>
      </View>
      <FlatList
        horizontal
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: CARD_SPACING }} />}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.seeAllChip}
            onPress={() => navigation.navigate('BlogList')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="See all articles"
          >
            <Text style={styles.seeAllLabel}>See all</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.accent}
            />
          </TouchableOpacity>
        }
      />
    </View>
  );
}

// ─── Shimmer ────────────────────────────────────────────

function CarouselShimmer() {
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
    <View style={styles.wrap} testID="blog-carousel-shimmer">
      <Animated.View style={[styles.shimmerEyebrow, { opacity }]} />
      <View style={styles.shimmerRow}>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.shimmerCard, { opacity }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1,
  },
  listContent: {
    // Cards are flush with the parent screen's horizontal padding — no extra
    // padding here. Trailing "See all" chip provides its own breathing room.
  },
  card: {
    width: CARD_WIDTH,
  },
  seeAllChip: {
    marginLeft: CARD_SPACING,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.chipSurface,
  },
  seeAllLabel: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // Shimmer
  shimmerEyebrow: {
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '15%',
    marginBottom: Spacing.sm,
  },
  shimmerRow: {
    flexDirection: 'row',
    gap: CARD_SPACING,
  },
  shimmerCard: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 11, // cover + body height
    borderRadius: 14,
    backgroundColor: Colors.chipSurface,
  },
});
