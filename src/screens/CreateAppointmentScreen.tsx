// Kiba — Create Appointment Screen (D-103)
// Form: type chips, date/time picker, pet multi-select, location, notes, reminder, recurring.

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
  Image,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { createAppointment } from '../services/appointmentService';
import { rescheduleAllAppointments } from '../services/appointmentNotificationScheduler';
import { supabase } from '../services/supabase';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { AppointmentType, ReminderOption, RecurringOption } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'CreateAppointment'>;

// ─── Constants ──────────────────────────────────────────

const TYPE_OPTIONS: { value: AppointmentType; label: string; icon: string }[] = [
  { value: 'vet_visit', label: 'Vet Visit', icon: 'medical-outline' },
  { value: 'grooming', label: 'Grooming', icon: 'cut-outline' },
  { value: 'medication', label: 'Medication', icon: 'medkit-outline' },
  { value: 'vaccination', label: 'Vaccination', icon: 'shield-checkmark-outline' },
  { value: 'deworming', label: 'Deworming', icon: 'fitness-outline' },
  { value: 'other', label: 'Other', icon: 'calendar-outline' },
];

const REMINDER_OPTIONS: { value: ReminderOption; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '1_hour', label: '1 Hour' },
  { value: '1_day', label: '1 Day' },
  { value: '3_days', label: '3 Days' },
  { value: '1_week', label: '1 Week' },
];

const RECURRING_OPTIONS: { value: RecurringOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: '6 Months' },
  { value: 'yearly', label: 'Yearly' },
];

// ─── Helpers ────────────────────────────────────────────

function formatDateTime(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? `0${m}` : String(m);
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${hour12}:${minStr} ${ampm}`;
}

// ─── Component ──────────────────────────────────────────

export default function CreateAppointmentScreen() {
  const navigation = useNavigation<Nav>();
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);

  const [type, setType] = useState<AppointmentType | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(
    activePetId ? [activePetId] : pets.length > 0 ? [pets[0].id] : [],
  );
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState<ReminderOption>('1_day');
  const [recurring, setRecurring] = useState<RecurringOption>('none');
  const [saving, setSaving] = useState(false);

  const canSave = type !== null && selectedPetIds.length > 0 && !saving;

  const chipTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const togglePet = useCallback((petId: string) => {
    chipTap();
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  }, [chipTap]);

  const handleDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      setScheduledAt((prev) => {
        if (datePickerMode === 'date') {
          const next = new Date(prev);
          next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
          return next;
        }
        const next = new Date(prev);
        next.setHours(date.getHours(), date.getMinutes());
        return next;
      });
      // On Android: after picking date, show time picker
      if (Platform.OS === 'android' && datePickerMode === 'date') {
        setTimeout(() => {
          setDatePickerMode('time');
          setShowDatePicker(true);
        }, 100);
      }
    }
  }, [datePickerMode]);

  const openDatePicker = useCallback(() => {
    setDatePickerMode('date');
    setShowDatePicker(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!type || selectedPetIds.length === 0) return;
    setSaving(true);
    try {
      await createAppointment({
        type,
        custom_label: type === 'other' ? customLabel || undefined : undefined,
        scheduled_at: scheduledAt.toISOString(),
        pet_ids: selectedPetIds,
        location: location || undefined,
        notes: notes || undefined,
        reminder,
        recurring,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        rescheduleAllAppointments(session.user.id).catch(() => {});
      }
      navigation.goBack();
    } catch {
      // Best effort — toast could be added later
    } finally {
      setSaving(false);
    }
  }, [type, customLabel, scheduledAt, selectedPetIds, location, notes, reminder, recurring, navigation]);

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
          <Text style={styles.headerTitle}>New Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type */}
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
                onPress={() => { chipTap(); setType(opt.value); }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={type === opt.value ? Colors.textPrimary : Colors.textSecondary}
                />
                <Text style={[styles.typeChipText, type === opt.value && styles.typeChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {type === 'other' && (
            <TextInput
              style={styles.input}
              placeholder="Label (e.g., Dental cleaning)"
              placeholderTextColor={Colors.textTertiary}
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          )}

          {/* Date & Time */}
          <Text style={styles.sectionLabel}>Date & Time</Text>
          <TouchableOpacity style={styles.dateButton} onPress={openDatePicker} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            <Text style={styles.dateButtonText}>{formatDateTime(scheduledAt)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={scheduledAt}
              mode={datePickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
              themeVariant="dark"
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.pickerActions}>
              <TouchableOpacity onPress={() => {
                if (datePickerMode === 'date') {
                  setDatePickerMode('time');
                } else {
                  setShowDatePicker(false);
                }
              }}>
                <Text style={styles.pickerActionText}>
                  {datePickerMode === 'date' ? 'Set Time' : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pets */}
          <Text style={styles.sectionLabel}>Pets</Text>
          <View style={styles.card}>
            {pets.map((pet) => {
              const selected = selectedPetIds.includes(pet.id);
              return (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.petRow}
                  onPress={() => togglePet(pet.id)}
                  activeOpacity={0.6}
                >
                  {pet.photo_url ? (
                    <Image source={{ uri: pet.photo_url }} style={styles.petPhoto} />
                  ) : (
                    <View style={[styles.petPhoto, styles.petPhotoPlaceholder]}>
                      <Ionicons name="paw-outline" size={16} color={Colors.textTertiary} />
                    </View>
                  )}
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? Colors.accent : Colors.textTertiary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Location & Notes */}
          <Text style={styles.sectionLabel}>Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Location (optional)"
            placeholderTextColor={Colors.textTertiary}
            value={location}
            onChangeText={setLocation}
          />
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes (optional)"
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Reminder */}
          <Text style={styles.sectionLabel}>Reminder</Text>
          <View style={styles.chipRow}>
            {REMINDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, reminder === opt.value && styles.chipActive]}
                onPress={() => { chipTap(); setReminder(opt.value); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, reminder === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recurring */}
          <Text style={styles.sectionLabel}>Recurring</Text>
          <View style={styles.chipRow}>
            {RECURRING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, recurring === opt.value && styles.chipActive]}
                onPress={() => { chipTap(); setRecurring(opt.value); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, recurring === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Scheduling...' : 'Schedule'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.cardBorder,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 24 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  typeChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  typeChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: Colors.textPrimary,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.card,
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
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.cardBorder,
    borderBottomWidth: 1,
  },
  petPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: Spacing.md,
  },
  petPhotoPlaceholder: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petName: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: Spacing.sm,
  },
  notesInput: {
    minHeight: 80,
    marginTop: Spacing.sm,
  },
  bottomSpacer: { height: 24 },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopColor: Colors.cardBorder,
    borderTopWidth: 1,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
