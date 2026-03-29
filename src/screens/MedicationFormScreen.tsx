// Kiba — Medication Form Screen (M6)
// Add/edit a medication for a pet. Display-only — does NOT influence scoring.
// D-095: "Medications" not "Prescriptions". No prescriptive language.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  createMedication,
  updateMedication,
  deleteMedication,
} from '../services/petService';
import type { PetMedication } from '../types/pet';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'MedicationForm'>;

type MedStatus = 'current' | 'past' | 'as_needed';

const STATUS_OPTIONS: { value: MedStatus; label: string }[] = [
  { value: 'current', label: 'Current' },
  { value: 'past', label: 'Past' },
  { value: 'as_needed', label: 'As Needed' },
];

export default function MedicationFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { petId, petName, medication, conditions } = route.params;
  const isEdit = !!medication;

  const [name, setName] = useState(medication?.medication_name ?? '');
  const [status, setStatus] = useState<MedStatus>(medication?.status ?? 'current');
  const [dosage, setDosage] = useState(medication?.dosage ?? '');
  const [prescribedFor, setPrescribedFor] = useState(medication?.prescribed_for ?? '');
  const [notes, setNotes] = useState(medication?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function handleSave() {
    if (savingRef.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Medication name is required');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        medication_name: trimmedName,
        status,
        dosage: dosage.trim() || null,
        started_at: medication?.started_at ?? null,
        ended_at: medication?.ended_at ?? null,
        prescribed_for: prescribedFor || null,
        notes: notes.trim() || null,
      };

      if (isEdit && medication) {
        await updateMedication(medication.id, payload);
      } else {
        await createMedication(petId, payload);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  function handleDelete() {
    if (!medication) return;
    Alert.alert(
      'Delete Medication',
      `Remove ${medication.medication_name} from ${petName}'s medications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(medication.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', (err as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit Medication' : 'Add Medication'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication name */}
          <Text style={styles.label}>Medication name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Methimazole, Apoquel"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  status === opt.value && styles.chipSelected,
                ]}
                onPress={() => setStatus(opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    status === opt.value && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dosage */}
          <Text style={styles.label}>Dosage (optional)</Text>
          <TextInput
            style={styles.input}
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g., 1 tablet daily, 0.5ml twice daily"
            placeholderTextColor={Colors.textTertiary}
          />

          {/* Prescribed for */}
          {conditions.length > 0 && (
            <>
              <Text style={styles.label}>Linked condition (optional)</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    !prescribedFor && styles.chipSelected,
                  ]}
                  onPress={() => setPrescribedFor('')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      !prescribedFor && styles.chipTextSelected,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                {conditions.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    style={[
                      styles.chip,
                      prescribedFor === cond && styles.chipSelected,
                    ]}
                    onPress={() => setPrescribedFor(cond)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        prescribedFor === cond && styles.chipTextSelected,
                      ]}
                    >
                      {cond.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isEdit ? 'Save Changes' : 'Add Medication'}
              </Text>
            )}
          </TouchableOpacity>

          {isEdit && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteButtonText}>Delete Medication</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: Colors.accent + '20',
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    color: Colors.severityRed,
    fontWeight: '600',
  },
});
