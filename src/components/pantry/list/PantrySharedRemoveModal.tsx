// Kiba — PantrySharedRemoveModal
// Bottom-sheet for removing a pantry item shared across multiple pets.
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
import { BlurView } from 'expo-blur';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../../utils/constants';
import type { PantryCardData } from '../../../types/pantry';

type Props = {
  item: PantryCardData | null;
  petName: string;
  onRemoveAll: () => void;
  onRemovePetOnly: () => void;
  onCancel: () => void;
};

export function PantrySharedRemoveModal({ item, petName, onRemoveAll, onRemovePetOnly, onCancel }: Props) {
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <BlurView intensity={30} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.modalSheet}>
        <View style={styles.dragHandle} />
        <Text style={styles.modalTitle}>Remove Item</Text>
        <Text style={styles.modalSubtitle}>
          {item?.product.name} is shared with multiple pets.
        </Text>
        <TouchableOpacity
          style={styles.modalOption}
          onPress={onRemoveAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.modalOptionText, { color: SEVERITY_COLORS.danger }]}>
            Remove for all pets
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modalOption}
          onPress={onRemovePetOnly}
          activeOpacity={0.7}
        >
          <Text style={styles.modalOptionText}>
            Remove for {petName} only
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modalOption}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={[styles.modalOptionText, { color: Colors.textTertiary }]}>Cancel</Text>
        </TouchableOpacity>
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
  modalSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 22,
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
