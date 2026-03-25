// Kiba — Settings Screen
// Extracted from PetHubScreen (Part 1 structural cleanup).
// App-level settings: Notifications, Subscription, About Kiba. Delete pet.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { deleteConfirm } from '../utils/haptics';
import { deletePet } from '../services/petService';
import { canDeletePet } from '../utils/petFormValidation';
import { useActivePetStore } from '../stores/useActivePetStore';
import DevMenu from '../components/ui/DevMenu';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'Settings'>;

// ─── Settings Row ───────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  isLast,
  onPress,
}: {
  icon: string;
  label: string;
  isLast?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingsRow, isLast && styles.settingsRowLast]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={Colors.textSecondary}
      />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Component ──────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);
  const activePet = pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;

  // Delete modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Dev menu (tap version 5 times)
  const [devMenuVisible, setDevMenuVisible] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);

  async function handleDelete() {
    if (!activePet) return;
    setDeleting(true);
    try {
      deleteConfirm();
      await deletePet(activePet.id);
      setDeleteModalVisible(false);
      setDeleteInput('');

      const remaining = useActivePetStore.getState().pets;
      if (remaining.length === 0) {
        navigation.navigate('SpeciesSelect');
      } else {
        navigation.navigate('MeMain');
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          onPress={() => navigation.navigate('NotificationPreferences')}
        />
        <SettingsRow icon="shield-checkmark-outline" label="Subscription" />
        <SettingsRow icon="information-circle-outline" label="About Kiba" isLast />

        {/* Delete pet */}
        {activePet && (
          <TouchableOpacity
            style={styles.deleteRow}
            activeOpacity={0.6}
            onPress={() => { setDeleteInput(''); setDeleteModalVisible(true); }}
          >
            <Ionicons name="trash-outline" size={22} color={Colors.severityRed} />
            <Text style={styles.deleteLabel}>Delete {activePet.name}</Text>
          </TouchableOpacity>
        )}

        {/* Version footer — tap 5 times for dev menu */}
        <TouchableOpacity
          style={styles.versionFooter}
          activeOpacity={0.6}
          onPress={() => {
            if (!__DEV__) return;
            const next = devTapCount + 1;
            if (next >= 5) {
              setDevMenuVisible(true);
              setDevTapCount(0);
            } else {
              setDevTapCount(next);
              setTimeout(() => setDevTapCount(0), 2000);
            }
          }}
        >
          <Text style={styles.versionText}>Kiba v1.0.0</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Dev menu (__DEV__ only) */}
      {__DEV__ && (
        <DevMenu
          visible={devMenuVisible}
          onClose={() => setDevMenuVisible(false)}
        />
      )}

      {/* Delete confirmation modal */}
      {activePet && (
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete {activePet.name}?</Text>
              <Text style={styles.modalBody}>
                This will permanently remove {activePet.name}'s profile, health
                conditions, and allergens. This cannot be undone.
              </Text>
              <Text style={styles.modalInstruction}>
                Type{' '}
                <Text style={styles.modalPetName}>{activePet.name}</Text> to confirm
              </Text>
              <TextInput
                style={styles.modalInput}
                value={deleteInput}
                onChangeText={setDeleteInput}
                placeholder={activePet.name}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setDeleteModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirm,
                    !canDeletePet(deleteInput, activePet.name) && styles.modalConfirmDisabled,
                  ]}
                  onPress={handleDelete}
                  disabled={!canDeletePet(deleteInput, activePet.name) || deleting}
                  activeOpacity={0.7}
                >
                  {deleting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  settingsLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
    marginTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  deleteLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.severityRed,
  },
  versionFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xl,
  },
  versionText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },

  // ─── Delete Modal ──────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  modalInstruction: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalPetName: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.severityRed,
  },
  modalConfirmDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
