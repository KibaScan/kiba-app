// Kiba — Appointments List Screen (D-103)
// Upcoming / Past segmented view with appointment rows.
// Access: PetHubScreen → "Appointments" settings row.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { getUpcomingAppointments, getPastAppointments, deleteAppointment } from '../services/appointmentService';
import { canCreateAppointment } from '../utils/permissions';
import { supabase } from '../services/supabase';
import { useActivePetStore } from '../stores/useActivePetStore';
import SwipeableRow from '../components/ui/SwipeableRow';
import type { Appointment, AppointmentType } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'Appointments'>;

// ─── Helpers ────────────────────────────────────────────

const TYPE_ICONS: Record<AppointmentType, string> = {
  vet_visit: 'medical-outline',
  grooming: 'cut-outline',
  medication: 'medkit-outline',
  vaccination: 'shield-checkmark-outline',
  deworming: 'fitness-outline',
  other: 'calendar-outline',
};

const TYPE_LABELS: Record<AppointmentType, string> = {
  vet_visit: 'Vet Visit',
  grooming: 'Grooming',
  medication: 'Medication',
  vaccination: 'Vaccination',
  deworming: 'Deworming',
  other: 'Other',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime12(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? `0${m}` : String(m);
  return `${hour12}:${minStr} ${ampm}`;
}

function formatRelativeDate(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const time = formatTime12(date);

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Tomorrow at ${time}`;
  if (diffDays > 1 && diffDays <= 6) return `${DAYS[date.getDay()]} at ${time}`;
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()} at ${time}`;
}

function resolvePetNames(petIds: string[], petMap: Map<string, string>): string {
  const names = petIds.map((id) => petMap.get(id)).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(' & ');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

// ─── Component ──────────────────────────────────────────

export default function AppointmentsListScreen() {
  const navigation = useNavigation<Nav>();
  const pets = useActivePetStore((s) => s.pets);
  const petMap = new Map(pets.map((p) => [p.id, p.name]));

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const data = tab === 'upcoming'
        ? await getUpcomingAppointments(session.user.id)
        : await getPastAppointments(session.user.id);
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAdd = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const upcoming = tab === 'upcoming'
      ? appointments
      : await getUpcomingAppointments(session.user.id);
    if (!canCreateAppointment(upcoming.length)) {
      (navigation as any).navigate('Paywall', { trigger: 'appointment_limit' });
      return;
    }
    navigation.navigate('CreateAppointment');
  }, [navigation, tab, appointments]);

  const renderItem = useCallback(({ item }: { item: Appointment }) => {
    const label = item.type === 'other' && item.custom_label
      ? item.custom_label
      : TYPE_LABELS[item.type];
    const petNames = resolvePetNames(item.pet_ids, petMap);
    const dateStr = tab === 'upcoming'
      ? formatRelativeDate(item.scheduled_at)
      : formatRelativeDate(item.completed_at ?? item.scheduled_at);

    return (
      <SwipeableRow
        onDelete={async () => {
          await deleteAppointment(item.id);
          loadData();
        }}
        onEdit={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
        deleteConfirmMessage={`Delete this ${label.toLowerCase()}? This cannot be undone.`}
      >
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
        >
          <View style={styles.iconCircle}>
            <Ionicons
              name={TYPE_ICONS[item.type] as keyof typeof Ionicons.glyphMap}
              size={20}
              color={Colors.accent}
            />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowDate}>{dateStr}</Text>
            {petNames ? <Text style={styles.rowPets}>{petNames}</Text> : null}
            {item.location ? <Text style={styles.rowLocation}>{item.location}</Text> : null}
          </View>
          {item.recurring !== 'none' && (
            <Ionicons name="repeat-outline" size={16} color={Colors.textTertiary} style={styles.recurBadge} />
          )}
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [navigation, petMap, tab, loadData]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity onPress={handleAdd} hitSlop={12}>
          <Ionicons name="add" size={26} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segTab, tab === 'upcoming' && styles.segTabActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.segTabText, tab === 'upcoming' && styles.segTabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segTab, tab === 'past' && styles.segTabActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.segTabText, tab === 'past' && styles.segTabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={appointments.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>
                {tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
              </Text>
              <Text style={styles.emptyBody}>
                {tab === 'upcoming'
                  ? 'Schedule vet visits, grooming, and more.'
                  : 'Completed appointments will appear here.'}
              </Text>
              {tab === 'upcoming' && (
                <TouchableOpacity style={styles.emptyCta} onPress={handleAdd} activeOpacity={0.7}>
                  <Text style={styles.emptyCtaText}>Schedule Appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  segmented: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.cardSurface,
    padding: 3,
  },
  segTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  segTabActive: {
    backgroundColor: Colors.accent,
  },
  segTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segTabTextActive: {
    color: Colors.textPrimary,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowPets: {
    fontSize: FontSizes.xs,
    color: Colors.accent,
    marginTop: 2,
  },
  rowLocation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  recurBadge: { marginRight: Spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyCta: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  emptyCtaText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
