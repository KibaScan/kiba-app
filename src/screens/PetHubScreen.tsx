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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CatIcon, DogIcon, DailyFoodIcon } from '../components/icons/speciesIcons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Spacing } from '../utils/constants';
import { styles } from './pethub/PetHubStyles';
import {
  calculateScoreAccuracy,
  getStaleWeightMonths,
  formatStaleWeightMessage,
  capitalizeFirst,
  ACTIVITY_LABELS,
} from './pethub/petHubHelpers';
import { canAddPet } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import {
  getPetConditions,
  getPetAllergens,
  getMedications,
} from '../services/petService';
import { getWeightUnitPref, computePetDer } from '../utils/pantryHelpers';
import PortionCard from '../components/PortionCard';
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { calculateTreatBudget } from '../services/treatBattery';
import { useTreatBatteryStore } from '../stores/useTreatBatteryStore';
import { TreatQuickPickerSheet } from '../components/treats/TreatQuickPickerSheet';
import { getHealthRecords, getUpcomingAppointments } from '../services/appointmentService';
import { supabase } from '../services/supabase';
import HealthRecordDetailSheet from '../components/appointments/HealthRecordDetailSheet';
import WeightEstimateSheet from '../components/WeightEstimateSheet';
import { HealthConditionsCard } from '../components/pethub/HealthConditionsCard';
import { AppointmentsCard } from '../components/pethub/AppointmentsCard';
import { MedicationsCard } from '../components/pethub/MedicationsCard';
import { MedicalRecordsCard } from '../components/pethub/MedicalRecordsCard';
import { VetReportCard } from '../components/pethub/VetReportCard';
import { KCAL_PER_LB } from '../utils/weightGoal';
import type { Pet, PetCondition, PetAllergen, PetMedication } from '../types/pet';
import type { Appointment, PetHealthRecord } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';
import { PetHubShareCard } from '../components/pet/PetShareCard';
import { captureAndShare } from '../utils/shareCard';
import { canExportVetReport } from '../utils/permissions';
import { getPantryForPet, refreshWetReserve, transitionToCustomMode, transitionFromCustomMode } from '../services/pantryService';
import { updatePet } from '../services/petService';
import { FeedingStyleSetupSheet } from '../components/pantry/FeedingStyleSetupSheet';
import type { FeedingStyle } from '../types/pet';
import { assembleVetReportData } from '../services/vetReportService';
import { generateVetReportHTML } from '../utils/vetReportHTML';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

const FEEDING_STYLE_LABELS: Record<string, string> = {
  dry_only: 'Dry only',
  dry_and_wet: 'Mixed',
  wet_only: 'Wet only',
  custom: 'Custom',
};

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

  // ─── Vet Report ─────────────────────────────────────────
  const [vetReportLoading, setVetReportLoading] = useState(false);

  const handleGenerateVetReport = useCallback(async () => {
    if (!activePet) return;

    // Premium gate
    if (!canExportVetReport()) {
      Alert.alert(
        'Premium Feature',
        'Upgrade to Kiba Premium to generate vet diet reports.',
        [{ text: 'OK' }],
      );
      return;
    }

    // Empty pantry guard — synchronous check before any async work
    try {
      const pantryCards = await getPantryForPet(activePet.id);
      const assignedItems = pantryCards.filter(c => c.is_active);

      if (assignedItems.length === 0) {
        Alert.alert(
          'No Foods Tracked',
          `Add products to ${activePet.name}'s pantry for a complete diet report.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Pantry',
              onPress: () => (navigation.getParent() as any)?.navigate('Pantry', { screen: 'PantryMain' }),
            },
          ],
        );
        return;
      }

      setVetReportLoading(true);

      // Assemble data → HTML → PDF → Share
      const reportData = await assembleVetReportData(activePet.id, pantryCards);
      const html = generateVetReportHTML(reportData);

      const { uri } = await Print.printToFileAsync({
        html,
        width: 612,  // US Letter
        height: 792,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${activePet.name} — Vet Diet Report`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Report Error', message);
    } finally {
      setVetReportLoading(false);
    }
  }, [activePet, navigation]);

  // ─── Health data (screen-scoped, reloaded on focus) ─────
  const [conditions, setConditions] = useState<PetCondition[]>([]);
  const [allergens, setAllergens] = useState<PetAllergen[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // ─── Medications (M6) ─────────────────────────────────
  const [medications, setMedications] = useState<PetMedication[]>([]);

  // ─── Health records (D-163) ────────────────────────────
  const [healthRecords, setHealthRecords] = useState<PetHealthRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Health record detail sheet
  const [selectedRecord, setSelectedRecord] = useState<PetHealthRecord | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  // ─── D-161: Weight estimate sheet ──────────────────────
  const [weightEstimateVisible, setWeightEstimateVisible] = useState(false);

  // ─── Treat quick picker (D-124 revised) ────────────────
  const [treatPickerVisible, setTreatPickerVisible] = useState(false);
  const [feedingStyleSheetVisible, setFeedingStyleSheetVisible] = useState(false);
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
    }, [activePet?.id, treatBatteryReset]),
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
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
              <LinearGradient
                colors={['#00B4D8', '#0077B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
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
            {activePet.species === 'cat' ? (
              <CatIcon size={16} color={Colors.accent} />
            ) : (
              <DogIcon size={16} color={Colors.accent} />
            )}
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
          <TouchableOpacity
            style={styles.statChip}
            activeOpacity={0.6}
            onPress={() => setFeedingStyleSheetVisible(true)}
          >
            <DailyFoodIcon size={24} color={Colors.accent} />
            <Text style={styles.statValue}>
              {FEEDING_STYLE_LABELS[activePet.feeding_style] ?? 'Dry only'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={Colors.textTertiary} />
          </TouchableOpacity>
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
        <HealthConditionsCard
          pet={activePet}
          conditions={conditions}
          allergens={allergens}
          healthLoading={healthLoading}
          navigation={navigation}
        />

        {/* Appointments */}
        <AppointmentsCard
          appointments={appointments}
          setAppointments={setAppointments}
          navigation={navigation}
        />

        {/* Medications (M6) — display-only, no scoring impact */}
        <MedicationsCard
          pet={activePet}
          medications={medications}
          setMedications={setMedications}
          conditionTags={conditionTags}
          navigation={navigation}
        />

        {/* Medical Records — unified chronological timeline */}
        <MedicalRecordsCard
          pet={activePet}
          healthRecords={healthRecords}
          setHealthRecords={setHealthRecords}
          onOpenDetail={(r) => { setSelectedRecord(r); setDetailSheetVisible(true); }}
          navigation={navigation}
        />

        {/* Vet Report (M6) — wrapped in card to match dashboard pattern */}
        <VetReportCard
          loading={vetReportLoading}
          onPress={handleGenerateVetReport}
        />

        {/* Health disclaimer (D-163) — bottom of scroll */}
        <Text style={styles.healthDisclaimer}>
          Health records are for your reference. Consult your veterinarian for your pet's care schedule.
        </Text>

        <View style={styles.scrollBottomSpacer} />
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

      {/* Health record detail/edit sheet */}
      <HealthRecordDetailSheet
        visible={detailSheetVisible}
        record={selectedRecord}
        onClose={() => { setDetailSheetVisible(false); setSelectedRecord(null); }}
        onUpdated={() => {
          if (activePet) {
            getHealthRecords(activePet.id).then(setHealthRecords).catch(() => { });
          }
        }}
      />

      {/* Feeding style picker */}
      {activePet && (
        <FeedingStyleSetupSheet
          isVisible={feedingStyleSheetVisible}
          petName={activePet.name}
          onSelect={async (style: FeedingStyle) => {
            const prev = activePet.feeding_style;
            if (style === 'custom') {
              await transitionToCustomMode(activePet.id);
              useActivePetStore.getState().loadPets();
              setFeedingStyleSheetVisible(false);
              navigation.navigate('CustomFeedingStyle', { petId: activePet.id });
            } else if (prev === 'custom') {
              await transitionFromCustomMode(activePet.id, style);
              useActivePetStore.getState().loadPets();
              setFeedingStyleSheetVisible(false);
            } else {
              await updatePet(activePet.id, { feeding_style: style });
              useActivePetStore.getState().loadPets();
              setFeedingStyleSheetVisible(false);
              if (style === 'dry_and_wet' || prev === 'dry_and_wet') {
                refreshWetReserve(activePet.id).catch(() => {});
              }
            }
          }}
          onDismiss={() => setFeedingStyleSheetVisible(false)}
        />
      )}

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

