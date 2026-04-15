// Kiba — Health Record Detail/Edit Sheet
// Bottom sheet for viewing, editing, and deleting individual health records.
// Opened from Medical Records card rows on PetHubScreen or MedicalRecordsScreen.

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
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { updateHealthRecord, deleteHealthRecord } from '../../services/appointmentService';
import { deleteConfirm } from '../../utils/haptics';
import type { PetHealthRecord, HealthRecordType } from '../../types/appointment';

// ─── Types ──────────────────────────────────────────────

interface FollowUpOption {
  label: string;
  days: number | null; // null = no follow-up, -1 = custom
}

interface Props {
  visible: boolean;
  record: PetHealthRecord | null;
  onClose: () => void;
  onUpdated: () => void; // Refresh parent list
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

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function matchFollowUpOption(
  administeredAt: string,
  nextDueAt: string | null,
  options: FollowUpOption[],
): FollowUpOption {
  if (!nextDueAt) return options.find((o) => o.days === null) ?? options[options.length - 1];
  const adminDate = parseDate(administeredAt);
  const dueDate = parseDate(nextDueAt);
  const diffDays = Math.round((dueDate.getTime() - adminDate.getTime()) / (1000 * 60 * 60 * 24));
  const match = options.find((o) => o.days === diffDays);
  if (match) return match;
  // Custom
  return options.find((o) => o.days === -1) ?? options[0];
}

// ─── Component ──────────────────────────────────────────

export default function HealthRecordDetailSheet({ visible, record, onClose, onUpdated }: Props) {
  // Form fields — initialized from record when sheet opens
  const [treatmentName, setTreatmentName] = useState('');
  const [administeredAt, setAdministeredAt] = useState(new Date());
  const [showAdminDatePicker, setShowAdminDatePicker] = useState(false);
  const [vetName, setVetName] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpOption>({ label: '1 Year', days: 365 });
  const [customDate, setCustomDate] = useState(() => addDays(new Date(), 365));
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reset state when sheet opens with a new record
  React.useEffect(() => {
    if (visible && record) {
      setTreatmentName(record.treatment_name);
      setAdministeredAt(parseDate(record.administered_at));
      setVetName(record.vet_name ?? '');
      const opts = record.record_type === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;
      const matched = matchFollowUpOption(record.administered_at, record.next_due_at, opts);
      setSelectedFollowUp(matched);
      if (record.next_due_at && matched.days === -1) {
        setCustomDate(parseDate(record.next_due_at));
      } else {
        setCustomDate(addDays(new Date(), 365));
      }
      setSaving(false);
      setIsDirty(false);
      setShowAdminDatePicker(false);
      setShowCustomDatePicker(false);
    }
  }, [visible, record]);

  const chipTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleAdminDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowAdminDatePicker(false);
    if (date) { setAdministeredAt(date); markDirty(); }
  }, [markDirty]);

  const handleCustomDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowCustomDatePicker(false);
    if (date) { setCustomDate(date); markDirty(); }
  }, [markDirty]);

  const computeNextDueAt = useCallback((): string | null => {
    if (selectedFollowUp.days === null) return null;
    if (selectedFollowUp.days === -1) return toDateString(customDate);
    return toDateString(addDays(administeredAt, selectedFollowUp.days));
  }, [selectedFollowUp, administeredAt, customDate]);

  const followUpOptions = record?.record_type === 'deworming' ? DEWORMING_OPTIONS : VACCINATION_OPTIONS;

  const handleSave = useCallback(async () => {
    if (!record || !treatmentName.trim()) return;
    setSaving(true);
    try {
      await updateHealthRecord(record.id, {
        treatment_name: treatmentName.trim(),
        administered_at: toDateString(administeredAt),
        next_due_at: computeNextDueAt(),
        vet_name: vetName.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update health record:', error);
      Alert.alert('Error', 'Failed to update record. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [record, treatmentName, administeredAt, computeNextDueAt, vetName, onUpdated, onClose]);

  const handleDelete = useCallback(() => {
    if (!record) return;
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete "${record.treatment_name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteHealthRecord(record.id);
              deleteConfirm();
              onUpdated();
              onClose();
            } catch (error) {
              console.error('Failed to delete health record:', error);
              Alert.alert('Error', 'Failed to delete record. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [record, onUpdated, onClose]);

  if (!record) return null;

  const typeLabel = record.record_type === 'vaccination' ? 'Vaccine' : 'Deworming';
  const typeIcon = record.record_type === 'vaccination' ? 'shield-checkmark-outline' : 'fitness-outline';
  const canSave = treatmentName.trim().length > 0 && !saving && isDirty;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.sheetContainer}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type indicator (read-only) */}
            <View style={styles.typeRow}>
              <Ionicons name={typeIcon as any} size={18} color={Colors.textTertiary} />
              <Text style={styles.typeLabel}>{typeLabel}</Text>
            </View>

            {/* Treatment name */}
            <Text style={styles.label}>
              {record.record_type === 'vaccination' ? 'Vaccine name' : 'Treatment name'}
            </Text>
            <TextInput
              style={styles.input}
              value={treatmentName}
              onChangeText={(v) => { setTreatmentName(v); markDirty(); }}
              placeholderTextColor={Colors.textTertiary}
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
                  onPress={() => { chipTap(); setSelectedFollowUp(opt); markDirty(); }}
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
              onChangeText={(v) => { setVetName(v); markDirty(); }}
            />

            {/* Actions */}
            {canSave && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={saving}
              activeOpacity={0.6}
            >
              <Text style={styles.deleteButtonText}>Delete Record</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.6}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

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
    backgroundColor: Colors.cardSurface,
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
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderColor: Colors.hairlineBorder,
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
    borderColor: Colors.hairlineBorder,
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
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
