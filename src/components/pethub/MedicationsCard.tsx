// PetHub — Medications card sub-component
// Extracted from PetHubScreen.tsx. Props only — no local state, no hooks.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';
import { styles } from '../../screens/pethub/PetHubStyles';
import SwipeableRow from '../ui/SwipeableRow';
import { getMedications, deleteMedication } from '../../services/petService';
import type { Pet, PetMedication } from '../../types/pet';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../../types/navigation';

type NavProp = NativeStackNavigationProp<MeStackParamList, 'MeMain'>;

interface Props {
  pet: Pet;
  medications: PetMedication[];
  setMedications: React.Dispatch<React.SetStateAction<PetMedication[]>>;
  conditionTags: string[];
  navigation: NavProp;
}

export function MedicationsCard({ pet, medications, setMedications, conditionTags, navigation }: Props) {
  const activeMeds = medications.filter((m) => m.status !== 'past');

  return (
    <View style={styles.healthRecordCard}>
      <View style={styles.healthRecordHeader}>
        <Text style={styles.healthRecordTitle}>Medications</Text>
        {activeMeds.length > 0 && (
          <TouchableOpacity
            style={styles.headerSeeAll}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Medications')}
          >
            <Text style={styles.seeAllLinkText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {activeMeds.length === 0 ? (
        <TouchableOpacity
          style={styles.addRecordLink}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('MedicationForm', {
              petId: pet.id,
              petName: pet.name,
              conditions: conditionTags.filter((t) => t !== 'allergy'),
            })
          }
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.addRecordLinkText}>Add a medication</Text>
        </TouchableOpacity>
      ) : (
        <>
          {activeMeds.slice(0, 3).map((med) => (
            <SwipeableRow
              key={med.id}
              onDelete={async () => {
                await deleteMedication(med.id);
                getMedications(pet.id).then(setMedications).catch(() => {});
              }}
              onEdit={() =>
                navigation.navigate('MedicationForm', {
                  petId: pet.id,
                  petName: pet.name,
                  medication: med,
                  conditions: conditionTags.filter((t) => t !== 'allergy'),
                })
              }
              deleteConfirmMessage={`Delete "${med.medication_name}"? This cannot be undone.`}
            >
              <TouchableOpacity
                style={styles.healthRecordRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('MedicationForm', {
                    petId: pet.id,
                    petName: pet.name,
                    medication: med,
                    conditions: conditionTags.filter((t) => t !== 'allergy'),
                  })
                }
              >
                <View style={styles.medicationRowInner}>
                  <View
                    style={[
                      styles.medicationStatusDot,
                      { backgroundColor: med.status === 'current' ? Colors.severityGreen : Colors.severityAmber },
                    ]}
                  />
                  <View style={styles.healthRecordInfo}>
                    <Text style={styles.healthRecordName}>{med.medication_name}</Text>
                    {med.dosage ? (
                      <Text style={styles.healthRecordDate}>{med.dosage}</Text>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </SwipeableRow>
          ))}

          {/* Persistent add CTA */}
          <TouchableOpacity
            style={[styles.addRecordLink, { marginTop: Spacing.sm }]}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('MedicationForm', {
                petId: pet.id,
                petName: pet.name,
                conditions: conditionTags.filter((t) => t !== 'allergy'),
              })
            }
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.addRecordLinkText}>Add Medication</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
