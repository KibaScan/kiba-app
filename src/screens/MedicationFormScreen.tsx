// Kiba — Medication Form Screen (M6/M9)
// Add/edit a medication for a pet. Display-only — does NOT influence scoring.
// D-095: "Medications" not "Prescriptions". No prescriptive language.
// M9: Added reminder times (up to 4 daily) and duration (preset chips + custom).

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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  createMedication,
  updateMedication,
  deleteMedication,
} from '../services/petService';
import { rescheduleAllMedications } from '../services/medicationNotificationScheduler';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'MedicationForm'>;

type MedStatus = 'current' | 'past' | 'as_needed';

const STATUS_OPTIONS: { value: MedStatus; label: string }[] = [
  { value: 'current', label: 'Current' },
  { value: 'past', label: 'Past' },
  { value: 'as_needed', label: 'As Needed' },
];

const DURATION_PRESETS = [7, 14, 30, 90] as const;
const MAX_REMINDERS = 4;

// ─── Helpers ────────────────────────────────────────────

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

function dateToHHMM(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ─── Component ──────────────────────────────────────────

export default function MedicationFormScreen({ navigation, route }: Props) {
  const { petId, petName, medication, conditions } = route.params;
  const isEdit = !!medication;

  const [name, setName] = useState(medication?.medication_name ?? '');
  const [status, setStatus] = useState<MedStatus>(medication?.status ?? 'current');
  const [dosage, setDosage] = useState(medication?.dosage ?? '');
  const [prescribedFor, setPrescribedFor] = useState(medication?.prescribed_for ?? '');
  const [notes, setNotes] = useState(medication?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Reminders state
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    medication?.reminder_times ?? [],
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Duration state
  const initDuration = medication?.duration_days;
  const [durationDays, setDurationDays] = useState<number | null>(initDuration ?? null);
  const [durationMode, setDurationMode] = useState<'preset' | 'custom' | 'ongoing'>(
    initDuration == null
      ? 'ongoing'
      : DURATION_PRESETS.includes(initDuration as any)
        ? 'preset'
        : 'custom',
  );
  const [customDaysText, setCustomDaysText] = useState(
    initDuration != null && !DURATION_PRESETS.includes(initDuration as any)
      ? String(initDuration)
      : '',
  );

  const showReminders = status === 'current' || status === 'as_needed';

  // ─── Reminder handlers ──────────────────────────────

  function handleAddReminder() {
    setEditingTimeIndex(null);
    setPickerDate(new Date());
    setShowTimePicker(true);
  }

  function handleEditReminder(index: number) {
    setEditingTimeIndex(index);
    setPickerDate(hhmmToDate(reminderTimes[index]));
    setShowTimePicker(true);
  }

  function handleRemoveReminder(index: number) {
    setReminderTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTimePickerChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!date) return;
    const hhmm = dateToHHMM(date);
    setPickerDate(date);

    if (editingTimeIndex != null) {
      setReminderTimes((prev) => prev.map((t, i) => (i === editingTimeIndex ? hhmm : t)));
    } else {
      setReminderTimes((prev) => [...prev, hhmm]);
    }
    if (Platform.OS === 'ios') return;
  }

  function confirmTimePicker() {
    setShowTimePicker(false);
    const hhmm = dateToHHMM(pickerDate);
    if (editingTimeIndex != null) {
      setReminderTimes((prev) => prev.map((t, i) => (i === editingTimeIndex ? hhmm : t)));
    } else if (reminderTimes.length < MAX_REMINDERS) {
      setReminderTimes((prev) => [...prev, hhmm]);
    }
  }

  // ─── Duration handlers ──────────────────────────────

  function handlePresetDuration(days: number) {
    setDurationMode('preset');
    setDurationDays(days);
    setCustomDaysText('');
  }

  function handleOngoing() {
    setDurationMode('ongoing');
    setDurationDays(null);
    setCustomDaysText('');
  }

  function handleCustomDuration(text: string) {
    setCustomDaysText(text);
    setDurationMode('custom');
    const parsed = parseInt(text, 10);
    setDurationDays(parsed > 0 ? parsed : null);
  }

  // ─── Save / Delete ──────────────────────────────────

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
        reminder_times: showReminders ? reminderTimes : [],
        duration_days: showReminders ? durationDays : null,
        notes: notes.trim() || null,
      };

      if (isEdit && medication) {
        await updateMedication(medication.id, payload);
      } else {
        await createMedication(petId, payload);
      }
      rescheduleAllMedications().catch(() => {});
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
              rescheduleAllMedications().catch(() => {});
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

          {/* Reminders — only for current / as_needed */}
          {showReminders && (
            <>
              <Text style={styles.label}>Reminders (optional)</Text>
              {reminderTimes.map((time, index) => (
                <View key={`${time}-${index}`} style={styles.reminderRow}>
                  <TouchableOpacity
                    style={styles.reminderTime}
                    onPress={() => handleEditReminder(index)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="alarm-outline" size={16} color={Colors.accent} />
                    <Text style={styles.reminderTimeText}>{formatTime(time)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveReminder(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
              {reminderTimes.length < MAX_REMINDERS && (
                <TouchableOpacity
                  style={styles.addReminderLink}
                  onPress={handleAddReminder}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
                  <Text style={styles.addReminderText}>Add Reminder</Text>
                </TouchableOpacity>
              )}
              {reminderTimes.length >= MAX_REMINDERS && (
                <Text style={styles.reminderCapText}>Maximum 4 reminders</Text>
              )}

              {/* iOS inline time picker */}
              {showTimePicker && Platform.OS === 'ios' && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="time"
                    display="spinner"
                    onChange={(_e, date) => { if (date) setPickerDate(date); }}
                    textColor={Colors.textPrimary}
                  />
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmTimePicker}>
                      <Text style={styles.pickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Duration */}
              <Text style={styles.label}>Duration (optional)</Text>
              <View style={styles.chipRow}>
                {DURATION_PRESETS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.chip,
                      durationMode === 'preset' && durationDays === days && styles.chipSelected,
                    ]}
                    onPress={() => handlePresetDuration(days)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        durationMode === 'preset' && durationDays === days && styles.chipTextSelected,
                      ]}
                    >
                      {days} days
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    durationMode === 'ongoing' && styles.chipSelected,
                  ]}
                  onPress={handleOngoing}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      durationMode === 'ongoing' && styles.chipTextSelected,
                    ]}
                  >
                    Ongoing
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.customDurationRow}>
                <Text style={styles.customDurationLabel}>Custom:</Text>
                <TextInput
                  style={styles.customDurationInput}
                  value={customDaysText}
                  onChangeText={handleCustomDuration}
                  placeholder="days"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </>
          )}

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
        <View style={[styles.footer, { paddingBottom: 88 }]}>
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

        {/* Android time picker modal */}
        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="default"
            onChange={handleTimePickerChange}
          />
        )}
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
  // Reminders
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  reminderTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reminderTimeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  addReminderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  addReminderText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  reminderCapText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  pickerContainer: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  pickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  pickerCancel: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pickerDone: {
    fontSize: FontSizes.md,
    color: Colors.accent,
    fontWeight: '600',
  },
  // Duration
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  customDurationLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  customDurationInput: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    width: 80,
    textAlign: 'center',
  },
  // Footer
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
