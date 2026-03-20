// Kiba — Health Record Log Sheet (D-163)
// Bottom sheet for logging vaccination/deworming records on appointment completion.
// Also supports manual mode (no appointment context) for PetHubScreen "Add Record".

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import {
  logHealthRecord,
  addManualHealthRecord,
  completeAppointment,
} from '../../services/appointmentService';
import { useActivePetStore } from '../../stores/useActivePetStore';
import type { Appointment, HealthRecordType } from '../../types/appointment';

// ─── Types ──────────────────────────────────────────────

interface FollowUpOption {
  label: string;
  days: number | null; // null = no follow-up, -1 = custom
}

interface Props {
  visible: boolean;
  appointment: Appointment | null; // null = manual mode
  petNames: Map<string, string>;
  onComplete: () => void;
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

export default function HealthRecordLogSheet({ visible, appointment, petNames, onComplete }: Props) {
  const isManual = appointment === null;
  const activePetId = useActivePetStore((s) => s.activePetId);

  // Record type (only selectable in manual mode)
  const [recordType, setRecordType] = useState<HealthRecordType>(
    appointment?.type === 'deworming' ? 'deworming' : 'vaccination',
  );

  // Form fields
  const [treatmentName, setTreatmentName] = useState(
    isManual ? '' : (appointment?.notes ?? ''),
  );
  const [administeredAt, setAdministeredAt] = useState(new Date());
  const [showAdminDatePicker, setShowAdminDatePicker] = useState(false);
  const [vetName, setVetName] = useState(
    isManual ? '' : (appointment?.location ?? ''),
  );

  // Follow-up
  const followUpOptions = recordType === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;
  const defaultOption = followUpOptions[0];
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpOption>(defaultOption);
  const [customDate, setCustomDate] = useState(() => addDays(new Date(), 365));
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [saving, setSaving] = useState(false);

  // Reset state when sheet opens
  React.useEffect(() => {
    if (visible) {
      const type: HealthRecordType = appointment?.type === 'deworming' ? 'deworming' : 'vaccination';
      setRecordType(type);
      setTreatmentName(isManual ? '' : (appointment?.notes ?? ''));
      setAdministeredAt(new Date());
      setVetName(isManual ? '' : (appointment?.location ?? ''));
      const opts = type === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;
      setSelectedFollowUp(opts[0]);
      setCustomDate(addDays(new Date(), 365));
      setSaving(false);
    }
  }, [visible, appointment, isManual]);

  // Update follow-up options when record type changes in manual mode
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
    if (selectedFollowUp.days === null) return null; // no follow-up
    if (selectedFollowUp.days === -1) return toDateString(customDate); // custom
    return toDateString(addDays(administeredAt, selectedFollowUp.days));
  }, [selectedFollowUp, administeredAt, customDate]);

  const handleLog = useCallback(async () => {
    if (!treatmentName.trim()) return;
    setSaving(true);
    try {
      const nextDueAt = computeNextDueAt();
      const data = {
        record_type: recordType,
        treatment_name: treatmentName.trim(),
        administered_at: toDateString(administeredAt),
        next_due_at: nextDueAt,
        vet_name: vetName.trim() || null,
        notes: null,
      };

      if (isManual) {
        const petId = activePetId ?? useActivePetStore.getState().pets[0]?.id;
        if (!petId) return;
        await addManualHealthRecord({ ...data, pet_id: petId });
      } else {
        await logHealthRecord(appointment!.id, data, appointment!.pet_ids);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete();
    } catch {
      // Best effort
    } finally {
      setSaving(false);
    }
  }, [treatmentName, recordType, administeredAt, vetName, computeNextDueAt, isManual, appointment, activePetId, onComplete]);

  const handleSkip = useCallback(async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      await completeAppointment(appointment.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete();
    } catch {
      // Best effort
    } finally {
      setSaving(false);
    }
  }, [appointment, onComplete]);

  // Resolve pet names for display
  const petNameList = appointment
    ? appointment.pet_ids.map((id) => petNames.get(id) ?? 'Unknown').join(', ')
    : null;

  const title = isManual
    ? 'Add Health Record'
    : recordType === 'deworming'
      ? 'Log this deworming?'
      : 'Log this vaccine?';

  const buttonLabel = isManual
    ? 'Save Record'
    : recordType === 'deworming'
      ? 'Log Deworming'
      : 'Log Vaccine';

  const canSave = treatmentName.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={isManual ? onComplete : undefined}>
      <Pressable style={styles.overlay} onPress={isManual ? onComplete : undefined}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.sheetContainer}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>

            {/* Manual mode: record type toggle */}
            {isManual && (
              <>
                <Text style={styles.label}>Type</Text>
                <View style={styles.chipRow}>
                  {(['vaccination', 'deworming'] as HealthRecordType[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, recordType === t && styles.chipActive]}
                      onPress={() => { chipTap(); setRecordType(t); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, recordType === t && styles.chipTextActive]}>
                        {t === 'vaccination' ? 'Vaccine' : 'Deworming'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

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
                  style={[styles.chip, selectedFollowUp.label === opt.label && styles.chipActive]}
                  onPress={() => { chipTap(); setSelectedFollowUp(opt); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedFollowUp.label === opt.label && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom date picker */}
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

            {/* Pets (read-only in completion mode) */}
            {petNameList && (
              <>
                <Text style={styles.label}>Pets</Text>
                <View style={styles.petsDisplay}>
                  <Ionicons name="paw-outline" size={16} color={Colors.accent} />
                  <Text style={styles.petsText}>{petNameList}</Text>
                </View>
              </>
            )}

            {/* Actions */}
            <TouchableOpacity
              style={[styles.logButton, !canSave && styles.logButtonDisabled]}
              onPress={handleLog}
              disabled={!canSave}
              activeOpacity={0.7}
            >
              <Text style={styles.logButtonText}>
                {saving ? 'Saving...' : buttonLabel}
              </Text>
            </TouchableOpacity>

            {!isManual && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={saving}
                activeOpacity={0.6}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}

            {isManual && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={onComplete}
                disabled={saving}
                activeOpacity={0.6}
              >
                <Text style={styles.skipButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textPrimary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
  petsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  petsText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  logButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logButtonDisabled: {
    opacity: 0.4,
  },
  logButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  skipButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
