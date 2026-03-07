// Kiba — Pet Hub Screen (M2 Session 5)
// Central pet management screen on the Me tab. Replaces M1 placeholder MeScreen.
// D-120: Multi-pet carousel. D-117: Stale weight indicator. D-094: Pet name in context.
// D-084: Zero emoji — Ionicons only. D-086: Dark theme.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { isPremium, canAddPet } from '../utils/permissions';
import { deleteConfirm } from '../utils/haptics';
import DevMenu from '../components/DevMenu';
import { useActivePetStore } from '../stores/useActivePetStore';
import {
  getPetConditions,
  getPetAllergens,
  deletePet,
} from '../services/petService';
import { getConditionsForSpecies } from '../data/conditions';
import { canDeletePet } from '../utils/petFormValidation';
import {
  calculateRER,
  getDerMultiplier,
  lbsToKg,
} from '../services/portionCalculator';
import { getAgeMonths } from '../components/PortionCard';
import PortionCard from '../components/PortionCard';
import TreatBatteryGauge from '../components/TreatBatteryGauge';
import { calculateTreatBudget } from '../services/treatBattery';
import type { Pet, PetCondition, PetAllergen } from '../types/pet';
import type { MeStackParamList } from '../types/navigation';

// ─── Exported Pure Helpers (testable) ─────────────────────

/**
 * Score Accuracy: name 20% + species 20% + breed 15% + DOB 15% + weight 15% + conditions 15%.
 * `healthReviewed` is true when `pet.health_reviewed_at` is non-null.
 */
export function calculateScoreAccuracy(pet: Pet, healthReviewed: boolean): number {
  let score = 0;
  if (pet.name) score += 20;
  if (pet.species) score += 20;
  if (pet.breed) score += 15;
  if (pet.date_of_birth) score += 15;
  if (pet.weight_current_lbs != null) score += 15;
  if (healthReviewed) score += 15;
  return score;
}

/**
 * Months since weight_updated_at. Returns null if no weight timestamp set.
 */
export function getStaleWeightMonths(
  weightUpdatedAt: string | null,
  now?: Date,
): number | null {
  if (!weightUpdatedAt) return null;
  const updated = new Date(weightUpdatedAt);
  if (isNaN(updated.getTime())) return null;
  const ref = now ?? new Date();
  const months =
    (ref.getFullYear() - updated.getFullYear()) * 12 +
    (ref.getMonth() - updated.getMonth());
  return Math.max(0, months);
}

/**
 * Stale weight prompt message. Singular/plural "month(s)".
 */
export function formatStaleWeightMessage(months: number): string {
  const unit = months === 1 ? 'month' : 'months';
  return `Weight last updated ${months} ${unit} ago \u2014 still accurate?`;
}

// ─── Internal Helpers ─────────────────────────────────────

function computeDER(pet: Pet): number | null {
  if (pet.weight_current_lbs == null) return null;
  const ageMonths = getAgeMonths(pet.date_of_birth) ?? undefined;
  const rer = calculateRER(lbsToKg(pet.weight_current_lbs));
  const { multiplier } = getDerMultiplier({
    species: pet.species,
    lifeStage: pet.life_stage,
    isNeutered: pet.is_neutered,
    activityLevel: pet.activity_level,
    ageMonths,
  });
  return Math.round(rer * multiplier);
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ACTIVITY_LABELS: Record<string, Record<string, string>> = {
  dog: { low: 'Low', moderate: 'Moderate', high: 'High', working: 'Working' },
  cat: { low: 'Indoor', moderate: 'Indoor-Outdoor', high: 'Outdoor' },
};

// ─── Component ────────────────────────────────────────────

type Props = NativeStackScreenProps<MeStackParamList, 'MeMain'>;

export default function PetHubScreen({ navigation }: Props) {
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);
  const setActivePet = useActivePetStore((s) => s.setActivePet);
  const removePet = useActivePetStore((s) => s.removePet);
  const activePet = pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;

  // ─── Health data (screen-scoped, reloaded on focus) ─────
  const [conditions, setConditions] = useState<PetCondition[]>([]);
  const [allergens, setAllergens] = useState<PetAllergen[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // ─── Delete modal ───────────────────────────────────────
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ─── Dev menu (tap version 5 times) ────────────────────
  const [devMenuVisible, setDevMenuVisible] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);

  // ─── Load conditions/allergens on focus or active pet change ──
  useFocusEffect(
    useCallback(() => {
      if (!activePet) return;
      let cancelled = false;
      setHealthLoading(true);

      Promise.all([
        getPetConditions(activePet.id),
        getPetAllergens(activePet.id),
      ])
        .then(([conds, allergs]) => {
          if (!cancelled) {
            setConditions(conds);
            setAllergens(allergs);
          }
        })
        .catch(() => {
          // Silently fail — empty state is fine
        })
        .finally(() => {
          if (!cancelled) setHealthLoading(false);
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
  const showStaleWeight =
    staleMonths != null && staleMonths > 6 && activePet.weight_current_lbs != null;
  const der = computeDER(activePet);
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

  async function handleDelete() {
    if (!activePet) return;
    setDeleting(true);
    try {
      await deletePet(activePet.id);
      removePet(activePet.id);
      deleteConfirm();
      setDeleteModalVisible(false);
      setDeleteInput('');

      // If no pets remain, go to SpeciesSelect
      const remaining = pets.filter((p) => p.id !== activePet.id);
      if (remaining.length === 0) {
        navigation.navigate('SpeciesSelect');
      }
      // Otherwise stay on hub — removePet auto-switches active pet
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setDeleting(false);
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
                ? `${activePet.weight_current_lbs} lbs`
                : 'Not set'}
            </Text>
          </View>
        </View>

        {/* Portion card — daily calorie summary */}
        <View style={styles.portionSection}>
          <PortionCard pet={activePet} product={null} conditions={conditionTags} />
          {der != null && (
            <TreatBatteryGauge
              treatBudgetKcal={calculateTreatBudget(der)}
              consumedKcal={0}
              petName={activePet.name}
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
                name="checkmark-shield-outline"
                size={16}
                color={Colors.severityGreen}
              />
              <Text style={styles.healthyText}>Perfectly Healthy</Text>
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

        {/* (g) Recent scans placeholder */}
        <View style={styles.scansCard}>
          <Ionicons
            name="scan-outline"
            size={32}
            color={Colors.textTertiary}
          />
          <Text style={styles.scansText}>
            No scans yet {'\u2014'} try scanning a product!
          </Text>
        </View>

        {/* (h) Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <SettingsRow icon="notifications-outline" label="Recall Alerts" />
          <SettingsRow icon="shield-checkmark-outline" label="Subscription" />
          <SettingsRow icon="information-circle-outline" label="About Kiba" />
        </View>

        {/* (i) Delete pet */}
        <TouchableOpacity
          onPress={() => {
            setDeleteInput('');
            setDeleteModalVisible(true);
          }}
          style={styles.deleteButton}
          activeOpacity={0.6}
        >
          <Text style={styles.deleteButtonText}>
            Delete {activePet.name}
          </Text>
        </TouchableOpacity>

        {/* Version footer — tap 5 times for dev menu */}
        <TouchableOpacity
          style={styles.versionFooter}
          activeOpacity={0.6}
          onPress={() => {
            if (!__DEV__) return;
            const next = devTapCount + 1;
            if (next >= 5) {
              setDevMenuVisible(true);
              setDevTapCount(0);
            } else {
              setDevTapCount(next);
              setTimeout(() => setDevTapCount(0), 2000);
            }
          }}
        >
          <Text style={styles.versionText}>Kiba v1.0.0</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Dev menu (__DEV__ only) */}
      {__DEV__ && (
        <DevMenu
          visible={devMenuVisible}
          onClose={() => setDevMenuVisible(false)}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Delete {activePet.name}?
            </Text>
            <Text style={styles.modalBody}>
              This will permanently remove {activePet.name}'s profile, health
              conditions, and allergens. This cannot be undone.
            </Text>
            <Text style={styles.modalInstruction}>
              Type{' '}
              <Text style={styles.modalPetName}>{activePet.name}</Text> to
              confirm
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder={activePet.name}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  !canDeletePet(deleteInput, activePet.name) &&
                    styles.modalConfirmDisabled,
                ]}
                onPress={handleDelete}
                disabled={
                  !canDeletePet(deleteInput, activePet.name) || deleting
                }
                activeOpacity={0.7}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Settings Row (preserved from MeScreen) ──────────────

function SettingsRow({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.settingsRow} activeOpacity={0.6}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={Colors.textSecondary}
      />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  addPetButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addPetButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Carousel ───────────────────────────────────────────
  carousel: {
    marginBottom: Spacing.md,
  },
  carouselContent: {
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  carouselItem: {
    alignItems: 'center',
    width: 56,
  },
  carouselAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00B4D815',
  },
  carouselAvatarActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  carouselAvatarInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.5,
  },
  carouselAvatarAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBorder,
  },
  carouselPhoto: {
    borderRadius: 24,
  },
  carouselPhotoActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  carouselPhotoInactive: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  carouselName: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  carouselNameInactive: {
    opacity: 0.5,
  },
  carouselNameAdd: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },

  // ─── Single pet (no carousel) ──────────────────────────
  singlePetRow: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  singlePetName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },

  // ─── Summary Card ──────────────────────────────────────
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryPhotoWrap: {
    marginRight: Spacing.md,
  },
  summaryPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  summaryPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryMeta: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryLifeStage: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // ─── Score Accuracy ────────────────────────────────────
  accuracySection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingTop: Spacing.md,
  },
  accuracyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  accuracyLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  accuracyTrack: {
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: 6,
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  accuracyHint: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // ─── Stale Weight ──────────────────────────────────────
  staleWeightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950015',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  staleWeightText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
  },

  // ─── Quick Stats ───────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },

  // ─── Portion Section ─────────────────────────────────
  portionSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // ─── Health Card ───────────────────────────────────────
  healthCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  healthPrompt: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  healthyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 6,
  },
  healthyText: {
    fontSize: FontSizes.sm,
    color: Colors.severityGreen,
    fontWeight: '600',
  },
  conditionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  conditionChip: {
    backgroundColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  conditionChipText: {
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },
  allergenCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },

  // ─── Recent Scans ─────────────────────────────────────
  scansCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scansText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Settings ──────────────────────────────────────────
  settingsSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },

  // ─── Version Footer ──────────────────────────────────────
  versionFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  versionText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },

  // ─── Delete ────────────────────────────────────────────
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    color: Colors.severityRed,
  },

  // ─── Delete Modal ──────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  modalInstruction: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalPetName: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.severityRed,
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
