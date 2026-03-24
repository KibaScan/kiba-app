// SharePantrySheet — Bottom sheet for sharing a pantry item with other pets.
// Entry point: EditPantryItemScreen. Spec: PANTRY_SPEC.md.
// D-154: Same-species only. D-052: Free users have 1 pet (natural gate).
// No premium badge, no canSharePantryItem() check.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { PantryCardData, PantryPetAssignment } from '../../types/pantry';
import { PantryOfflineError } from '../../types/pantry';
import type { Pet } from '../../types/pet';
import { useActivePetStore } from '../../stores/useActivePetStore';
import {
  sharePantryItem,
  removePantryItem,
  updatePetAssignment,
  resolveScoreForPets,
} from '../../services/pantryService';
import { Colors, FontSizes, Spacing, getScoreColor } from '../../utils/constants';
import { computePetDer, computeAutoServingSize } from '../../utils/pantryHelpers';
import { canUseGoalWeight } from '../../utils/permissions';
import { chipToggle } from '../../utils/haptics';

// ─── Props ──────────────────────────────────────────────

interface SharePantrySheetProps {
  item: PantryCardData;
  activePetId: string;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

// ─── Component ──────────────────────────────────────────

export function SharePantrySheet({
  item,
  activePetId,
  visible,
  onClose,
  onChanged,
}: SharePantrySheetProps) {
  const pets = useActivePetStore(s => s.pets);

  // Local copy of assignments, synced on open
  const [localAssignments, setLocalAssignments] = useState<PantryPetAssignment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // D-156: per-pet resolved scores
  const [petScores, setPetScores] = useState<Map<string, number | null>>(new Map());

  React.useEffect(() => {
    if (visible) setLocalAssignments([...item.assignments]);
  }, [visible, item.assignments]);

  const targetSpecies = item.product.target_species;
  const speciesLabel = targetSpecies === 'dog' ? 'dogs' : 'cats';

  const eligiblePets = useMemo(() =>
    pets.filter(p => p.species === targetSpecies && p.id !== activePetId),
    [pets, targetSpecies, activePetId],
  );

  // D-156: fetch per-pet scores when sheet opens
  React.useEffect(() => {
    if (!visible || eligiblePets.length === 0) return;
    const petIds = eligiblePets.map(p => p.id);
    resolveScoreForPets(petIds, item.product_id, item.product.base_score)
      .then(setPetScores)
      .catch(() => setPetScores(new Map()));
  }, [visible, eligiblePets, item.product_id, item.product.base_score]);

  const getAssignment = useCallback(
    (petId: string) => localAssignments.find(a => a.pet_id === petId) ?? null,
    [localAssignments],
  );

  // ── Toggle pet on/off ──

  const handleToggle = useCallback(async (pet: Pet) => {
    const existing = getAssignment(pet.id);
    setBusy(pet.id);

    try {
      if (existing) {
        await removePantryItem(item.id, pet.id);
        setLocalAssignments(prev => prev.filter(a => a.pet_id !== pet.id));
      } else {
        const source = localAssignments.find(a => a.pet_id === activePetId)
          ?? localAssignments[0];
        const feedingsPerDay = source?.feedings_per_day ?? 2;

        // Calculate DER-based serving for the TARGET pet
        let servingSize = source?.serving_size ?? 1;
        let servingSizeUnit = source?.serving_size_unit ?? 'cups';

        const petDer = computePetDer(pet, canUseGoalWeight());
        if (petDer != null) {
          const auto = computeAutoServingSize(petDer, feedingsPerDay, item.product);
          if (auto) {
            servingSize = Math.round(auto.amount * 100) / 100;
            servingSizeUnit = auto.unit;
          }
        }

        const newAssign = await sharePantryItem(item.id, pet.id, {
          serving_size: servingSize,
          serving_size_unit: servingSizeUnit,
          feedings_per_day: feedingsPerDay,
          feeding_frequency: source?.feeding_frequency ?? 'daily',
        });
        setLocalAssignments(prev => [...prev, newAssign]);
      }
      chipToggle();
      onChanged();
    } catch (e) {
      const msg = e instanceof PantryOfflineError
        ? e.message
        : existing ? 'Failed to remove sharing.' : 'Failed to share item.';
      Alert.alert('Error', msg);
    } finally {
      setBusy(null);
    }
  }, [item.id, activePetId, localAssignments, getAssignment, onChanged]);

  // ── Inline serving size save (onBlur) ──

  const handleServingSizeBlur = useCallback(async (petId: string, text: string) => {
    const val = parseFloat(text);
    if (isNaN(val) || val <= 0) return;
    const assign = getAssignment(petId);
    if (!assign || assign.serving_size === val) return;

    try {
      await updatePetAssignment(assign.id, { serving_size: val });
    } catch {
      Alert.alert('Error', 'Failed to update serving size.');
    }
  }, [getAssignment]);

  // ── Inline feedings per day ──

  const handleFeedingsChange = useCallback(async (petId: string, delta: number) => {
    const assign = getAssignment(petId);
    if (!assign) return;
    const next = Math.max(1, Math.min(5, assign.feedings_per_day + delta));
    if (next === assign.feedings_per_day) return;

    chipToggle();

    // Recalculate serving size from pet's DER with new feedings count
    const pet = pets.find(p => p.id === petId);
    let newServing = assign.serving_size;
    let newUnit = assign.serving_size_unit;
    if (pet) {
      const petDer = computePetDer(pet, canUseGoalWeight());
      if (petDer != null) {
        const auto = computeAutoServingSize(petDer, next, item.product);
        if (auto) {
          newServing = Math.round(auto.amount * 100) / 100;
          newUnit = auto.unit;
        }
      }
    }

    setLocalAssignments(prev =>
      prev.map(a => a.pet_id === petId
        ? { ...a, feedings_per_day: next, serving_size: newServing, serving_size_unit: newUnit }
        : a),
    );

    try {
      await updatePetAssignment(assign.id, {
        feedings_per_day: next,
        serving_size: newServing,
        serving_size_unit: newUnit,
      });
    } catch {
      Alert.alert('Error', 'Failed to update feedings.');
    }
  }, [getAssignment, pets, item.product]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Share with Other Pets</Text>
                <TouchableOpacity onPress={onClose} hitSlop={12}>
                  <Ionicons name="close-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {eligiblePets.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="paw-outline" size={40} color={Colors.textTertiary} />
                  <Text style={styles.emptyText}>
                    No other {speciesLabel} to share with. Sharing requires 2 or more
                    pets of the same species — dog and cat nutritional needs are
                    fundamentally different.
                  </Text>
                </View>
              ) : (
                eligiblePets.map(pet => {
                  const assign = getAssignment(pet.id);
                  const assigned = assign !== null;
                  const isBusy = busy === pet.id;

                  return (
                    <View key={pet.id} style={styles.petRow}>
                      <TouchableOpacity
                        style={styles.petToggleRow}
                        onPress={() => handleToggle(pet)}
                        activeOpacity={0.7}
                        disabled={isBusy}
                      >
                        <View style={styles.petInfo}>
                          <View style={styles.petAvatar}>
                            {pet.photo_url ? (
                              <Image source={{ uri: pet.photo_url }} style={styles.petPhoto} />
                            ) : (
                              <Ionicons name="paw-outline" size={18} color={Colors.accent} />
                            )}
                          </View>
                          <View style={styles.petNameCol}>
                            <Text style={styles.petName}>{pet.name}</Text>
                            {(() => {
                              const petScore = petScores.get(pet.id) ?? item.product.base_score;
                              return petScore != null ? (
                                <Text style={[styles.petScore, { color: getScoreColor(petScore, item.product.is_supplemental) }]}>
                                  {petScore}% match
                                </Text>
                              ) : (
                                <Text style={styles.petScoreMuted}>Not scored</Text>
                              );
                            })()}
                          </View>
                        </View>
                        {isBusy ? (
                          <ActivityIndicator size="small" color={Colors.accent} />
                        ) : (
                          <View style={styles.toggleRow}>
                            <Text style={assigned ? styles.toggleLabelActive : styles.toggleLabelInactive}>
                              {assigned ? 'Sharing' : 'Share'}
                            </Text>
                            <View style={[styles.checkbox, assigned && styles.checkboxChecked]}>
                              {assigned && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Inline serving editor for assigned pets */}
                      {assigned && assign && (
                        <View style={styles.servingEditor}>
                          <View style={styles.servingRow}>
                            <Text style={styles.servingLabel}>Serving</Text>
                            <View style={styles.servingInputRow}>
                              <TextInput
                                style={styles.servingInput}
                                keyboardType="numeric"
                                defaultValue={String(Math.round(assign.serving_size * 100) / 100)}
                                onEndEditing={(e) => handleServingSizeBlur(pet.id, e.nativeEvent.text)}
                              />
                              <Text style={styles.servingUnit}>{assign.serving_size_unit}</Text>
                            </View>
                          </View>
                          <View style={styles.servingRow}>
                            <Text style={styles.servingLabel}>Feedings/day</Text>
                            <View style={styles.stepperRow}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => handleFeedingsChange(pet.id, -1)}
                                disabled={assign.feedings_per_day <= 1}
                              >
                                <Ionicons name="remove" size={16} color={assign.feedings_per_day <= 1 ? Colors.textTertiary : Colors.textPrimary} />
                              </TouchableOpacity>
                              <Text style={styles.stepperValue}>{assign.feedings_per_day}</Text>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => handleFeedingsChange(pet.id, 1)}
                                disabled={assign.feedings_per_day >= 5}
                              >
                                <Ionicons name="add" size={16} color={assign.feedings_per_day >= 5 ? Colors.textTertiary : Colors.textPrimary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              <View style={styles.bottomSpacer} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // Pet rows
  petRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.cardBorder,
  },
  petToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  petAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  petPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  petNameCol: {
    flex: 1,
    gap: 2,
  },
  petName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  petScore: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  petScoreMuted: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabelActive: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  toggleLabelInactive: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },

  // Inline serving editor
  servingEditor: {
    paddingBottom: 12,
    paddingLeft: 52,
    gap: 8,
  },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servingLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  servingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  servingInput: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    minWidth: 56,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  servingUnit: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepperValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 18,
    textAlign: 'center',
  },

  bottomSpacer: { height: 34 },
});
