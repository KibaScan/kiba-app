// Kiba — Health Record Form Screen (D-163)
// Full-screen form for manually logging vaccinations and dewormings.
// Pattern mirrors MedicationFormScreen / CreateAppointmentScreen.
// Appointment-completion flow still uses HealthRecordLogSheet (contextual continuation).

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { addManualHealthRecord } from '../services/appointmentService';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { HealthRecordType } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'HealthRecordForm'>;

// ─── Types ──────────────────────────────────────────────

interface FollowUpOption {
  label: string;
  days: number | null; // null = no follow-up, -1 = custom
}

// ─── Constants ──────────────────────────────────────────

const VACCINATION_OPTIONS: FollowUpOption[] = [
  { label: '1 Year', days: 365 },
  { label: '3 Years', days: 1095 },
  { label: 'Custom', days: -1 },
  { label: 'No follow-up', days: null },
];

const DEWORMING_OPTIONS: FollowUpOption[] = [
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
  { label: 'Custom', days: -1 },
  { label: 'No follow-up', days: null },
];

// ─── Helpers ────────────────────────────────────────────

function formatDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ─── Component ──────────────────────────────────────────

export default function HealthRecordFormScreen({ navigation, route }: Props) {
  const defaultRecordType = route.params?.defaultRecordType ?? 'vaccination';
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);

  const [recordType, setRecordType] = useState<HealthRecordType>(defaultRecordType);
  const [treatmentName, setTreatmentName] = useState('');
  const [administeredAt, setAdministeredAt] = useState(new Date());
  const [showAdminDatePicker, setShowAdminDatePicker] = useState(false);
  const [vetName, setVetName] = useState('');

  // Follow-up
  const followUpOptions = recordType === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpOption>(followUpOptions[0]);
  const [customDate, setCustomDate] = useState(() => addDays(new Date(), 365));
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [saving, setSaving] = useState(false);

  // Reset follow-up default when record type changes
  React.useEffect(() => {
    const opts = recordType === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;
    setSelectedFollowUp(opts[0]);
  }, [recordType]);

  const chipTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleAdminDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowAdminDatePicker(false);
    if (date) setAdministeredAt(date);
  }, []);

  const handleCustomDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowCustomDatePicker(false);
    if (date) setCustomDate(date);
  }, []);

  const computeNextDueAt = useCallback((): string | null => {
    if (selectedFollowUp.days === null) return null;
    if (selectedFollowUp.days === -1) return toDateString(customDate);
    return toDateString(addDays(administeredAt, selectedFollowUp.days));
  }, [selectedFollowUp, administeredAt, customDate]);

  const handleSave = useCallback(async () => {
    if (!treatmentName.trim() || saving) return;
    setSaving(true);
    try {
      const petId = activePetId ?? pets[0]?.id;
      if (!petId) return;
      await addManualHealthRecord({
        pet_id: petId,
        record_type: recordType,
        treatment_name: treatmentName.trim(),
        administered_at: toDateString(administeredAt),
        next_due_at: computeNextDueAt(),
        vet_name: vetName.trim() || null,
        notes: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.goBack();
    } catch {
      // Best effort — toast could be added later
    } finally {
      setSaving(false);
    }
  }, [treatmentName, saving, activePetId, pets, recordType, administeredAt, vetName, computeNextDueAt, navigation]);

  const canSave = treatmentName.trim().length > 0 && !saving;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Health Record</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {(['vaccination', 'deworming'] as HealthRecordType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, recordType === t && styles.chipSelected]}
                onPress={() => { chipTap(); setRecordType(t); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, recordType === t && styles.chipTextSelected]}>
                  {t === 'vaccination' ? 'Vaccine' : 'Deworming'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Treatment name */}
          <Text style={styles.label}>
            {recordType === 'vaccination' ? 'Vaccine name' : 'Treatment name'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={recordType === 'vaccination' ? 'e.g., Rabies, DHPP' : 'e.g., Milbemax, Drontal'}
            placeholderTextColor={Colors.textTertiary}
            value={treatmentName}
            onChangeText={setTreatmentName}
            autoCapitalize="words"
          />

          {/* Date administered */}
          <Text style={styles.label}>Date administered</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowAdminDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            <Text style={styles.dateButtonText}>{formatDate(administeredAt)}</Text>
          </TouchableOpacity>
          {showAdminDatePicker && (
            <DateTimePicker
              value={administeredAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleAdminDateChange}
              maximumDate={new Date()}
              themeVariant="dark"
            />
          )}
          {Platform.OS === 'ios' && showAdminDatePicker && (
            <View style={styles.pickerActions}>
              <TouchableOpacity onPress={() => setShowAdminDatePicker(false)}>
                <Text style={styles.pickerActionText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Next due */}
          <Text style={styles.label}>Next due</Text>
          <View style={styles.chipRow}>
            {followUpOptions.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.chip, selectedFollowUp.label === opt.label && styles.chipSelected]}
                onPress={() => { chipTap(); setSelectedFollowUp(opt); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedFollowUp.label === opt.label && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom follow-up date */}
          {selectedFollowUp.days === -1 && (
            <>
              <TouchableOpacity
                style={[styles.dateButton, { marginTop: Spacing.sm }]}
                onPress={() => setShowCustomDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
                <Text style={styles.dateButtonText}>{formatDate(customDate)}</Text>
              </TouchableOpacity>
              {showCustomDatePicker && (
                <DateTimePicker
                  value={customDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleCustomDateChange}
                  minimumDate={new Date()}
                  themeVariant="dark"
                />
              )}
              {Platform.OS === 'ios' && showCustomDatePicker && (
                <View style={styles.pickerActions}>
                  <TouchableOpacity onPress={() => setShowCustomDatePicker(false)}>
                    <Text style={styles.pickerActionText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Vet / clinic */}
          <Text style={styles.label}>Vet / clinic</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor={Colors.textTertiary}
            value={vetName}
            onChangeText={setVetName}
          />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving...' : 'Save Record'}
            </Text>
          </TouchableOpacity>
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
    paddingBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
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
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  dateButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  pickerActions: {
    alignItems: 'flex-end',
    paddingVertical: Spacing.sm,
  },
  pickerActionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 88,
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
    opacity: 0.4,
  },
});
