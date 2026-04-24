// PetHub — Appointments card sub-component
// Extracted from PetHubScreen.tsx. Props only — no local state, no hooks.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';
import { styles } from '../../screens/pethub/PetHubStyles';
import SwipeableRow from '../ui/SwipeableRow';
import { deleteAppointment } from '../../services/appointmentService';
import type { Appointment, AppointmentType } from '../../types/appointment';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<MeStackParamList, 'MeMain'>;

// ─── Appointment type icons (matching drill-down) ─────────
const APPT_ICONS: Record<AppointmentType, string> = {
  vet_visit: 'medical-outline',
  grooming: 'cut-outline',
  medication: 'medkit-outline',
  vaccination: 'shield-checkmark-outline',
  deworming: 'fitness-outline',
  other: 'calendar-outline',
};

interface Props {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  navigation: NavProp;
}

export function AppointmentsCard({ appointments, setAppointments, navigation }: Props) {
  return (
    <View style={styles.healthRecordCard}>
      <View style={styles.healthRecordHeader}>
        <Text style={styles.healthRecordTitle}>Appointments</Text>
        {appointments.length > 0 && (
          <TouchableOpacity
            style={styles.headerSeeAll}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Appointments')}
          >
            <Text style={styles.seeAllLinkText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>
      {appointments.length === 0 ? (
        <TouchableOpacity
          style={styles.addRecordLink}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('CreateAppointment')}
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.addRecordLinkText}>Schedule an appointment</Text>
        </TouchableOpacity>
      ) : (
        <>
          {appointments.slice(0, 3).map((appt) => (
            <SwipeableRow
              key={appt.id}
              onDelete={async () => {
                await deleteAppointment(appt.id);
                setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
              }}
              deleteConfirmMessage={`Delete this appointment? This cannot be undone.`}
            >
              <TouchableOpacity
                style={styles.healthRecordRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
              >
                <View style={styles.apptIconCircle}>
                  <Ionicons
                    name={(APPT_ICONS[appt.type] ?? 'calendar-outline') as any}
                    size={18}
                    color={Colors.accent}
                  />
                </View>
                <View style={styles.healthRecordInfo}>
                  <Text style={styles.healthRecordName}>
                    {appt.custom_label || appt.type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.healthRecordDate}>
                    {new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {appt.location ? <Text style={styles.healthRecordVet}>{appt.location}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </SwipeableRow>
          ))}

          {/* Always-visible add link */}
          <TouchableOpacity
            style={[styles.addRecordLink, { marginTop: Spacing.sm }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CreateAppointment')}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.addRecordLinkText}>Schedule an appointment</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
