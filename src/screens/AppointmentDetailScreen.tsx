// Kiba — Appointment Detail Screen (D-103)
// View/edit appointment, mark complete, delete.

import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  updateAppointment,
  deleteAppointment,
  completeAppointment,
} from '../services/appointmentService';
import { rescheduleAllAppointments } from '../services/appointmentNotificationScheduler';
import { supabase } from '../services/supabase';
import { useActivePetStore } from '../stores/useActivePetStore';
import HealthRecordLogSheet from '../components/appointments/HealthRecordLogSheet';
import type { Appointment, AppointmentType, ReminderOption, RecurringOption } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'AppointmentDetail'>;
type Route = RouteProp<MeStackParamList, 'AppointmentDetail'>;

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

export default function AppointmentDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { appointmentId } = route.params;
  const pets = useActivePetStore((s) => s.pets);

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [type, setType] = useState<AppointmentType>('vet_visit');
  const [customLabel, setCustomLabel] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState<ReminderOption>('1_day');
  const [recurring, setRecurring] = useState<RecurringOption>('none');

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [healthSheetVisible, setHealthSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load appointment
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('pet_appointments')
          .select('*')
          .eq('id', appointmentId)
          .single();
        if (error || !data) return;
        const a = data as Appointment;
        setAppt(a);
        setType(a.type);
        setCustomLabel(a.custom_label ?? '');
        setScheduledAt(new Date(a.scheduled_at));
        setSelectedPetIds(a.pet_ids);
        setLocation(a.location ?? '');
        setNotes(a.notes ?? '');
        setReminder(a.reminder);
        setRecurring(a.recurring);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appointmentId]);

  const chipTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const togglePet = useCallback((petId: string) => {
    chipTap();
    markDirty();
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  }, [chipTap, markDirty]);

  const handleDateChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      markDirty();
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
      if (Platform.OS === 'android' && datePickerMode === 'date') {
        setTimeout(() => {
          setDatePickerMode('time');
          setShowDatePicker(true);
        }, 100);
      }
    }
  }, [datePickerMode, markDirty]);

  const getUserId = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }, []);

  const handleSave = useCallback(async () => {
    if (!appt || selectedPetIds.length === 0) return;
    setSaving(true);
    try {
      await updateAppointment(appt.id, {
        type,
        custom_label: type === 'other' ? customLabel || null : null,
        scheduled_at: scheduledAt.toISOString(),
        pet_ids: selectedPetIds,
        location: location || null,
        notes: notes || null,
        reminder,
        recurring,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const userId = await getUserId();
      if (userId) rescheduleAllAppointments(userId).catch(() => {});
      setIsDirty(false);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [appt, type, customLabel, scheduledAt, selectedPetIds, location, notes, reminder, recurring, navigation, getUserId]);

  const handleComplete = useCallback(async () => {
    if (!appt) return;
    // Vaccination/deworming: show health record log sheet instead
    if (appt.type === 'vaccination' || appt.type === 'deworming') {
      setHealthSheetVisible(true);
      return;
    }
    setSaving(true);
    try {
      await completeAppointment(appt.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const userId = await getUserId();
      if (userId) rescheduleAllAppointments(userId).catch(() => {});
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [appt, navigation, getUserId]);

  const handleHealthComplete = useCallback(async () => {
    setHealthSheetVisible(false);
    const userId = await getUserId();
    if (userId) rescheduleAllAppointments(userId).catch(() => {});
    navigation.goBack();
  }, [navigation, getUserId]);

  const handleDelete = useCallback(async () => {
    if (!appt) return;
    setDeleteModalVisible(false);
    setSaving(true);
    try {
      await deleteAppointment(appt.id);
      const userId = await getUserId();
      if (userId) rescheduleAllAppointments(userId).catch(() => {});
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [appt, navigation, getUserId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!appt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Appointment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isUpcoming = !appt.is_completed;

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
          <Text style={styles.headerTitle}>Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Completed badge */}
          {appt.is_completed && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.severityGreen} />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}

          {/* Type */}
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
                onPress={() => { chipTap(); markDirty(); setType(opt.value); }}
                activeOpacity={0.7}
                disabled={!isUpcoming}
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
              placeholder="Label"
              placeholderTextColor={Colors.textTertiary}
              value={customLabel}
              onChangeText={(v) => { setCustomLabel(v); markDirty(); }}
              editable={isUpcoming}
            />
          )}

          {/* Date & Time */}
          <Text style={styles.sectionLabel}>Date & Time</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => { setDatePickerMode('date'); setShowDatePicker(true); }}
            activeOpacity={0.7}
            disabled={!isUpcoming}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            <Text style={styles.dateButtonText}>{formatDateTime(scheduledAt)}</Text>
          </TouchableOpacity>
          {showDatePicker && isUpcoming && (
            <DateTimePicker
              value={scheduledAt}
              mode={datePickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
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
                  disabled={!isUpcoming}
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
            placeholder="Location"
            placeholderTextColor={Colors.textTertiary}
            value={location}
            onChangeText={(v) => { setLocation(v); markDirty(); }}
            editable={isUpcoming}
          />
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes"
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={(v) => { setNotes(v); markDirty(); }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={isUpcoming}
          />

          {/* Reminder */}
          <Text style={styles.sectionLabel}>Reminder</Text>
          <View style={styles.chipRow}>
            {REMINDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, reminder === opt.value && styles.chipActive]}
                onPress={() => { chipTap(); markDirty(); setReminder(opt.value); }}
                activeOpacity={0.7}
                disabled={!isUpcoming}
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
                onPress={() => { chipTap(); markDirty(); setRecurring(opt.value); }}
                activeOpacity={0.7}
                disabled={!isUpcoming}
              >
                <Text style={[styles.chipText, recurring === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {isUpcoming && isDirty && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving || selectedPetIds.length === 0}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}
            {isUpcoming && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={handleComplete}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.severityGreen} />
                <Text style={styles.completeButtonText}>Mark Complete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setDeleteModalVisible(true)}
              disabled={saving}
              activeOpacity={0.6}
            >
              <Text style={styles.deleteButtonText}>Delete Appointment</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Health Record Log Sheet (D-163) */}
      <HealthRecordLogSheet
        visible={healthSheetVisible}
        appointment={appt}
        petNames={new Map(pets.map((p) => [p.id, p.name]))}
        onComplete={handleHealthComplete}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteModalVisible(false)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.modalCenter}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Appointment</Text>
            <Text style={styles.modalBody}>
              This appointment will be permanently removed.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={handleDelete}>
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.hairlineBorder,
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
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },
  completedText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.severityGreen,
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
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
    backgroundColor: Colors.cardSurface,
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
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    overflow: 'hidden',
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.hairlineBorder,
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
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginTop: Spacing.sm,
  },
  notesInput: {
    minHeight: 80,
    marginTop: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  completeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardSurface,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.severityGreen,
  },
  completeButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityGreen,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.severityRed,
  },
  bottomSpacer: { height: 100 },
  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 20,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalBody: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalDelete: {
    flex: 1,
    backgroundColor: Colors.severityRed,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
