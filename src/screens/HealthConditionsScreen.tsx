// Kiba — Health Conditions & Allergen Picker (M2 Session 3)
// Reached from CreatePetScreen "Continue to Health" or EditPetScreen "Health & Diet".
// D-097: Species-filtered conditions + allergens. D-119: "No known conditions" chip.
// D-106: Obesity/underweight disabled-state mutual exclusion.
// D-095: No prescriptive language — data-mapping framing only.

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { chipToggle, saveSuccess, profileComplete } from '../utils/haptics';
import {
  getPetConditions,
  getPetAllergens,
  savePetConditions,
  savePetAllergens,
  updatePet,
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
  toggleAllergen,
  removeAllergen,
  conditionsToSavePayload,
  allergensToSavePayload,
  isProfileComplete,
} from '../utils/conditionLogic';
import type { SelectedAllergen } from '../utils/conditionLogic';
import ConditionChip from '../components/pet/ConditionChip';
import AllergenSelector from '../components/pet/AllergenSelector';
import type { MeStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<MeStackParamList, 'HealthConditions'>;

export default function HealthConditionsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { petId, fromCreate } = route.params;

  // Hide tab bar on this pushed screen
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
        } else {
          // D-119: 0 conditions + health_reviewed_at set = "No known conditions"
          // Read fresh from store — closure-captured `pet` may be stale after await
          const freshPet = useActivePetStore.getState().pets
            .find((p) => p.id === petId);
          if (freshPet?.health_reviewed_at) {
            setSelectedConditions([HEALTHY_TAG]);
          }
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

      setSelectedConditions((prev) => toggleCondition(prev, tag));
    },
    [],
  );

  // ─── Allergen Handlers ─────────────────────────────────
  function handleAllergenToggle(name: string, isCustom: boolean) {
    chipToggle();
    const isAdding = !selectedAllergens.some(a => a.name === name);
    setSelectedAllergens((prev) => toggleAllergen(prev, name, isCustom));
    // Adding an allergen = a known condition → deselect "No known conditions"
    if (isAdding) {
      setSelectedConditions((prev) => prev.filter(t => t !== HEALTHY_TAG));
    }
  }

  function handleOtherSelect(name: string) {
    setSelectedAllergens((prev) => toggleAllergen(prev, name, true));
    // Adding from "Other" is always an add → deselect "No known conditions"
    setSelectedConditions((prev) => prev.filter(t => t !== HEALTHY_TAG));
  }

  function handleRemoveCustom(name: string) {
    chipToggle();
    setSelectedAllergens((prev) => removeAllergen(prev, name));
  }

  // ─── Save ──────────────────────────────────────────────
  const savingRef = useRef(false);

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const conditionTags = conditionsToSavePayload(selectedConditions);
      // Auto-include 'allergy' when allergens exist
      if (selectedAllergens.length > 0 && !conditionTags.includes('allergy')) {
        conditionTags.push('allergy');
      }
      await savePetConditions(petId, conditionTags);

      if (selectedAllergens.length > 0) {
        await savePetAllergens(petId, allergensToSavePayload(selectedAllergens));
      } else {
        await savePetAllergens(petId, []);
      }

      // Mark health as reviewed (distinguishes "No known conditions" from "never visited")
      await updatePet(petId, { health_reviewed_at: new Date().toISOString() });

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
        navigation.getParent()?.setOptions({
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
        navigation.popToTop();
      } else {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setSaving(false);
      savingRef.current = false;
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

  // ─── Derived state ──────────────────────────────────────
  const standardNames = standardAllergens.map((a) => a.name);
  const customAllergens = selectedAllergens.filter(
    (a) => a.isCustom && !standardNames.includes(a.name),
  );
  const isHealthy = selectedConditions.includes(HEALTHY_TAG);
  const gridConditions = conditions.filter(c => c.tag !== HEALTHY_TAG && c.tag !== 'allergy');
  const healthyChip = conditions.find(c => c.tag === HEALTHY_TAG)!;

  // Save button label — contextual count
  const conditionCount = selectedConditions.filter(t => t !== HEALTHY_TAG && t !== 'allergy').length;
  const allergenCount = selectedAllergens.length;
  let saveLabel = 'Save & Continue';
  if (conditionCount > 0 || allergenCount > 0) {
    const parts: string[] = [];
    if (conditionCount > 0) parts.push(`${conditionCount} condition${conditionCount > 1 ? 's' : ''}`);
    if (allergenCount > 0) parts.push(`${allergenCount} allergen${allergenCount > 1 ? 's' : ''}`);
    saveLabel = `Save \u00B7 ${parts.join(', ')}`;
  }

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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Conditions</Text>
            <Text style={styles.sectionInstruction}>
              Select any that apply to {petName}
            </Text>
            <Text style={styles.trustCopy}>
              Tell us about {petName}'s health so we can check food ingredients
              against published guidelines.
            </Text>

            {/* "No known conditions" — standalone above grid */}
            <ConditionChip
              label={healthyChip.label}
              icon={healthyChip.icon}
              isSelected={isHealthy}
              isSpecial
              onToggle={() => handleConditionToggle(HEALTHY_TAG)}
            />
            <View style={styles.healthyGap} />

            {/* Condition chips — dimmed when healthy is active */}
            <View style={{ opacity: isHealthy ? 0.35 : 1 }}>
              <View style={styles.chipGrid}>
                {gridConditions.map((cond) => (
                  <ConditionChip
                    key={cond.tag}
                    label={cond.label}
                    icon={cond.icon}
                    isSelected={selectedConditions.includes(cond.tag)}
                    disabled={isConditionDisabled(cond.tag, selectedConditions)}
                    onToggle={() => handleConditionToggle(cond.tag)}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* ── Section Divider ─────────────────────────────── */}
          <View style={styles.sectionDivider} />

          {/* ── Section 2: Food Allergies (always visible) ──── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Food Allergies</Text>
            <Text style={styles.sectionSubtitle}>
              Does {petName} have any known food allergies?
            </Text>

            {allergenCount > 0 && (
              <View style={styles.allergenSummary}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.severityGreen} />
                <Text style={styles.allergenSummaryText}>
                  {allergenCount} allergen{allergenCount > 1 ? 's' : ''} tracked
                </Text>
              </View>
            )}

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
        </ScrollView>

        {/* ── Fixed Footer ─────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{saveLabel}</Text>
            )}
          </TouchableOpacity>

          {fromCreate && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                navigation.getParent()?.setOptions({
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
                navigation.popToTop();
              }}
              disabled={saving}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
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
    paddingBottom: Spacing.md,
  },

  // Section (replaces card — no background/border, just spacing)
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionInstruction: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  // Trust copy — above chips, readable color
  trustCopy: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Standalone healthy chip gap
  healthyGap: {
    height: 20,
  },

  // Section divider
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.lg,
  },

  // Allergen summary
  allergenSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  allergenSummaryText: {
    fontSize: FontSizes.sm,
    color: Colors.severityGreen,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
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
  },
  primaryButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
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
