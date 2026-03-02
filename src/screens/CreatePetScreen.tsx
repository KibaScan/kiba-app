// Kiba — Create Pet Profile (Full Form)
// Accessed from Me tab → "+ Add Pet" → SpeciesSelectScreen → here.
// Species comes from route param (locked at SpeciesSelectScreen).
// See PET_PROFILE_SPEC.md §11 for field order and grouping.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess } from '../utils/haptics';
import { synthesizeDob } from '../utils/lifeStage';
import { createPet } from '../services/petService';
import { validatePetForm, isFormValid } from '../utils/petFormValidation';
import type { PetFormErrors } from '../utils/petFormValidation';
import PetPhotoSelector from '../components/PetPhotoSelector';
import BreedSelector from '../components/BreedSelector';
import type { MeStackParamList } from '../types/navigation';
import type { ActivityLevel, Sex } from '../types/pet';

type Props = NativeStackScreenProps<MeStackParamList, 'CreatePet'>;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// D-123: Species-specific activity labels. DB values unchanged.
// Dogs: Low / Moderate / High / Working (default: Moderate)
// Cats: Indoor / Indoor/Outdoor / Outdoor (default: Indoor). "Working" hidden.
const DOG_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'working', label: 'Working' },
];

const CAT_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Indoor' },
  { value: 'moderate', label: 'Indoor/Outdoor' },
  { value: 'high', label: 'Outdoor' },
];

export default function CreatePetScreen({ navigation, route }: Props) {
  const { species } = route.params;

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
  // Cat default activity: 'low' (most pet cats are indoor). Dog default: 'moderate'.
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    species === 'cat' ? 'low' : 'moderate',
  );
  const [isNeutered, setIsNeutered] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [breedSelectorVisible, setBreedSelectorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<PetFormErrors>({});

  // ─── Handlers ────────────────────────────────────────────

  function handleSexSelect(value: Sex) {
    chipToggle();
    setSex((prev) => (prev === value ? null : value));
  }

  function handleDobModeToggle(mode: 'exact' | 'approximate') {
    if (mode === dobMode) return;
    chipToggle();
    setDobMode(mode);
    setDobSet(true);
  }

  function handleActivitySelect(value: ActivityLevel) {
    chipToggle();
    setActivityLevel(value);
  }

  function adjustStepper(
    setter: (fn: (prev: number) => number) => void,
    delta: number,
    min: number,
    max: number,
  ) {
    chipToggle();
    setDobSet(true);
    setter((prev) => Math.min(max, Math.max(min, prev + delta)));
  }

  function adjustDobMonth(delta: number) {
    setDobSet(true);
    const now = new Date();
    setDobMonth((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next > 11) return 11;
      // Don't allow future months in current year
      if (dobYear === now.getFullYear() && next > now.getMonth()) {
        return now.getMonth();
      }
      return next;
    });
  }

  function adjustDobYear(delta: number) {
    setDobSet(true);
    const now = new Date();
    setDobYear((prev) => {
      const next = prev + delta;
      if (next > now.getFullYear()) return now.getFullYear();
      if (next < now.getFullYear() - 30) return now.getFullYear() - 30;
      return next;
    });
  }

  async function handleSave(skipOptional = false) {
    // Skip-for-now only validates name
    const formErrors = validatePetForm({
      name,
      weight: skipOptional ? '' : weight,
      dobMode,
      dobSet: skipOptional ? false : dobSet,
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

      if (!skipOptional && dobSet) {
        if (dobMode === 'exact') {
          dateOfBirth = new Date(dobYear, dobMonth, 1)
            .toISOString()
            .split('T')[0];
        } else {
          const synth = synthesizeDob(approxYears, approxMonths);
          dateOfBirth = synth.toISOString().split('T')[0];
          dobIsApproximate = true;
        }
      }

      const weightNum = skipOptional ? null : (weight ? parseFloat(weight) : null);

      const submittedPhotoUri = skipOptional ? null : photoUri;

      const pet = await createPet({
        user_id: '',
        name: trimmedName,
        species,
        breed: skipOptional ? null : breed,
        weight_current_lbs: weightNum,
        weight_goal_lbs: null,
        weight_updated_at: null,
        date_of_birth: dateOfBirth,
        dob_is_approximate: dobIsApproximate,
        activity_level: skipOptional ? (species === 'cat' ? 'low' : 'moderate') : activityLevel,
        is_neutered: skipOptional ? true : isNeutered,
        sex: skipOptional ? null : sex,
        photo_url: submittedPhotoUri,
        life_stage: null,
        breed_size: null,
      });

      saveSuccess();

      // Photo upload failed silently — notify user
      if (submittedPhotoUri && !pet.photo_url) {
        Alert.alert('Photo Upload', "Photo couldn't be saved — you can try again later.");
      }

      navigation.navigate('HealthConditions', { petId: pet.id, fromCreate: true });
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────

  const canSave = name.trim().length > 0 && !saving;

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
          <Text style={styles.headerTitle}>New {species === 'dog' ? 'Dog' : 'Cat'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card 1: Identity ──────────────────────────────── */}
          <View style={styles.card}>
            {/* Photo */}
            <PetPhotoSelector
              photoUrl={photoUri}
              species={species}
              onPhotoSelected={setPhotoUri}
            />

            {/* Name */}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={[styles.textInput, errors.name && styles.inputError]}
              placeholder="What's your pet's name?"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              maxLength={20}
              autoCapitalize="words"
              returnKeyType="done"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* Sex */}
            <Text style={styles.fieldLabel}>Sex</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  sex === 'male' && styles.segmentButtonActive,
                ]}
                onPress={() => handleSexSelect('male')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    sex === 'male' && styles.segmentTextActive,
                  ]}
                >
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  sex === 'female' && styles.segmentButtonActive,
                ]}
                onPress={() => handleSexSelect('female')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    sex === 'female' && styles.segmentTextActive,
                  ]}
                >
                  Female
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Card 2: Physical ──────────────────────────────── */}
          <View style={styles.card}>
            {/* Breed */}
            <Text style={styles.fieldLabel}>Breed</Text>
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setBreedSelectorVisible(true)}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.selectorText,
                  !breed && styles.selectorPlaceholder,
                ]}
              >
                {breed ?? 'Select breed'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>

            {/* Date of Birth */}
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  dobMode === 'exact' && styles.segmentButtonActive,
                ]}
                onPress={() => handleDobModeToggle('exact')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dobMode === 'exact' && styles.segmentTextActive,
                  ]}
                >
                  Exact Date
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  dobMode === 'approximate' && styles.segmentButtonActive,
                ]}
                onPress={() => handleDobModeToggle('approximate')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dobMode === 'approximate' && styles.segmentTextActive,
                  ]}
                >
                  Approximate Age
                </Text>
              </TouchableOpacity>
            </View>

            {dobMode === 'exact' ? (
              <View style={styles.dobRow}>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Month</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustDobMonth(-1)}
                    >
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{MONTHS[dobMonth]}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustDobMonth(1)}
                    >
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Year</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustDobYear(-1)}
                    >
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{dobYear}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustDobYear(1)}
                    >
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.dobRow}>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Years</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        adjustStepper(setApproxYears, -1, 0, 30)
                      }
                    >
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{approxYears}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        adjustStepper(setApproxYears, 1, 0, 30)
                      }
                    >
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Months</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        adjustStepper(setApproxMonths, -1, 0, 11)
                      }
                    >
                      <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{approxMonths}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        adjustStepper(setApproxMonths, 1, 0, 11)
                      }
                    >
                      <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}

            {/* Weight */}
            <Text style={styles.fieldLabel}>Weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.textInput, styles.weightInput, errors.weight && styles.inputError]}
                placeholder="Current weight"
                placeholderTextColor={Colors.textTertiary}
                value={weight}
                onChangeText={(v) => {
                  setWeight(v);
                  if (errors.weight) setErrors((e) => ({ ...e, weight: undefined }));
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <Text style={styles.weightSuffix}>lbs</Text>
            </View>
            {errors.weight && <Text style={styles.errorText}>{errors.weight}</Text>}
          </View>

          {/* ── Card 3: Details ──────────────────────────────── */}
          <View style={styles.card}>
            {/* Activity Level */}
            <Text style={styles.fieldLabel}>Activity Level</Text>
            <View style={styles.segmentedRow}>
              {(species === 'cat' ? CAT_ACTIVITY_LEVELS : DOG_ACTIVITY_LEVELS).map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonSmall,
                    activityLevel === level.value && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleActivitySelect(level.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      styles.segmentTextSmall,
                      activityLevel === level.value && styles.segmentTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Neutered */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Spayed / Neutered</Text>
              <Switch
                value={isNeutered}
                onValueChange={setIsNeutered}
                trackColor={{ false: Colors.cardBorder, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* ── Footer ───────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
            onPress={() => handleSave(false)}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue to Health</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleSave(true)}
            disabled={!canSave}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Breed Selector Modal */}
      <BreedSelector
        species={species}
        value={breed}
        onChange={setBreed}
        visible={breedSelectorVisible}
        onClose={() => setBreedSelectorVisible(false)}
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
    paddingBottom: Spacing.xxl,
  },

  // ── Cards ──
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  // ── Fields ──
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inputError: {
    borderColor: Colors.severityRed,
  },
  errorText: {
    fontSize: FontSizes.xs,
    color: Colors.severityRed,
    marginTop: Spacing.xs,
  },

  // ── Segmented Controls ──
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  segmentButtonSmall: {
    paddingHorizontal: Spacing.xs,
  },
  segmentButtonActive: {
    backgroundColor: '#00B4D820',
    borderColor: Colors.accent,
  },
  segmentText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextSmall: {
    fontSize: FontSizes.sm,
  },
  segmentTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── Breed Selector Trigger ──
  selectorButton: {
    height: 52,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectorText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  selectorPlaceholder: {
    color: Colors.textTertiary,
  },

  // ── DOB ──
  dobRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  dobPickerGroup: {
    flex: 1,
  },
  dobPickerLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 44,
  },
  stepperButton: {
    width: 36,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // ── Weight ──
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
  },
  weightSuffix: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Switch ──
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  switchLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // ── Buttons ──
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  skipButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
