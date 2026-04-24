// Kiba — M9 Community BlogDetailScreen (Task 26)
// Single-post detail view. Uses react-native-marked's `useMarkdown` HOOK so
// the rendered nodes can sit inside our existing ScrollView pattern (the
// default <Markdown> component renders its own FlatList — wrapping that in a
// ScrollView triggers nested-virtualization warnings). Body fallback to plain
// Text if markdown produces zero nodes (defensive — shouldn't happen).
//
// State machine:
//   loading    → shimmer
//   not-found  → "Article not found" placeholder + back button
//   populated  → cover, title, subtitle, markdown body
//
// Header right action: Share. Falls back gracefully — Share.share is wrapped
// in try/catch so a missing or rejected dialog never crashes the screen.

import React, { Fragment, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Share,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMarkdown, type useMarkdownHookOptions } from 'react-native-marked';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import type { CommunityStackParamList } from '../types/navigation';
import { fetchPostById, type BlogPost } from '../services/blogService';

type Props = NativeStackScreenProps<CommunityStackParamList, 'BlogDetail'>;

type DetailState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ok'; post: BlogPost };

const BLOG_WEB_BASE = 'https://kibascan.com/blog/';

export default function BlogDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { postId } = route.params;

  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchPostById(postId);
        if (cancelled) return;
        if (!row) {
          setState({ status: 'missing' });
        } else {
          setState({ status: 'ok', post: row });
        }
      } catch {
        if (cancelled) return;
        setState({ status: 'missing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleShare = async () => {
    if (state.status !== 'ok') return;
    try {
      await Share.share({
        message: state.post.title,
        url: `${BLOG_WEB_BASE}${state.post.id}`,
      });
    } catch {
      // Share dialog dismissal is not exceptional — swallow.
    }
  };

  const renderHeader = (showShare: boolean) => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Article</Text>
      {showShare ? (
        <TouchableOpacity
          onPress={handleShare}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Share article"
        >
          <Ionicons
            name="share-outline"
            size={22}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (state.status === 'loading') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader(false)}
        <DetailShimmer />
      </View>
    );
  }

  if (state.status === 'missing') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader(false)}
        <View style={styles.missingCard}>
          <Ionicons
            name="document-outline"
            size={40}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.missingTitle}>Article not found</Text>
          <Text style={styles.missingBody}>
            This article is no longer available.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to articles"
          >
            <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
            <Text style={styles.backButtonLabel}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { post } = state;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader(true)}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {post.cover_image_url ? (
          <Image
            source={{ uri: post.cover_image_url }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons
              name="book-outline"
              size={40}
              color={Colors.textTertiary}
            />
          </View>
        )}

        <Text style={styles.title}>{post.title}</Text>
        {post.subtitle ? (
          <Text style={styles.subtitle}>{post.subtitle}</Text>
        ) : null}

        <View style={styles.bodyWrap}>
          <MarkdownBody markdown={post.body_markdown} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Markdown body ──────────────────────────────────────

function MarkdownBody({ markdown }: { markdown: string }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const options: useMarkdownHookOptions = {
    colorScheme,
    theme: {
      colors: {
        background: 'transparent',
        text: Colors.textPrimary,
        link: Colors.accent,
        border: Colors.hairlineBorder,
        code: Colors.cardSurface,
      },
    },
    styles: {
      paragraph: {
        marginVertical: Spacing.sm,
      },
      text: {
        color: Colors.textPrimary,
        fontSize: FontSizes.md,
        lineHeight: 24,
      },
      h1: {
        color: Colors.textPrimary,
        fontSize: FontSizes.xl,
        fontWeight: '800',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
      },
      h2: {
        color: Colors.textPrimary,
        fontSize: FontSizes.lg,
        fontWeight: '700',
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
      },
      h3: {
        color: Colors.textPrimary,
        fontSize: FontSizes.md,
        fontWeight: '700',
        marginTop: Spacing.md,
        marginBottom: 6,
      },
      link: {
        color: Colors.accent,
      },
    },
  };
  const elements = useMarkdown(markdown, options);

  // Defensive fallback — if marked produces nothing (malformed input),
  // fall back to plain Text so the user still sees something.
  if (!elements || elements.length === 0) {
    return <Text style={styles.fallbackBody}>{markdown}</Text>;
  }

  return (
    <>
      {elements.map((element, index) => (
        <Fragment key={`md-${index}`}>{element}</Fragment>
      ))}
    </>
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
    <View style={styles.shimmerWrap} testID="blog-detail-shimmer">
      <Animated.View style={[styles.shimmerCover, { opacity }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
      <Animated.View style={[styles.shimmerLineNarrow, { opacity }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity, marginTop: Spacing.lg }]} />
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
      <Animated.View style={[styles.shimmerLineNarrow, { opacity }]} />
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
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.cardSurface,
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
  bodyWrap: {
    marginTop: Spacing.lg,
  },
  fallbackBody: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    lineHeight: 24,
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
    height: 200,
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
    marginBottom: 6,
  },
});
