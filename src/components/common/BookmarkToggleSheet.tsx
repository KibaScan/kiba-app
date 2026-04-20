// Bookmark toggle sheet — long-press context menu for scan rows.
// Presents a single Bookmark / Unbookmark action. Matches ResultHeaderMenu aesthetic.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../utils/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  isBookmarked: boolean;
  onToggle: () => void;
}

export function BookmarkToggleSheet({ visible, onClose, isBookmarked, onToggle }: Props) {
  const insets = useSafeAreaInsets();
  const handle = () => {
    onToggle();
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={handle}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={Colors.accent}
            />
            <Text style={styles.label}>{isBookmarked ? 'Unbookmark' : 'Bookmark'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemPressed: { backgroundColor: Colors.pressOverlay },
  label: { color: Colors.textPrimary, fontSize: 17, fontWeight: '500' },
});
