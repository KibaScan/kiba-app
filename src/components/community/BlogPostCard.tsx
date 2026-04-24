// Kiba — M9 Community BlogPostCard (Task 26)
// Compact card used by BlogCarousel (horizontal) and BlogListScreen (vertical
// full-width). Same visual recipe both places — only the outer card width
// changes via the `width` prop.
//
// Cover image is full-bleed across the top with rounded corners; falls back to
// a tinted placeholder block (Ionicons book glyph) when the post lacks one.

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { BlogPost } from '../../services/blogService';

interface Props {
  post: BlogPost;
  onPress: () => void;
  /**
   * Optional override style. Carousel passes a fixed width; list omits this
   * so the card stretches to its parent's width.
   */
  style?: StyleProp<ViewStyle>;
}

export function BlogPostCard({ post, onPress, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        post.subtitle
          ? `Article: ${post.title}. ${post.subtitle}`
          : `Article: ${post.title}`
      }
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
            size={32}
            color={Colors.textTertiary}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {post.title}
        </Text>
        {post.subtitle ? (
          <Text
            style={styles.subtitle}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {post.subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.background,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.md,
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
});
