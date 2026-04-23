// DeletePetModal — typed-name confirmation modal for pet deletion.
// Parent owns all state; this component is pure presentation + callbacks.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';

interface Props {
  visible: boolean;
  petDisplayName: string;
  deleteInput: string;
  setDeleteInput: (v: string) => void;
  canConfirmDelete: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeletePetModal({
  visible,
  petDisplayName,
  deleteInput,
  setDeleteInput,
  canConfirmDelete,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.deleteOverlay}>
        <View style={styles.deleteModal}>
          <Text style={styles.deleteTitle}>Delete {petDisplayName}?</Text>
          <Text style={styles.deleteDescription}>
            This will permanently delete {petDisplayName} and all associated scan
            history. This cannot be undone. Type{' '}
            <Text style={styles.deleteBold}>{petDisplayName}</Text> to confirm.
          </Text>
          <TextInput
            style={styles.deleteInput}
            placeholder={petDisplayName}
            placeholderTextColor={Colors.textTertiary}
            value={deleteInput}
            onChangeText={setDeleteInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.deleteActions}>
            <TouchableOpacity
              style={styles.deleteCancelButton}
              onPress={onCancel}
            >
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteConfirmButton,
                !canConfirmDelete && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={!canConfirmDelete}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.deleteConfirmText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  deleteModal: {
    width: '100%',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  deleteTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  deleteDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  deleteBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deleteInput: {
    height: 48,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  deleteCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  deleteCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deleteConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.severityRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteConfirmText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
