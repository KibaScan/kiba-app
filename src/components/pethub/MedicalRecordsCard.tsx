// PetHub — Medical Records card sub-component
// Extracted from PetHubScreen.tsx. Props only — no local state, no hooks.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';
import { styles } from '../../screens/pethub/PetHubStyles';
import SwipeableRow from '../ui/SwipeableRow';
import { getHealthRecords, deleteHealthRecord } from '../../services/appointmentService';
import type { Pet } from '../../types/pet';
import type { PetHealthRecord } from '../../types/appointment';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<MeStackParamList, 'MeMain'>;

interface Props {
  pet: Pet;
  healthRecords: PetHealthRecord[];
  setHealthRecords: React.Dispatch<React.SetStateAction<PetHealthRecord[]>>;
  onOpenDetail: (record: PetHealthRecord) => void;
  navigation: NavProp;
}

export function MedicalRecordsCard({ pet, healthRecords, setHealthRecords, onOpenDetail, navigation }: Props) {
  return (
    <View style={styles.healthRecordCard}>
      <View style={styles.healthRecordHeader}>
        <Text style={styles.healthRecordTitle}>Medical Records</Text>
        {healthRecords.length > 0 && (
          <TouchableOpacity
            style={styles.headerSeeAll}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MedicalRecords')}
          >
            <Text style={styles.seeAllLinkText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>
      {healthRecords.length === 0 ? (
        <TouchableOpacity
          style={styles.addRecordLink}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('HealthRecordForm')}
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.addRecordLinkText}>Add a medical record</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* Top 3 records, sorted chronologically */}
          {[...healthRecords]
            .sort((a, b) => b.administered_at.localeCompare(a.administered_at))
            .slice(0, 3)
            .map((r) => (
              <SwipeableRow
                key={r.id}
                onDelete={async () => {
                  await deleteHealthRecord(r.id);
                  getHealthRecords(pet.id).then(setHealthRecords).catch(() => {});
                }}
                onEdit={() => onOpenDetail(r)}
                deleteConfirmMessage={`Delete "${r.treatment_name}"? This cannot be undone.`}
              >
                <TouchableOpacity
                  style={styles.healthRecordRow}
                  activeOpacity={0.7}
                  onPress={() => onOpenDetail(r)}
                >
                  <Ionicons
                    name={r.record_type === 'vaccination' ? 'shield-checkmark-outline' : 'fitness-outline'}
                    size={16}
                    color={Colors.accent}
                    style={styles.medicalRecordIcon}
                  />
                  <View style={styles.healthRecordInfo}>
                    <Text style={styles.healthRecordName}>{r.treatment_name}</Text>
                    <Text style={styles.healthRecordDate}>
                      {new Date(r.administered_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {r.next_due_at ? ` — Next: ${new Date(r.next_due_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </Text>
                    {r.vet_name ? <Text style={styles.healthRecordVet}>{r.vet_name}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </SwipeableRow>
            ))}

          {/* Persistent add CTA — bottom-anchored, single steering wheel */}
          <TouchableOpacity
            style={[styles.addRecordLink, { marginTop: Spacing.sm }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('HealthRecordForm')}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.addRecordLinkText}>Add Medical Record</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
