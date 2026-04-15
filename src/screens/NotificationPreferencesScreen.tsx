// Kiba — Notification Preferences Screen (M5)
// Reads/writes user_settings table (migration 014).
// Global kill switch + per-category toggles + digest frequency selector.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '../services/pushService';
import { rescheduleAllFeeding, cancelAllFeedingNotifications } from '../services/feedingNotificationScheduler';
import { rescheduleAllAppointments, cancelAllAppointmentReminders } from '../services/appointmentNotificationScheduler';
import { rescheduleAllMedications, cancelAllMedicationNotifications } from '../services/medicationNotificationScheduler';
import { supabase } from '../services/supabase';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { DigestFrequency } from '../types/notifications';

// ─── Digest Options ──────────────────────────────────────

const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'off', label: 'Off' },
];

// ─── Component ───────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation();
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);
  const activePet = pets.find((p) => p.id === activePetId) ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toggle states
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [feedingEnabled, setFeedingEnabled] = useState(true);
  const [lowStockEnabled, setLowStockEnabled] = useState(true);
  const [emptyEnabled, setEmptyEnabled] = useState(true);
  const [recallEnabled, setRecallEnabled] = useState(true);
  const [appointmentEnabled, setAppointmentEnabled] = useState(true);
  const [medicationEnabled, setMedicationEnabled] = useState(true);
  const [weightEstimateEnabled, setWeightEstimateEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('weekly');

  // ─── Load Preferences ──────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const prefs = await getNotificationPreferences();
        if (cancelled || !prefs) {
          setLoading(false);
          return;
        }
        setGlobalEnabled(prefs.notifications_enabled);
        setFeedingEnabled(prefs.feeding_reminders_enabled);
        setLowStockEnabled(prefs.low_stock_alerts_enabled);
        setEmptyEnabled(prefs.empty_alerts_enabled);
        setRecallEnabled(prefs.recall_alerts_enabled);
        setAppointmentEnabled(prefs.appointment_reminders_enabled);
        setMedicationEnabled(prefs.medication_reminders_enabled ?? true);
        setWeightEstimateEnabled(prefs.weight_estimate_alerts_enabled ?? true);
        setDigestFrequency(prefs.digest_frequency);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // ─── Update Helper ─────────────────────────────────────

  async function updatePref(
    key: Parameters<typeof updateNotificationPreference>[0],
    value: boolean | string,
  ) {
    setSaving(true);
    try {
      await updateNotificationPreference(key, value);
    } catch {
      Alert.alert('Error', 'Could not update setting. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle Handlers ───────────────────────────────────

  async function handleGlobalToggle(value: boolean) {
    setGlobalEnabled(value);
    await updatePref('notifications_enabled', value);

    if (!value) {
      // Cancel all local notifications when global is disabled
      await cancelAllFeedingNotifications();
      await cancelAllAppointmentReminders();
      await cancelAllMedicationNotifications();
    } else {
      // Re-sync local notifications when re-enabled
      rescheduleAllFeeding().catch(() => {});
      rescheduleAllMedications().catch(() => {});
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        rescheduleAllAppointments(session.user.id).catch(() => {});
      }
    }
  }

  async function handleFeedingToggle(value: boolean) {
    setFeedingEnabled(value);
    await updatePref('feeding_reminders_enabled', value);
    // Reschedule respects the preference internally
    rescheduleAllFeeding().catch(() => {});
  }

  async function handleLowStockToggle(value: boolean) {
    setLowStockEnabled(value);
    await updatePref('low_stock_alerts_enabled', value);
  }

  async function handleEmptyToggle(value: boolean) {
    setEmptyEnabled(value);
    await updatePref('empty_alerts_enabled', value);
  }

  async function handleRecallToggle(value: boolean) {
    if (!value) {
      const petName = activePet?.name ?? 'your pet';
      Alert.alert(
        'Disable Recall Alerts?',
        `Recall alerts help protect ${petName} from unsafe food. Are you sure?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              setRecallEnabled(false);
              await updatePref('recall_alerts_enabled', false);
            },
          },
        ],
      );
      return;
    }
    setRecallEnabled(true);
    await updatePref('recall_alerts_enabled', true);
  }

  async function handleAppointmentToggle(value: boolean) {
    setAppointmentEnabled(value);
    await updatePref('appointment_reminders_enabled', value);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      rescheduleAllAppointments(session.user.id).catch(() => {});
    }
  }

  async function handleMedicationToggle(value: boolean) {
    setMedicationEnabled(value);
    await updatePref('medication_reminders_enabled', value);
    rescheduleAllMedications().catch(() => {});
  }

  async function handleDigestChange(value: DigestFrequency) {
    setDigestFrequency(value);
    await updatePref('digest_frequency', value);
  }

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Global Toggle */}
        <View style={styles.section}>
          <ToggleRow
            label="Enable Notifications"
            value={globalEnabled}
            onValueChange={handleGlobalToggle}
            disabled={saving}
          />
          <Text style={styles.sectionHint}>
            Turn off all Kiba notifications including feeding reminders, recall alerts, and appointment reminders.
          </Text>
        </View>

        {globalEnabled && (
          <>
            {/* Feeding Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Feeding</Text>
              <ToggleRow
                label="Feeding Reminders"
                value={feedingEnabled}
                onValueChange={handleFeedingToggle}
                disabled={saving}
              />
              <ToggleRow
                label="Low Stock Alerts"
                value={lowStockEnabled}
                onValueChange={handleLowStockToggle}
                disabled={saving}
              />
              <ToggleRow
                label="Empty Alerts"
                value={emptyEnabled}
                onValueChange={handleEmptyToggle}
                disabled={saving}
              />
            </View>

            {/* Weight Section (D-161) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weight</Text>
              <ToggleRow
                label="Weight Estimates"
                value={weightEstimateEnabled}
                onValueChange={async (value) => {
                  setWeightEstimateEnabled(value);
                  await updatePref('weight_estimate_alerts_enabled', value);
                }}
                disabled={saving}
              />
              <Text style={styles.sectionHint}>
                Get notified when feeding data suggests a weight change.
              </Text>
            </View>

            {/* Recall Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recalls</Text>
              <ToggleRow
                label="Recall Alerts"
                value={recallEnabled}
                onValueChange={handleRecallToggle}
                disabled={saving}
              />
            </View>

            {/* Appointments Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appointments</Text>
              <ToggleRow
                label="Appointment Reminders"
                value={appointmentEnabled}
                onValueChange={handleAppointmentToggle}
                disabled={saving}
              />
            </View>

            {/* Medications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medications</Text>
              <ToggleRow
                label="Medication Reminders"
                value={medicationEnabled}
                onValueChange={handleMedicationToggle}
                disabled={saving}
              />
            </View>

            {/* Digest Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Digest</Text>
              <Text style={styles.digestLabel}>Weekly Digest</Text>
              <View style={styles.digestRow}>
                {DIGEST_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.digestOption,
                      digestFrequency === opt.value && styles.digestOptionActive,
                    ]}
                    onPress={() => handleDigestChange(opt.value)}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.digestOptionText,
                        digestFrequency === opt.value && styles.digestOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Toggle Row Component ─────────────────────────────────

function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.chipSurface, true: Colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  digestLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  digestRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  digestOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  digestOptionActive: {
    backgroundColor: Colors.accent,
  },
  digestOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  digestOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
