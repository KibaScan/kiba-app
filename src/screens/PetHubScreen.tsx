// Kiba — Pet Hub Screen (M2 Session 5)
// Central pet management screen on the Me tab. Replaces M1 placeholder MeScreen.
// D-120: Multi-pet carousel. D-117: Stale weight indicator. D-094: Pet name in context.
// D-084: Zero emoji — Ionicons only. D-086: Dark theme.

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { styles } from './pethub/PetHubStyles';
import {
  calculateScoreAccuracy,
  getStaleWeightMonths,
  formatStaleWeightMessage,
  capitalizeFirst,
  ACTIVITY_LABELS,
} from './pethub/petHubHelpers';
import { isPremium, canAddPet } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import {
  getPetConditions,
  getPetAllergens,
  getMedications,
} from '../services/petService';
import { getConditionsForSpecies } from '../data/conditions';
import { getWeightUnitPref, computePetDer } from '../utils/pantryHelpers';
import PortionCard from '../components/PortionCard';
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { calculateTreatBudget } from '../services/treatBattery';
import { useTreatBatteryStore } from '../stores/useTreatBatteryStore';
import { TreatQuickPickerSheet } from '../components/treats/TreatQuickPickerSheet';
import { getHealthRecords, getUpcomingAppointments } from '../services/appointmentService';
import { supabase } from '../services/supabase';
import HealthRecordLogSheet from '../components/appointments/HealthRecordLogSheet';
import WeightEstimateSheet from '../components/WeightEstimateSheet';
import { KCAL_PER_LB } from '../utils/weightGoal';
import type { Pet, PetCondition, PetAllergen, PetMedication } from '../types/pet';
import type { Appointment, PetHealthRecord, HealthRecordType } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';
import { PetHubShareCard } from '../components/pet/PetShareCard';
import { captureAndShare } from '../utils/shareCard';

// ─── Component ────────────────────────────────────────────

type Props = NativeStackScreenProps<MeStackParamList, 'MeMain'>;

export default function PetHubScreen({ navigation }: Props) {
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);
  const setActivePet = useActivePetStore((s) => s.setActivePet);
  const activePet = pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;
  const hubShareRef = useRef<View>(null);
  const treatBatteryReset = useTreatBatteryStore((s) => s.resetIfNewDay);
  const consumedTreatKcal = useTreatBatteryStore((s) =>
    activePet ? (s.consumedByPet[activePet.id]?.kcal ?? 0) : 0,
  );
  const treatCount = useTreatBatteryStore((s) =>
    activePet ? (s.consumedByPet[activePet.id]?.count ?? 0) : 0,
  );

  // ─── Health data (screen-scoped, reloaded on focus) ─────
  const [conditions, setConditions] = useState<PetCondition[]>([]);
  const [allergens, setAllergens] = useState<PetAllergen[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // ─── Medications (M6) ─────────────────────────────────
  const [medications, setMedications] = useState<PetMedication[]>([]);
  const [showPastMeds, setShowPastMeds] = useState(false);

  // ─── Health records (D-163) ────────────────────────────
  const [healthRecords, setHealthRecords] = useState<PetHealthRecord[]>([]);
  const [manualRecordVisible, setManualRecordVisible] = useState(false);
  const [defaultRecordType, setDefaultRecordType] = useState<HealthRecordType>('vaccination');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // ─── D-161: Weight estimate sheet ──────────────────────
  const [weightEstimateVisible, setWeightEstimateVisible] = useState(false);

  // ─── Treat quick picker (D-124 revised) ────────────────
  const [treatPickerVisible, setTreatPickerVisible] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');

  // ─── Load conditions/allergens on focus or active pet change ──
  useFocusEffect(
    useCallback(() => {
      treatBatteryReset();
      getWeightUnitPref().then(setWeightUnit);
      if (!activePet) return;
      let cancelled = false;
      setHealthLoading(true);

      Promise.all([
        getPetConditions(activePet.id),
        getPetAllergens(activePet.id),
        getHealthRecords(activePet.id),
        getMedications(activePet.id).catch(() => [] as PetMedication[]),
      ])
        .then(([conds, allergs, records, meds]) => {
          if (!cancelled) {
            setConditions(conds);
            setAllergens(allergs);
            setHealthRecords(records);
            setMedications(meds);
          }
        })
        .catch(() => {
          // Silently fail — empty state is fine
        })
        .finally(() => {
          if (!cancelled) setHealthLoading(false);
        });

      // Fetch upcoming appointments (needs userId)
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user && !cancelled) {
          getUpcomingAppointments(data.user.id, activePet.id).then((appts) => {
            if (!cancelled) setAppointments(appts);
          });
        }
      });

      return () => {
        cancelled = true;
      };
    }, [activePet?.id]),
  );

  // ─── No pets state ──────────────────────────────────────
  if (!activePet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Me</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="paw-outline" size={48} color={Colors.textTertiary} />
          <Text style={[styles.emptyText, { marginTop: Spacing.md }]}>
            No pets yet
          </Text>
          <TouchableOpacity
            style={styles.addPetButton}
            onPress={() => navigation.navigate('SpeciesSelect')}
            activeOpacity={0.7}
          >
            <Text style={styles.addPetButtonText}>Add Your Pet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Computed values ────────────────────────────────────
  const scoreAccuracy = calculateScoreAccuracy(
    activePet,
    activePet.health_reviewed_at != null,
  );
  const staleMonths = getStaleWeightMonths(activePet.weight_updated_at);
  // D-117: Suppress stale weight nag when accumulator is actively tracking (D-161)
  const accumulatorActive = activePet.caloric_accumulator != null && activePet.caloric_accumulator !== 0;
  const showStaleWeight =
    staleMonths != null && staleMonths > 6 && activePet.weight_current_lbs != null && !accumulatorActive;
  const der = computePetDer(activePet, false, activePet.weight_goal_level);
  const activityLabel =
    ACTIVITY_LABELS[activePet.species]?.[activePet.activity_level] ??
    capitalizeFirst(activePet.activity_level);
  const lifeStageLabel = activePet.life_stage
    ? capitalizeFirst(activePet.life_stage)
    : null;

  // Condition label lookup
  const conditionDefs = getConditionsForSpecies(activePet.species);
  const conditionLabels = conditions.map((c) => {
    const def = conditionDefs.find((d) => d.tag === c.condition_tag);
    return def?.label ?? c.condition_tag;
  });

  const conditionTags = conditions.map((c) => c.condition_tag);
  // Always show carousel so "+ Add Pet" is visible (D-120).
  // Paywall gating on the button itself deferred to M3.
  const showCarousel = pets.length >= 1;

  // ─── Handlers ───────────────────────────────────────────
  function handleAddPet() {
    if (canAddPet(pets.length)) {
      navigation.navigate('SpeciesSelect');
    } else {
      Alert.alert(
        'Premium Feature',
        'Multi-pet households need Premium. Add all your pets!',
      );
    }
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Me</Text>
        </View>

        {/* (b) Multi-pet carousel or single avatar */}
        {showCarousel ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            style={styles.carousel}
          >
            {pets.map((pet) => {
              const isActive = pet.id === activePetId;
              return (
                <TouchableOpacity
                  key={pet.id}
                  onPress={() => !isActive && setActivePet(pet.id)}
                  activeOpacity={0.7}
                  style={styles.carouselItem}
                >
                  <View
                    style={[
                      styles.carouselAvatar,
                      isActive
                        ? styles.carouselAvatarActive
                        : styles.carouselAvatarInactive,
                    ]}
                  >
                    {pet.photo_url ? (
                      <Image
                        source={{ uri: pet.photo_url }}
                        style={[
                          styles.carouselPhoto,
                          isActive
                            ? styles.carouselPhotoActive
                            : styles.carouselPhotoInactive,
                        ]}
                      />
                    ) : (
                      <Ionicons
                        name="paw-outline"
                        size={isActive ? 22 : 16}
                        color={Colors.accent}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.carouselName,
                      !isActive && styles.carouselNameInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {pet.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* + Add Pet */}
            <TouchableOpacity
              onPress={handleAddPet}
              activeOpacity={0.7}
              style={styles.carouselItem}
            >
              <View style={[styles.carouselAvatar, styles.carouselAvatarAdd]}>
                <Ionicons name="add" size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.carouselNameAdd}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.singlePetRow}>
            <View style={[styles.carouselAvatar, styles.carouselAvatarActive]}>
              {activePet.photo_url ? (
                <Image
                  source={{ uri: activePet.photo_url }}
                  style={[styles.carouselPhoto, styles.carouselPhotoActive]}
                />
              ) : (
                <Ionicons name="paw-outline" size={22} color={Colors.accent} />
              )}
            </View>
            <Text style={styles.singlePetName}>{activePet.name}</Text>
          </View>
        )}

        {/* (c) Pet summary card */}
        <TouchableOpacity
          style={styles.summaryCard}
          onPress={() =>
            navigation.navigate('EditPet', { petId: activePet.id })
          }
          activeOpacity={0.7}
        >
          <View style={styles.summaryTop}>
            <View style={styles.summaryPhotoWrap}>
              {activePet.photo_url ? (
                <Image
                  source={{ uri: activePet.photo_url }}
                  style={styles.summaryPhoto}
                />
              ) : (
                <View style={styles.summaryPhotoPlaceholder}>
                  <Ionicons
                    name="paw-outline"
                    size={28}
                    color={Colors.accent}
                  />
                </View>
              )}
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{activePet.name}</Text>
              <Text style={styles.summaryMeta}>
                {capitalizeFirst(activePet.species)}
                {activePet.breed ? ` \u00B7 ${activePet.breed}` : ''}
              </Text>
              {lifeStageLabel && (
                <Text style={styles.summaryLifeStage}>{lifeStageLabel}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('EditPet', { petId: activePet.id })
              }
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Score Accuracy bar */}
          <View style={styles.accuracySection}>
            <View style={styles.accuracyHeader}>
              <Text style={styles.accuracyLabel}>
                Score Accuracy: {scoreAccuracy}%
              </Text>
            </View>
            <View style={styles.accuracyTrack}>
              <View
                style={[
                  styles.accuracyFill,
                  { width: `${scoreAccuracy}%` },
                ]}
              />
            </View>
            {scoreAccuracy < 100 && (
              <Text style={styles.accuracyHint}>
                Complete {activePet.name}'s profile for better scores
              </Text>
            )}
          </View>

          {/* Share profile link */}
          <TouchableOpacity
            style={styles.shareLink}
            activeOpacity={0.7}
            onPress={() => captureAndShare(hubShareRef, activePet.name, 0)}
          >
            <Ionicons name="share-outline" size={16} color={Colors.accent} />
            <Text style={styles.shareLinkText}>Share Profile</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* (d) Stale weight indicator (D-117) */}
        {showStaleWeight && (
          <TouchableOpacity
            style={styles.staleWeightCard}
            onPress={() =>
              navigation.navigate('EditPet', { petId: activePet.id })
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={Colors.severityAmber}
            />
            <Text style={styles.staleWeightText}>
              {formatStaleWeightMessage(staleMonths!)}
            </Text>
          </TouchableOpacity>
        )}

        {/* (d2) D-161: Weight estimate banner */}
        {activePet.accumulator_notification_sent && activePet.caloric_accumulator != null && activePet.caloric_accumulator !== 0 && (() => {
          const threshold = KCAL_PER_LB[activePet.species] ?? 3150;
          const lbsChanged = Math.round(Math.abs(activePet.caloric_accumulator / threshold) * 10) / 10;
          const direction = activePet.caloric_accumulator > 0 ? 'gained' : 'lost';
          return (
            <TouchableOpacity
              style={styles.weightEstimateBanner}
              onPress={() => setWeightEstimateVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="scale-outline" size={20} color={Colors.accent} />
              <Text style={styles.weightEstimateText}>
                {activePet.name} may have {direction} about {lbsChanged} lb based on feeding data.
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          );
        })()}

        {/* (e) Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons
              name="walk-outline"
              size={16}
              color={Colors.accent}
            />
            <Text style={styles.statValue}>{activityLabel}</Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons
              name={
                activePet.is_neutered
                  ? 'checkmark-circle-outline'
                  : 'close-circle-outline'
              }
              size={16}
              color={
                activePet.is_neutered
                  ? Colors.severityGreen
                  : Colors.textTertiary
              }
            />
            <Text style={styles.statValue}>
              {activePet.is_neutered ? 'Neutered' : 'Intact'}
            </Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons
              name="scale-outline"
              size={16}
              color={Colors.accent}
            />
            <Text style={styles.statValue}>
              {activePet.weight_current_lbs != null
                ? weightUnit === 'kg'
                  ? `${(activePet.weight_current_lbs / 2.205).toFixed(1)} kg`
                  : `${activePet.weight_current_lbs} lbs`
                : 'Not set'}
            </Text>
          </View>
        </View>

        {/* Portion card — daily calorie summary */}
        <View style={styles.portionSection}>
          <PortionCard
            pet={activePet}
            product={null}
            conditions={conditionTags}
            showPetName={false}
            onBCSPress={() => navigation.navigate('BCSReference', { petId: activePet.id })}
          />
          {der != null && (
            <TreatBatteryGauge
              treatBudgetKcal={calculateTreatBudget(der)}
              consumedKcal={consumedTreatKcal}
              petName={activePet.name}
              title="Daily Treat Budget"
              treatCount={treatCount}
              onLogTreat={() => setTreatPickerVisible(true)}
            />
          )}
        </View>

        {/* (f) Health conditions summary */}
        <TouchableOpacity
          style={styles.healthCard}
          onPress={() =>
            navigation.navigate('HealthConditions', {
              petId: activePet.id,
              fromCreate: false,
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.healthHeader}>
            <Text style={styles.healthTitle}>Health Conditions</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textTertiary}
            />
          </View>

          {healthLoading ? (
            <ActivityIndicator
              color={Colors.accent}
              size="small"
              style={{ marginTop: Spacing.sm }}
            />
          ) : activePet.health_reviewed_at == null ? (
            <Text style={styles.healthPrompt}>
              Set up health conditions for {activePet.name}
            </Text>
          ) : conditions.length === 0 ? (
            <View style={styles.healthyBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={Colors.severityGreen}
              />
              <Text style={styles.healthyText}>No known conditions</Text>
            </View>
          ) : (
            <View>
              <View style={styles.conditionChips}>
                {conditionLabels.slice(0, 4).map((label) => (
                  <View key={label} style={styles.conditionChip}>
                    <Text style={styles.conditionChipText}>{label}</Text>
                  </View>
                ))}
                {conditionLabels.length > 4 && (
                  <View style={styles.conditionChip}>
                    <Text style={styles.conditionChipText}>
                      +{conditionLabels.length - 4} more
                    </Text>
                  </View>
                )}
              </View>
              {allergens.length > 0 && (
                <Text style={styles.allergenCount}>
                  {allergens.length} food allergen{allergens.length !== 1 ? 's' : ''} tracked
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Medications (M6) — display-only, no scoring impact */}
        <View style={styles.healthRecordCard}>
          <View style={styles.healthRecordHeader}>
            <Text style={styles.healthRecordTitle}>Medications</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MedicationForm', {
                  petId: activePet.id,
                  petName: activePet.name,
                  conditions: conditionTags.filter((t) => t !== 'allergy'),
                })
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {medications.length === 0 ? (
            <TouchableOpacity
              style={styles.addRecordLink}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('MedicationForm', {
                  petId: activePet.id,
                  petName: activePet.name,
                  conditions: conditionTags.filter((t) => t !== 'allergy'),
                })
              }
            >
              <Text style={styles.addRecordLinkText}>No medications logged yet</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Current / As-needed medications */}
              {medications
                .filter((m) => m.status !== 'past')
                .map((med) => (
                  <TouchableOpacity
                    key={med.id}
                    style={styles.healthRecordRow}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('MedicationForm', {
                        petId: activePet.id,
                        petName: activePet.name,
                        medication: med,
                        conditions: conditionTags.filter((t) => t !== 'allergy'),
                      })
                    }
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor:
                            med.status === 'current'
                              ? Colors.severityGreen
                              : Colors.severityAmber,
                        }}
                      />
                      <View style={styles.healthRecordInfo}>
                        <Text style={styles.healthRecordName}>{med.medication_name}</Text>
                        {med.dosage ? (
                          <Text style={styles.healthRecordDate}>{med.dosage}</Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

              {/* Past medications — collapsed by default */}
              {medications.filter((m) => m.status === 'past').length > 0 && (
                <>
                  <TouchableOpacity
                    style={{ marginTop: Spacing.sm }}
                    onPress={() => setShowPastMeds((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addRecordLinkText}>
                      {showPastMeds ? 'Hide' : 'Show'} past medications ({medications.filter((m) => m.status === 'past').length})
                    </Text>
                  </TouchableOpacity>
                  {showPastMeds &&
                    medications
                      .filter((m) => m.status === 'past')
                      .map((med) => (
                        <TouchableOpacity
                          key={med.id}
                          style={styles.healthRecordRow}
                          activeOpacity={0.7}
                          onPress={() =>
                            navigation.navigate('MedicationForm', {
                              petId: activePet.id,
                              petName: activePet.name,
                              medication: med,
                              conditions: conditionTags.filter((t) => t !== 'allergy'),
                            })
                          }
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: Colors.textTertiary,
                              }}
                            />
                            <View style={styles.healthRecordInfo}>
                              <Text style={[styles.healthRecordName, { color: Colors.textSecondary }]}>
                                {med.medication_name}
                              </Text>
                              {med.dosage ? (
                                <Text style={styles.healthRecordDate}>{med.dosage}</Text>
                              ) : null}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                </>
              )}
            </>
          )}
        </View>

        {/* Health Records — Vaccines (D-163) */}
        <View style={styles.healthRecordCard}>
          <Text style={styles.healthRecordTitle}>Vaccines</Text>
          {healthRecords.filter((r) => r.record_type === 'vaccination').length === 0 ? (
            <TouchableOpacity
              style={styles.addRecordLink}
              activeOpacity={0.7}
              onPress={() => { setDefaultRecordType('vaccination'); setManualRecordVisible(true); }}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.addRecordLinkText}>Add a vaccine</Text>
            </TouchableOpacity>
          ) : (
            healthRecords
              .filter((r) => r.record_type === 'vaccination')
              .map((r) => (
                <View key={r.id} style={styles.healthRecordRow}>
                  <View style={styles.healthRecordInfo}>
                    <Text style={styles.healthRecordName}>{r.treatment_name}</Text>
                    <Text style={styles.healthRecordDate}>
                      {new Date(r.administered_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {r.next_due_at ? ` \u2014 Next: ${new Date(r.next_due_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </Text>
                    {r.vet_name ? <Text style={styles.healthRecordVet}>{r.vet_name}</Text> : null}
                  </View>
                </View>
              ))
          )}
        </View>

        {/* Health Records — Dewormings (D-163) */}
        <View style={styles.healthRecordCard}>
          <Text style={styles.healthRecordTitle}>Dewormings</Text>
          {healthRecords.filter((r) => r.record_type === 'deworming').length === 0 ? (
            <TouchableOpacity
              style={styles.addRecordLink}
              activeOpacity={0.7}
              onPress={() => { setDefaultRecordType('deworming'); setManualRecordVisible(true); }}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.addRecordLinkText}>Add a deworming record</Text>
            </TouchableOpacity>
          ) : (
            healthRecords
              .filter((r) => r.record_type === 'deworming')
              .map((r) => (
                <View key={r.id} style={styles.healthRecordRow}>
                  <View style={styles.healthRecordInfo}>
                    <Text style={styles.healthRecordName}>{r.treatment_name}</Text>
                    <Text style={styles.healthRecordDate}>
                      {new Date(r.administered_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {r.next_due_at ? ` \u2014 Next: ${new Date(r.next_due_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </Text>
                    {r.vet_name ? <Text style={styles.healthRecordVet}>{r.vet_name}</Text> : null}
                  </View>
                </View>
              ))
          )}
        </View>

        {/* Appointments */}
        <View style={styles.healthRecordCard}>
          <View style={styles.healthRecordHeader}>
            <Text style={styles.healthRecordTitle}>Appointments</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Appointments')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
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
            appointments.slice(0, 3).map((appt) => (
              <TouchableOpacity
                key={appt.id}
                style={styles.healthRecordRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
              >
                <View style={styles.healthRecordInfo}>
                  <Text style={styles.healthRecordName}>
                    {appt.custom_label || appt.type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.healthRecordDate}>
                    {new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {appt.location ? <Text style={styles.healthRecordVet}>{appt.location}</Text> : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Health disclaimer (D-163) */}
        <Text style={styles.healthDisclaimer}>
          Health records are for your reference. Consult your veterinarian for your pet's care schedule.
        </Text>

        {/* Settings */}
        <TouchableOpacity
          style={styles.settingsNavRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingsNavLabel}>Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Off-screen hub share card for capture */}
      <View style={styles.offScreen} pointerEvents="none">
        <PetHubShareCard
          ref={hubShareRef}
          petName={activePet.name}
          petPhoto={activePet.photo_url ?? null}
          species={activePet.species}
        />
      </View>

      {/* Treat quick picker (D-124 revised) */}
      <TreatQuickPickerSheet
        visible={treatPickerVisible}
        petId={activePet.id}
        petName={activePet.name}
        onClose={() => setTreatPickerVisible(false)}
        onScanNew={() => {
          useScanStore.getState().setTreatLogging(true);
          (navigation.getParent() as any)?.navigate('Scan', { screen: 'ScanMain' });
        }}
      />

      {/* Manual health record sheet (D-163) */}
      <HealthRecordLogSheet
        visible={manualRecordVisible}
        appointment={null}
        defaultRecordType={defaultRecordType}
        petNames={new Map(pets.map((p) => [p.id, p.name]))}
        onComplete={() => {
          setManualRecordVisible(false);
          // Reload health records
          if (activePet) {
            getHealthRecords(activePet.id).then(setHealthRecords).catch(() => {});
          }
        }}
      />

      {/* D-161: Weight estimate sheet */}
      <WeightEstimateSheet
        pet={activePet}
        visible={weightEstimateVisible}
        onClose={() => setWeightEstimateVisible(false)}
        onUpdate={() => {
          // Refresh pet data from store (updatePet already syncs)
        }}
        onLearnMore={() => {
          setWeightEstimateVisible(false);
          navigation.navigate('BCSReference', { petId: activePet.id });
        }}
      />

    </SafeAreaView>
  );
}

