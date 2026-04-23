// Kiba — Edit Pet Profile
// Pre-populated form with existing pet data. Species locked (not shown).
// Save Changes + Delete with typed name confirmation.
// See PET_PROFILE_SPEC.md §11 for edit screen differences.

import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess, deleteConfirm } from '../utils/haptics';
import { synthesizeDob, formatLocalDate, parseDateString } from '../utils/lifeStage';
import { updatePet, deletePet, getPetConditions, getPetAllergens } from '../services/petService';
import { FeedingStyleSetupSheet } from '../components/pantry/FeedingStyleSetupSheet';
import { transitionToCustomMode, transitionFromCustomMode } from '../services/pantryService';
import type { FeedingStyle } from '../types/pet';
import { validatePetForm, isFormValid, canDeletePet } from '../utils/petFormValidation';
import type { PetFormErrors } from '../utils/petFormValidation';
import { convertToKg, convertFromKg, getWeightUnitPref, setWeightUnitPref } from '../utils/pantryHelpers';
import { useActivePetStore } from '../stores/useActivePetStore';
import BreedSelector from '../components/pet/BreedSelector';
import { CURRENT_YEAR } from '../components/pet/WheelPicker';
import type { MeStackParamList } from '../types/navigation';
import type { ActivityLevel, Sex } from '../types/pet';
import { IdentityCard } from '../components/pet/edit/IdentityCard';
import { PhysicalCard } from '../components/pet/edit/PhysicalCard';
import { DetailsCard } from '../components/pet/edit/DetailsCard';
import { HealthDietLinkRow } from '../components/pet/edit/HealthDietLinkRow';
import { DeletePetModal } from '../components/pet/edit/DeletePetModal';

type Props = NativeStackScreenProps<MeStackParamList, 'EditPet'>;

export default function EditPetScreen({ navigation, route }: Props) {
  const { petId } = route.params;
  const pet = useActivePetStore((s) => s.pets.find((p) => p.id === petId));

  // ─── Form State ──────────────────────────────────────────
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [breed, setBreed] = useState<string | null>(null);
  const [dobMode, setDobMode] = useState<'exact' | 'approximate'>('exact');
  const [dobMonth, setDobMonth] = useState(new Date().getMonth());
  const [dobYear, setDobYear] = useState(new Date().getFullYear());
  const [approxYears, setApproxYears] = useState(0);
  const [approxMonths, setApproxMonths] = useState(0);
  const [dobSet, setDobSet] = useState(false);
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [isNeutered, setIsNeutered] = useState(true);
  const [feedingStyle, setFeedingStyle] = useState<FeedingStyle>('dry_only');
  const [showFeedingStyleSheet, setShowFeedingStyleSheet] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [breedSelectorVisible, setBreedSelectorVisible] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<PetFormErrors>({});

  // ─── Health counts ────────────────────────────────────────
  const [conditionCount, setConditionCount] = useState(0);
  const [allergenCount, setAllergenCount] = useState(0);

  // ─── Delete Modal State ──────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ─── Hide tab bar (#5) ───────────────────────────────────
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({
        tabBarStyle: {
          position: 'absolute' as const,
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
      });
    };
  }, [navigation]);

  // ─── Fetch health counts (#7) ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [conds, allergens] = await Promise.all([
            getPetConditions(petId),
            getPetAllergens(petId),
          ]);
          setConditionCount(conds.length);
          setAllergenCount(allergens.length);
        } catch {}
      })();
    }, [petId])
  );

  // ─── Pre-populate from existing pet ──────────────────────
  useEffect(() => {
    if (!pet) return;

    setName(pet.name);
    setSex(pet.sex);
    setBreed(pet.breed);
    setActivityLevel(pet.activity_level);
    setIsNeutered(pet.is_neutered);
    setFeedingStyle(pet.feeding_style ?? 'dry_only');
    setPhotoUri(pet.photo_url);

    if (pet.weight_current_lbs != null) {
      getWeightUnitPref().then((pref) => {
        setWeightUnit(pref);
        if (pref === 'kg') {
          setWeight((pet.weight_current_lbs! / 2.205).toFixed(1));
        } else {
          setWeight(String(pet.weight_current_lbs));
        }
      });
    }

    if (pet.date_of_birth) {
      setDobSet(true);
      const { year, month } = parseDateString(pet.date_of_birth);

      // Always populate both representations so mode switching preserves values
      setDobMonth(month);
      setDobYear(year);

      const now = new Date();
      const totalMonths = (now.getFullYear() - year) * 12 + (now.getMonth() - month);
      setApproxYears(Math.max(0, Math.floor(totalMonths / 12)));
      setApproxMonths(Math.max(0, totalMonths % 12));

      setDobMode(pet.dob_is_approximate ? 'approximate' : 'exact');
    }
  }, [pet]);

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Pet not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Handlers ────────────────────────────────────────────

  function handleSexSelect(value: Sex) {
    chipToggle();
    setSex((prev) => (prev === value ? null : value));
  }

  function handleDobModeToggle(mode: 'exact' | 'approximate') {
    if (mode === dobMode) return;
    chipToggle();
    if (mode === 'approximate') {
      const now = new Date();
      const totalMonths = (now.getFullYear() - dobYear) * 12 + (now.getMonth() - dobMonth);
      setApproxYears(Math.max(0, Math.floor(totalMonths / 12)));
      setApproxMonths(Math.max(0, totalMonths % 12));
    } else {
      const dob = synthesizeDob(approxYears, approxMonths);
      setDobMonth(dob.getMonth());
      setDobYear(dob.getFullYear());
    }
    setDobMode(mode);
    setDobSet(true);
  }

  function handleActivitySelect(value: ActivityLevel) {
    chipToggle();
    setActivityLevel(value);
  }

  function handleWeightUnitChange(newUnit: 'lbs' | 'kg') {
    if (newUnit === weightUnit) return;
    chipToggle();
    if (weight) {
      const val = parseFloat(weight);
      if (!isNaN(val) && val > 0) {
        const converted =
          newUnit === 'kg'
            ? convertToKg(val, 'lbs')
            : convertFromKg(val, 'lbs');
        setWeight(converted.toFixed(1));
      }
    }
    setWeightUnit(newUnit);
    setWeightUnitPref(newUnit);
  }

  async function handleSave() {
    const formErrors = validatePetForm({
      name,
      weight,
      dobMode,
      dobSet,
      dobMonth,
      dobYear,
      approxYears,
      approxMonths,
    });

    setErrors(formErrors);
    if (!isFormValid(formErrors)) return;

    const trimmedName = name.trim();
    setSaving(true);
    try {
      let dateOfBirth: string | null = null;
      let dobIsApproximate = false;

      if (dobSet) {
        if (dobMode === 'exact') {
          dateOfBirth = formatLocalDate(new Date(dobYear, dobMonth, 1));
        } else {
          dateOfBirth = formatLocalDate(synthesizeDob(approxYears, approxMonths));
          dobIsApproximate = true;
        }
      }

      const weightNum = weight ? parseFloat(weight) : null;
      const weightLbs =
        weightNum && weightUnit === 'kg'
          ? parseFloat((weightNum * 2.205).toFixed(1))
          : weightNum;

      const updatedPet = await updatePet(petId, {
        name: trimmedName,
        breed,
        weight_current_lbs: weightLbs,
        date_of_birth: dateOfBirth,
        dob_is_approximate: dobIsApproximate,
        activity_level: activityLevel,
        is_neutered: isNeutered,
        feeding_style: feedingStyle,
        sex,
        photo_url: photoUri,
      });

      saveSuccess();

      // Photo upload failed silently — notify user
      if (photoUri && !photoUri.startsWith('http') && !updatedPet.photo_url) {
        Alert.alert('Photo Upload', "Photo couldn't be saved — you can try again later.");
      }

      // Handle feeding style transitions
      if (pet && feedingStyle !== pet.feeding_style) {
        if (feedingStyle === 'custom') {
          await transitionToCustomMode(petId);
          navigation.replace('CustomFeedingStyle', { petId });
          return;
        } else if (pet.feeding_style === 'custom') {
          await transitionFromCustomMode(petId, feedingStyle as Exclude<FeedingStyle, 'custom'>);
        }
      }

      navigation.navigate('MeMain');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      deleteConfirm();
      await deletePet(petId);
      setDeleteModalVisible(false);

      // Navigate based on remaining pets
      const remainingPets = useActivePetStore.getState().pets;
      if (remainingPets.length === 0) {
        navigation.navigate('SpeciesSelect');
      } else {
        navigation.navigate('MeMain');
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────

  const canSave = name.trim().length > 0 && !saving;
  const canConfirmDelete = canDeletePet(deleteInput, pet.name) && !deleting;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card 1: Identity ──────────────────────────────── */}
          <IdentityCard
            photoUri={photoUri}
            species={pet.species}
            onPhotoSelected={setPhotoUri}
            name={name}
            onNameChange={(v) => {
              setName(v);
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
            }}
            nameError={errors.name}
            sex={sex}
            onSexSelect={handleSexSelect}
          />

          {/* ── Card 2: Physical ──────────────────────────────── */}
          <PhysicalCard
            breed={breed}
            onOpenBreedSelector={() => setBreedSelectorVisible(true)}
            dobMode={dobMode}
            onDobModeToggle={handleDobModeToggle}
            dobMonth={dobMonth}
            onDobMonthSelect={(i) => {
              setDobSet(true);
              const now = new Date();
              if (dobYear === now.getFullYear() && i > now.getMonth()) return;
              setDobMonth(i);
            }}
            dobYear={dobYear}
            onDobYearSelect={(i) => {
              setDobSet(true);
              const yr = CURRENT_YEAR - 30 + i;
              setDobYear(yr);
              const now = new Date();
              if (yr === now.getFullYear() && dobMonth > now.getMonth()) {
                setDobMonth(now.getMonth());
              }
            }}
            approxYears={approxYears}
            onApproxYearsSelect={(i) => {
              setDobSet(true);
              setApproxYears(i);
            }}
            approxMonths={approxMonths}
            onApproxMonthsSelect={(i) => {
              setDobSet(true);
              setApproxMonths(i);
            }}
            dobError={errors.dob}
            weight={weight}
            onWeightChange={(v) => {
              setWeight(v);
              if (errors.weight) setErrors((e) => ({ ...e, weight: undefined }));
            }}
            weightUnit={weightUnit}
            onWeightUnitChange={handleWeightUnitChange}
            weightError={errors.weight}
          />

          {/* ── Card 3: Details ──────────────────────────────── */}
          <DetailsCard
            species={pet.species}
            activityLevel={activityLevel}
            onActivitySelect={handleActivitySelect}
            feedingStyle={feedingStyle}
            onOpenFeedingStyle={() => setShowFeedingStyleSheet(true)}
            isNeutered={isNeutered}
            setIsNeutered={setIsNeutered}
          />

          {/* ── Health & Diet Link ────────────────────────────── */}
          <HealthDietLinkRow
            healthReviewedAt={pet.health_reviewed_at}
            conditionCount={conditionCount}
            allergenCount={allergenCount}
            onPress={() => navigation.navigate('HealthConditions', { petId })}
          />

          {/* ── Save Button ──────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {/* ── Delete Button ────────────────────────────────── */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              setDeleteInput('');
              setDeleteModalVisible(true);
            }}
          >
            <Text style={styles.deleteButtonText}>Delete {name.trim() || pet.name}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Breed Selector Modal */}
      <BreedSelector
        species={pet.species}
        value={breed}
        onChange={setBreed}
        visible={breedSelectorVisible}
        onClose={() => setBreedSelectorVisible(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeletePetModal
        visible={deleteModalVisible}
        petDisplayName={name.trim() || pet.name}
        deleteInput={deleteInput}
        setDeleteInput={setDeleteInput}
        canConfirmDelete={canConfirmDelete}
        deleting={deleting}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDelete}
      />

      {/* Feeding Style Sheet */}
      <FeedingStyleSetupSheet
        isVisible={showFeedingStyleSheet}
        petName={pet.name}
        onSelect={(style: FeedingStyle) => {
          setFeedingStyle(style);
          setShowFeedingStyleSheet(false);
        }}
        onDismiss={() => setShowFeedingStyleSheet(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSpacer: { width: 24 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 88,
  },

  // ── Buttons ──
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    color: Colors.severityRed,
    fontWeight: '600',
  },
});
