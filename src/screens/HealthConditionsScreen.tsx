// Kiba — Health Conditions & Allergen Picker (M2 Session 3)
// Reached from CreatePetScreen "Continue to Health" or EditPetScreen "Health & Diet".
// D-097: Species-filtered conditions + allergens. D-119: "Perfectly Healthy" chip.
// D-106: Obesity/underweight disabled-state mutual exclusion.
// D-095: No prescriptive language — data-mapping framing only.

import React, { useState, useEffect, useCallback } from 'react';
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
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess, profileComplete } from '../utils/haptics';
import {
  getPetConditions,
  getPetAllergens,
  savePetConditions,
  savePetAllergens,
} from '../services/petService';
import { useActivePetStore } from '../stores/useActivePetStore';
import {
  getConditionsForSpecies,
  getAllergensForSpecies,
  HEALTHY_TAG,
} from '../data/conditions';
import {
  toggleCondition,
  isConditionDisabled,
  isAllergenSectionVisible,
  toggleAllergen,
  removeAllergen,
  conditionsToSavePayload,
  allergensToSavePayload,
  isProfileComplete,
} from '../utils/conditionLogic';
import type { SelectedAllergen } from '../utils/conditionLogic';
import ConditionChip from '../components/ConditionChip';
import AllergenSelector from '../components/AllergenSelector';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'HealthConditions'>;

export default function HealthConditionsScreen({ navigation, route }: Props) {
  const { petId, fromCreate } = route.params;

  // ─── Pet Data ────────────────────────────────────────────
  const pet = useActivePetStore((s) => s.pets.find((p) => p.id === petId));
  const petName = pet?.name ?? 'your pet';
  const species = pet?.species ?? 'dog';

  // ─── State ───────────────────────────────────────────────
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<SelectedAllergen[]>([]);
  const [otherSelectorVisible, setOtherSelectorVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Data ────────────────────────────────────────────────
  const conditions = getConditionsForSpecies(species);
  const standardAllergens = getAllergensForSpecies(species);
  const showAllergens = isAllergenSectionVisible(selectedConditions);

  // ─── Load Existing ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [existingConditions, existingAllergens] = await Promise.all([
          getPetConditions(petId),
          getPetAllergens(petId),
        ]);

        if (existingConditions.length > 0) {
          setSelectedConditions(existingConditions.map((c) => c.condition_tag));
        }

        if (existingAllergens.length > 0) {
          setSelectedAllergens(
            existingAllergens.map((a) => ({
              name: a.allergen,
              isCustom: a.is_custom,
            })),
          );
        }
      } catch {
        // Silently fail — empty state is fine for fresh profiles
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [petId]);

  // ─── Condition Handlers ────────────────────────────────
  const handleConditionToggle = useCallback(
    (tag: string) => {
      chipToggle();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSelectedConditions((prev) => {
        const next = toggleCondition(prev, tag);

        // If "Perfectly Healthy" selected, clear allergens (full reset)
        if (next.includes(HEALTHY_TAG)) {
          setSelectedAllergens([]);
        }

        // Allergen state preserved on allergy deselect — only section
        // visibility toggles. Orphaned allergens cleared at save time.

        return next;
      });
    },
    [],
  );

  // ─── Allergen Handlers ─────────────────────────────────
  function handleAllergenToggle(name: string, isCustom: boolean) {
    chipToggle();
    setSelectedAllergens((prev) => toggleAllergen(prev, name, isCustom));
  }

  function handleOtherSelect(name: string) {
    setSelectedAllergens((prev) => toggleAllergen(prev, name, true));
  }

  function handleRemoveCustom(name: string) {
    chipToggle();
    setSelectedAllergens((prev) => removeAllergen(prev, name));
  }

  // ─── Save ──────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const conditionTags = conditionsToSavePayload(selectedConditions);
      await savePetConditions(petId, conditionTags);

      if (selectedConditions.includes('allergy') && selectedAllergens.length > 0) {
        await savePetAllergens(petId, allergensToSavePayload(selectedAllergens));
      } else {
        // Clear orphaned allergens if allergy not selected
        await savePetAllergens(petId, []);
      }

      saveSuccess();

      // Profile completeness check
      if (pet && isProfileComplete(pet)) {
        profileComplete();
        Alert.alert(
          'Profile Complete',
          `${petName}'s scores are now fully personalized.`,
        );
      }

      if (fromCreate) {
        navigation.navigate('MeMain');
      } else {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Guard ─────────────────────────────────────────────
  if (!pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Pet not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Custom allergens (from "Other" dropdown) ──────────
  const standardNames = standardAllergens.map((a) => a.name);
  const customAllergens = selectedAllergens.filter(
    (a) => a.isCustom && !standardNames.includes(a.name),
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Health & Diet</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Section 1: Health Conditions ───────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Health Conditions</Text>
            <Text style={styles.sectionSubtitle}>
              Select any that apply to {petName}
            </Text>

            <View style={styles.chipGrid}>
              {conditions.map((cond) => (
                <ConditionChip
                  key={cond.tag}
                  label={cond.label}
                  icon={cond.icon}
                  isSelected={selectedConditions.includes(cond.tag)}
                  isSpecial={cond.tag === HEALTHY_TAG}
                  disabled={isConditionDisabled(cond.tag, selectedConditions)}
                  onToggle={() => handleConditionToggle(cond.tag)}
                />
              ))}
            </View>

            <Text style={styles.d095Subtext}>
              Tell us about {petName}'s health so we can check food ingredients
              against published guidelines.
            </Text>
          </View>

          {/* ── Section 2: Allergens (conditional) ─────────── */}
          {showAllergens && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Known Food Allergens</Text>
              <Text style={styles.sectionSubtitle}>
                Select allergens {petName} reacts to
              </Text>

              <View style={styles.chipGrid}>
                {standardAllergens.map((allergen) => (
                  <ConditionChip
                    key={allergen.name}
                    label={allergen.label}
                    isSelected={selectedAllergens.some(
                      (a) => a.name === allergen.name,
                    )}
                    onToggle={() =>
                      handleAllergenToggle(allergen.name, false)
                    }
                  />
                ))}
                {/* "Other" chip — opens searchable dropdown */}
                <ConditionChip
                  label="Other"
                  icon="add-outline"
                  isSelected={customAllergens.length > 0}
                  onToggle={() => setOtherSelectorVisible(true)}
                />
              </View>

              {/* Custom allergen chips (removable) */}
              {customAllergens.length > 0 && (
                <View style={styles.customChipRow}>
                  {customAllergens.map((a) => (
                    <TouchableOpacity
                      key={a.name}
                      style={styles.customChip}
                      onPress={() => handleRemoveCustom(a.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.customChipText}>{a.name}</Text>
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Save Button ───────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save & Continue</Text>
            )}
          </TouchableOpacity>

          {fromCreate && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => navigation.navigate('MeMain')}
              disabled={saving}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Other Allergen Modal ────────────────────────── */}
      <AllergenSelector
        selectedNames={customAllergens.map((a) => a.name)}
        onSelect={handleOtherSelect}
        visible={otherSelectorVisible}
        onClose={() => setOtherSelectorVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

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
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // Header
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
  headerSpacer: {
    width: 24,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  // Section
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  // D-095 subtext
  d095Subtext: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
    lineHeight: 16,
  },

  // Chip grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // Custom allergen chips (removable)
  customChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00B4D820',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  customChipText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // Buttons
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
