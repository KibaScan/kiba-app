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
  Image,
  Alert,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess, deleteConfirm } from '../utils/haptics';
import { synthesizeDob } from '../utils/lifeStage';
import { updatePet, deletePet } from '../services/petService';
import { useActivePetStore } from '../stores/useActivePetStore';
import BreedSelector from '../components/BreedSelector';
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
      if (pet.dob_is_approximate) {
        setDobMode('approximate');
        // Reverse-calculate approximate years/months from stored DOB
        const dob = new Date(pet.date_of_birth);
        const now = new Date();
        const totalMonths =
          (now.getFullYear() - dob.getFullYear()) * 12 +
          (now.getMonth() - dob.getMonth());
        setApproxYears(Math.floor(totalMonths / 12));
        setApproxMonths(totalMonths % 12);
      } else {
        setDobMode('exact');
        const dob = new Date(pet.date_of_birth);
        setDobMonth(dob.getMonth());
        setDobYear(dob.getFullYear());
      }
    }
  }, [pet]);

  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Pet not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Handlers ────────────────────────────────────────────

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter a name for your pet.');
      return;
    }

    setSaving(true);
    try {
      let dateOfBirth: string | null = null;
      let dobIsApproximate = false;

      if (dobSet) {
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

      const weightNum = weight ? parseFloat(weight) : null;

      await updatePet(petId, {
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
      navigation.navigate('MeMain');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────

  const canSave = name.trim().length > 0 && !saving;
  const canDelete =
    deleteInput.toLowerCase() === pet.name.toLowerCase() && !deleting;

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
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handlePickPhoto}
              activeOpacity={0.7}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="paw" size={40} color={Colors.accent} />
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <Ionicons name="camera" size={14} color={Colors.textPrimary} />
              </View>
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What's your pet's name?"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoCapitalize="words"
              returnKeyType="done"
            />

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

            {/* Weight */}
            <Text style={styles.fieldLabel}>Weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.textInput, styles.weightInput]}
                placeholder="Current weight"
                placeholderTextColor={Colors.textTertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <Text style={styles.weightSuffix}>lbs</Text>
            </View>
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
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.6}>
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
            <Text style={styles.deleteButtonText}>Delete {pet.name}</Text>
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
            <Text style={styles.deleteTitle}>Delete {pet.name}?</Text>
            <Text style={styles.deleteDescription}>
              This action cannot be undone. Type{' '}
              <Text style={styles.deleteBold}>{pet.name}</Text> to confirm.
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder={pet.name}
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
                  !canDelete && styles.buttonDisabled,
                ]}
                onPress={handleDelete}
                disabled={!canDelete}
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
  errorText: {
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

  // ── Photo ──
  photoContainer: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
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
    opacity: 0.4,
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
