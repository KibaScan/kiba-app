// Kiba — M9 Community SubredditFooter
// Pressable footer at the bottom of CommunityScreen — invites users to the
// official subreddit. Subtle, smaller text scale than card content.
// D-084: Ionicons only (chevron).

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

const SUBREDDIT_URL = 'https://reddit.com/r/kibascan';

export function SubredditFooter() {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => { Linking.openURL(SUBREDDIT_URL).catch(() => {}); }}
      activeOpacity={0.6}
      accessibilityRole="link"
      accessibilityLabel="r/kibascan — Join the subreddit"
    >
      <Text style={styles.text}>r/kibascan — Join the subreddit</Text>
      <Ionicons
        name="chevron-forward"
        size={14}
        color={Colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.lg,
  },
  text: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
