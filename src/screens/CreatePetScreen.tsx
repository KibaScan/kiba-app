// Kiba — Create Pet Profile (Full Form)
// Accessed from Me tab → "+ Add Pet" → SpeciesSelectScreen → here.
// Species comes from route param (locked at SpeciesSelectScreen).
// See PET_PROFILE_SPEC.md §11 for field order and grouping.

import React, { useState, useRef, useLayoutEffect } from 'react';
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
import { synthesizeDob, formatLocalDate } from '../utils/lifeStage';
import { createPet } from '../services/petService';
import { validatePetForm, isFormValid } from '../utils/petFormValidation';
import type { PetFormErrors } from '../utils/petFormValidation';
import { convertToKg, convertFromKg, setWeightUnitPref } from '../utils/pantryHelpers';
import PetPhotoSelector from '../components/pet/PetPhotoSelector';
import BreedSelector from '../components/pet/BreedSelector';
import WheelPicker, {
  SHORT_MONTHS,
  CURRENT_YEAR,
  YEAR_ITEMS,
  APPROX_YEARS,
  APPROX_MONTHS_ITEMS,
} from '../components/pet/WheelPicker';
import type { MeStackParamList } from '../types/navigation';
import type { ActivityLevel, Sex } from '../types/pet';

type Props = NativeStackScreenProps<MeStackParamList, 'CreatePet'>;

// D-123: Species-specific activity labels. DB values unchanged.
// Dogs: Low / Moderate / High / Working (default: Moderate)
// Cats: Indoor / Mixed / Outdoor (default: Indoor). "Working" hidden.
const DOG_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'working', label: 'Working' },
];

const CAT_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Indoor' },
  { value: 'moderate', label: 'Mixed' },
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
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  // Cat default activity: 'low' (most pet cats are indoor). Dog default: 'moderate'.
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    species === 'cat' ? 'low' : 'moderate',
  );
  const [isNeutered, setIsNeutered] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [breedSelectorVisible, setBreedSelectorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<PetFormErrors>({});

  // Hide tab bar on this screen (matches EditPet / HealthConditions pattern)
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

  const savingRef = useRef(false);

  async function handleSave(skipOptional = false) {
    if (savingRef.current) return;
    savingRef.current = true;

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
    if (!isFormValid(formErrors)) {
      savingRef.current = false;
      return;
    }

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

      const submittedPhotoUri = photoUri;

      const pet = await createPet({
        user_id: '',
        name: trimmedName,
        species,
        breed,
        weight_current_lbs: weightLbs,
        weight_goal_lbs: null,
        weight_updated_at: null,
        date_of_birth: dateOfBirth,
        dob_is_approximate: dobIsApproximate,
        activity_level: activityLevel,
        is_neutered: isNeutered,
        sex,
        photo_url: submittedPhotoUri,
        life_stage: null,
        breed_size: null,
        health_reviewed_at: null,
        weight_goal_level: null,
        caloric_accumulator: null,
        accumulator_last_reset_at: null,
        accumulator_notification_sent: null,
        bcs_score: null,
        bcs_assessed_at: null,
        feeding_style: 'dry_only',
        wet_reserve_kcal: 0,
        wet_reserve_source: null,
      });

      saveSuccess();

      const navigateNext = () => {
        if (skipOptional) {
          navigation.popToTop();
        } else {
          navigation.navigate('HealthConditions', { petId: pet.id, fromCreate: true });
        }
      };

      if (submittedPhotoUri && !pet.photo_url) {
        Alert.alert('Photo Upload', "Photo couldn't be saved — you can try again later.", [
          { text: 'OK', onPress: navigateNext },
        ]);
      } else {
        navigateNext();
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
      savingRef.current = false;
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
                  Estimate
                </Text>
              </TouchableOpacity>
            </View>

            {dobMode === 'exact' ? (
              <View style={styles.dobRow}>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Month</Text>
                  <WheelPicker
                    items={SHORT_MONTHS}
                    selectedIndex={dobMonth}
                    onSelect={(i) => {
                      setDobSet(true);
                      const now = new Date();
                      if (dobYear === now.getFullYear() && i > now.getMonth()) return;
                      setDobMonth(i);
                    }}
                  />
                </View>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Year</Text>
                  <WheelPicker
                    items={YEAR_ITEMS}
                    selectedIndex={dobYear - (CURRENT_YEAR - 30)}
                    onSelect={(i) => {
                      setDobSet(true);
                      const yr = CURRENT_YEAR - 30 + i;
                      setDobYear(yr);
                      const now = new Date();
                      if (yr === now.getFullYear() && dobMonth > now.getMonth()) {
                        setDobMonth(now.getMonth());
                      }
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.dobRow}>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Years</Text>
                  <WheelPicker
                    items={APPROX_YEARS}
                    selectedIndex={approxYears}
                    onSelect={(i) => {
                      setDobSet(true);
                      setApproxYears(i);
                    }}
                  />
                </View>
                <View style={styles.dobPickerGroup}>
                  <Text style={styles.dobPickerLabel}>Months</Text>
                  <WheelPicker
                    items={APPROX_MONTHS_ITEMS}
                    selectedIndex={approxMonths}
                    onSelect={(i) => {
                      setDobSet(true);
                      setApproxMonths(i);
                    }}
                  />
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
              <View style={styles.weightChipRow}>
                {(['lbs', 'kg'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.weightChip, weightUnit === u && styles.weightChipSelected]}
                    onPress={() => handleWeightUnitChange(u)}
                  >
                    <Text style={[styles.weightChipText, weightUnit === u && styles.weightChipTextSelected]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    paddingBottom: 88,
  },

  // ── Cards ──
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
    borderColor: Colors.hairlineBorder,
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
    backgroundColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentButtonSmall: {
    paddingHorizontal: Spacing.xs,
  },
  segmentButtonActive: {
    backgroundColor: '#00B4D820',
    borderColor: Colors.accent,
    borderWidth: 1,
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
    borderColor: Colors.hairlineBorder,
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
  // ── Weight ──
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
  },
  weightChipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  weightChip: {
    backgroundColor: Colors.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  weightChipSelected: {
    backgroundColor: '#00B4D820',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  weightChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  weightChipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
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
    opacity: 0.5,
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
