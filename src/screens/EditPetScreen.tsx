// Kiba — Edit Pet Profile
// Pre-populated form with existing pet data. Species locked (not shown).
// Save Changes + Delete with typed name confirmation.
// See PET_PROFILE_SPEC.md §11 for edit screen differences.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess, deleteConfirm } from '../utils/haptics';
import { synthesizeDob, formatLocalDate, parseDateString } from '../utils/lifeStage';
import { updatePet, deletePet } from '../services/petService';
import { validatePetForm, isFormValid, canDeletePet } from '../utils/petFormValidation';
import type { PetFormErrors } from '../utils/petFormValidation';
import { useActivePetStore } from '../stores/useActivePetStore';
import PetPhotoSelector from '../components/pet/PetPhotoSelector';
import BreedSelector from '../components/pet/BreedSelector';
import type { MeStackParamList } from '../types/navigation';
import type { ActivityLevel, Sex } from '../types/pet';

type Props = NativeStackScreenProps<MeStackParamList, 'EditPet'>;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// D-123: Species-specific activity labels. DB values unchanged.
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [breedSelectorVisible, setBreedSelectorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<PetFormErrors>({});

  // ─── Delete Modal State ──────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ─── Pre-populate from existing pet ──────────────────────
  useEffect(() => {
    if (!pet) return;

    setName(pet.name);
    setSex(pet.sex);
    setBreed(pet.breed);
    setActivityLevel(pet.activity_level);
    setIsNeutered(pet.is_neutered);
    setPhotoUri(pet.photo_url);

    if (pet.weight_current_lbs != null) {
      setWeight(String(pet.weight_current_lbs));
    }

    if (pet.date_of_birth) {
      setDobSet(true);
      const { year, month } = parseDateString(pet.date_of_birth);
      if (pet.dob_is_approximate) {
        setDobMode('approximate');
        // Reverse-calculate approximate years/months from stored DOB
        const now = new Date();
        const totalMonths =
          (now.getFullYear() - year) * 12 +
          (now.getMonth() - month);
        setApproxYears(Math.floor(totalMonths / 12));
        setApproxMonths(totalMonths % 12);
      } else {
        setDobMode('exact');
        setDobMonth(month);
        setDobYear(year);
      }
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

      const updatedPet = await updatePet(petId, {
        name: trimmedName,
        breed,
        weight_current_lbs: weightNum,
        date_of_birth: dateOfBirth,
        dob_is_approximate: dobIsApproximate,
        activity_level: activityLevel,
        is_neutered: isNeutered,
        sex,
        photo_url: photoUri,
      });

      saveSuccess();

      // Photo upload failed silently — notify user
      if (photoUri && !photoUri.startsWith('http') && !updatedPet.photo_url) {
        Alert.alert('Photo Upload', "Photo couldn't be saved — you can try again later.");
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
          <View style={styles.card}>
            {/* Photo */}
            <PetPhotoSelector
              photoUrl={photoUri}
              species={pet.species}
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
              {(pet.species === 'cat' ? CAT_ACTIVITY_LEVELS : DOG_ACTIVITY_LEVELS).map((level) => (
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

          {/* ── Health & Diet Link ────────────────────────────── */}
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('HealthConditions', { petId })}
          >
            <Ionicons
              name="heart-outline"
              size={22}
              color={Colors.textSecondary}
            />
            <Text style={styles.linkText}>Health & Diet</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>

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
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>Delete {name.trim() || pet.name}?</Text>
            <Text style={styles.deleteDescription}>
              This will permanently delete {name.trim() || pet.name} and all associated scan
              history. This cannot be undone. Type{' '}
              <Text style={styles.deleteBold}>{name.trim() || pet.name}</Text> to confirm.
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder={name.trim() || pet.name}
              placeholderTextColor={Colors.textTertiary}
              value={deleteInput}
              onChangeText={setDeleteInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  !canConfirmDelete && styles.buttonDisabled,
                ]}
                onPress={handleDelete}
                disabled={!canConfirmDelete}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // ── Health & Diet Link ──
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  linkText: {
    flex: 1,
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

  // ── Delete Modal ──
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  deleteModal: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  deleteTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  deleteDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  deleteBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deleteInput: {
    height: 48,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  deleteCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  deleteCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deleteConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.severityRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
