import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { AppointmentType } from '../../types/appointment';

// ─── Constants ──────────────────────────────────────────

const APPT_TYPE_ICONS: Record<AppointmentType, keyof typeof Ionicons.glyphMap> = {
  vet_visit: 'medical-outline',
  grooming: 'cut-outline',
  medication: 'medkit-outline',
  vaccination: 'shield-checkmark-outline',
  deworming: 'fitness-outline',
  other: 'calendar-outline',
};

const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  vet_visit: 'vet visit',
  grooming: 'grooming',
  medication: 'medication',
  vaccination: 'vaccination',
  deworming: 'deworming',
  other: 'appointment',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Helpers ────────────────────────────────────────────

export function formatRelativeDay(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 6) return DAYS[date.getDay()];
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// ─── Component ──────────────────────────────────────────

interface AppointmentRowProps {
  type: AppointmentType;
  petName: string;
  scheduledAt: string;
  onPress: () => void;
}

export function AppointmentRow({ type, petName, scheduledAt, onPress }: AppointmentRowProps) {
  return (
    <TouchableOpacity
      style={styles.appointmentRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={APPT_TYPE_ICONS[type]}
        size={20}
        color={Colors.accent}
      />
      <Text style={styles.appointmentText} numberOfLines={1}>
        {petName}&apos;s{' '}
        {APPT_TYPE_LABELS[type]}
      </Text>
      <Text style={styles.appointmentDate}>
        {formatRelativeDay(scheduledAt)}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  appointmentText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  appointmentDate: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
});
