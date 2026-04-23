// Kiba — PantrySortModal
// Bottom-sheet modal for pantry sort order selection.
// Extracted from PantryScreen.tsx — zero behavior change.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import type { SortOption } from '../../../utils/pantryScreenHelpers';

// ─── Constants ──────────────────────────────────────────

export const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'score', label: 'Score (high to low)' },
  { key: 'days_remaining', label: 'Days remaining (urgent first)' },
];

// ─── Component ──────────────────────────────────────────

type Props = {
  visible: boolean;
  activeSort: SortOption;
  onSelect: (sort: SortOption) => void;
  onClose: () => void;
};

export function PantrySortModal({ visible, activeSort, onSelect, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <BlurView intensity={30} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.modalSheet}>
        <View style={styles.dragHandle} />
        <Text style={styles.modalTitle}>Sort By</Text>
        {SORT_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.key}
            style={styles.modalOption}
            onPress={() => { onSelect(option.key); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.modalOptionText,
              activeSort === option.key && { color: Colors.accent },
            ]}>
              {option.label}
            </Text>
            {activeSort === option.key && (
              <Ionicons name="checkmark" size={18} color={Colors.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    opacity: 0.3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
  },
  modalOptionText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
});
