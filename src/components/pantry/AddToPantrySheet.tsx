// AddToPantrySheet — Bottom sheet for adding a product to a pet's pantry.
// Phase C Redesign: Meal-based UX, Safe Switch handoff, auto-serving calculation.
// Phase D Redesign: Behavioral Feeding, dynamic remaining budget.
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Product } from '../../types';
import { Category } from '../../types';
import type { Pet, FeedingStyle } from '../../types/pet';
import type {
  PantryItem,
  AddToPantryInput,
  QuantityUnit,
  ServingMode,
  ServingSizeUnit,
  FeedingFrequency,
  FeedingRole,
} from '../../types/pantry';
import { updatePet } from '../../services/petService';
import {
  defaultServingMode,
  parseProductSize,
  computePetDer,
  computeBehavioralServing,
  estimateBagCups,
} from '../../utils/pantryHelpers';
import { usePantryStore } from '../../stores/usePantryStore';
import { canUseGoalWeight } from '../../utils/permissions';
import { chipToggle, saveSuccess } from '../../utils/haptics';
import { stripBrandFromName } from '../../utils/formatters';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { getWetTransitionSchedule, getWetTransitionTotalDays } from '../../utils/wetTransitionHelpers';
import { saveWetTransition } from '../../services/wetTransitionStorage';
import { hasActiveSwitchForPet } from '../../services/safeSwitchService';
import { styles } from './AddToPantryStyles';
import { FeedingStyleSetupSheet } from './FeedingStyleSetupSheet';

// ─── Exported Pure Helpers ──────────────────────────────

export function isTreat(category: Category): boolean {
  return category === Category.Treat || category === Category.Supplement;
}

export function getDefaultFeedingsPerDay(category: Category): number {
  return isTreat(category) ? 1 : 1; // Unused for behavioral feeding daily_food
}

export function getDefaultFeedingFrequency(category: Category): FeedingFrequency {
  return isTreat(category) ? 'as_needed' : 'daily';
}

export function isFormValid(quantityValue: string, servingSize: number): boolean {
  const qty = parseFloat(quantityValue);
  return !isNaN(qty) && qty > 0 && servingSize > 0;
}

const WEIGHT_UNITS: QuantityUnit[] = ['lbs', 'oz', 'kg', 'g'];

export function buildAddToPantryInput(params: {
  productId: string;
  quantityValue: string;
  quantityUnit: QuantityUnit;
  servingMode: ServingMode;
  servingSize: number;
  servingSizeUnit: ServingSizeUnit;
  feedingsPerDay: number;
  feedingFrequency: FeedingFrequency;
  feedingRole?: FeedingRole;
  autoDeplete?: boolean;
}): AddToPantryInput {
  return {
    product_id: params.productId,
    quantity_original: parseFloat(params.quantityValue) || 0,
    quantity_unit: params.quantityUnit,
    serving_mode: params.servingMode,
    ...(params.servingMode === 'unit' ? { unit_label: 'servings' as const } : {}),
    serving_size: params.servingSize,
    serving_size_unit: params.servingSizeUnit,
    feedings_per_day: params.feedingsPerDay,
    feeding_frequency: params.feedingFrequency,
    feeding_role: params.feedingRole,
    ...(params.autoDeplete !== undefined ? { auto_deplete_enabled: params.autoDeplete } : {}),
  };
}

export interface InferredAssignmentDefaults {
  isSimpleAdd: boolean;           // treat/topper/supplement — simple add form layout
  inferredRole: FeedingRole;
  inferredFreq: FeedingFrequency;
  inferredAutoDeplete: boolean;
}

/**
 * Classifies a product + pet feeding style into assignment defaults.
 * Replaces the previous conflated `treat = isTreat || is_supplemental`
 * flag that broke topper and dry_only + wet routing.
 *
 * See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md §4b.
 */
export function inferAssignmentDefaults(
  pet: Pick<Pet, 'feeding_style'>,
  product: Pick<Product, 'category' | 'is_supplemental' | 'product_form'>,
): InferredAssignmentDefaults {
  const isTreat = product.category === Category.Treat;
  const isTopper = product.is_supplemental === true && !isTreat;
  const isSupplement = product.category === Category.Supplement;
  const isSimpleAdd = isTreat || isTopper || isSupplement;

  let inferredRole: FeedingRole;
  if (isTreat || isSupplement) {
    inferredRole = null;
  } else if (isTopper) {
    inferredRole = 'rotational';
  } else if (pet.feeding_style === 'wet_only') {
    inferredRole = 'base';
  } else if (pet.feeding_style === 'dry_and_wet' && product.product_form !== 'dry') {
    inferredRole = 'rotational';
  } else {
    inferredRole = 'base';
  }

  const inferredFreq: FeedingFrequency = inferredRole === 'base' ? 'daily' : 'as_needed';
  const inferredAutoDeplete = inferredFreq === 'daily';

  return { isSimpleAdd, inferredRole, inferredFreq, inferredAutoDeplete };
}

// ─── Props ──────────────────────────────────────────────

interface AddToPantrySheetProps {
  product: Product;
  pet: Pet;
  visible: boolean;
  onClose: () => void;
  onAdded: (item?: PantryItem) => void;
  conditions?: string[];
}

export function AddToPantrySheet({
  product,
  pet,
  visible,
  onClose,
  onAdded,
  conditions,
}: AddToPantrySheetProps) {
  // Routing classification — splits treat/topper/supplement/main-food
  // so toppers can route as rotational + as_needed + auto_deplete=false.
  // Legacy `treat` alias preserved so downstream form-layout JSX is unchanged.
  const {
    isSimpleAdd: treat,
    inferredRole,
    inferredFreq: feedingFrequency,
    inferredAutoDeplete,
  } = useMemo(
    () => inferAssignmentDefaults(pet, product),
    [pet.feeding_style, product.category, product.is_supplemental, product.product_form],
  );

  // Store data
  const pantryItems = usePantryStore(s => s.items);
  const pantryPetId = usePantryStore(s => s._petId);
  const addItemWithRebalance = usePantryStore(s => s.addItem);

  const dailyFoodItems = useMemo(() => {
    if (pantryPetId !== pet.id) return [];
    return pantryItems.filter(i => i.product.category === 'daily_food' && !i.is_empty && !i.product.is_supplemental);
  }, [pantryItems, pantryPetId, pet.id]);

  const numDailyFoods = dailyFoodItems.length;

  // Local State
  const [showStyleSetup, setShowStyleSetup] = useState(false);
  const [hasSeenStyleSetup, setHasSeenStyleSetup] = useState(false);
  const [isNewToDiet, setIsNewToDiet] = useState<boolean | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  
  // Manual overrides
  const [manualServingSize, setManualServingSize] = useState(1);
  const [manualServingUnit, setManualServingUnit] = useState<ServingSizeUnit>('cups');

  // Old Bag info (always required if modifying pantry directly, NOT SafeSwitch)
  const [servingMode, setServingMode] = useState<ServingMode>('weight');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('lbs');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Behavioral Feeding Base Setup + Mismatch Detection
  useEffect(() => {
    if (!visible || treat) return;

    // Cold start: first daily food, prompt for feeding style
    if (numDailyFoods === 0 && !hasSeenStyleSetup && pet.feeding_style === 'dry_only') {
      setShowStyleSetup(true);
      return;
    }

    // Mismatch: adding non-dry to dry_only, or dry to wet_only
    // EC-3: Supplements (salmon oil, liquid probiotics) should never trigger mismatch
    const isMismatch =
      !product.is_supplemental &&
      ((pet.feeding_style === 'dry_only' && product.product_form !== 'dry') ||
      (pet.feeding_style === 'wet_only' && product.product_form === 'dry'));

    if (isMismatch && !hasSeenStyleSetup) {
      setShowStyleSetup(true);
    }
  }, [visible, treat, numDailyFoods, hasSeenStyleSetup, pet.feeding_style, product.product_form]);

  // Reset & Init
  useEffect(() => {
    if (!visible) return;
    setIsNewToDiet(null);
    setAutoMode(true);
    setSubmitting(false);
    setError(null);

    const mode = treat ? 'unit' : defaultServingMode(product.product_form);
    setServingMode(mode);
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setManualServingUnit(mode === 'weight' ? 'cups' : 'units');

    const parsed = parseProductSize(product.name);
    if (parsed) {
      setQuantityValue(String(parsed.quantity));
      if (parsed.unit !== 'units' && mode === 'weight') setQuantityUnit(parsed.unit);
    } else {
      setQuantityValue('');
    }

    if (pantryPetId !== pet.id) {
      usePantryStore.getState().loadPantry(pet.id);
    }
  }, [visible, product, pet, treat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Discrete units (cans, pouches, trays) can't be mixed — no Safe Switch math.
  // Bulk/mixable forms (dry, fresh, raw, freeze-dried) support gradual mixing.
  const DISCRETE_FORMS = ['wet'];
  const isMixable = !DISCRETE_FORMS.includes(product.product_form ?? '');

  // Auto Computation (Behavioral Math) — always compute target serving, even during transition
  const autoServingResult = useMemo(() => {
    if (treat || !autoMode || !inferredRole) return null;
    return computeBehavioralServing({
      pet,
      product,
      feedingRole: inferredRole,
      dailyWetFedKcal: 0, // Fresh addition, no actuals
      dryFoodSplitPct: 100, // Safe default
      isPremiumGoalWeight: canUseGoalWeight(),
    });
  }, [treat, autoMode, inferredRole, pet, product]);

  const canAutoCalc = useMemo(() => {
    return computeBehavioralServing({
      pet,
      product,
      feedingRole: 'base', // Try with base just to see if kcal exists
      dailyWetFedKcal: 0,
      dryFoodSplitPct: 100,
      isPremiumGoalWeight: false,
    }) != null;
  }, [pet, product]);

  const estimatedCups = useMemo(() => {
    const qty = parseFloat(quantityValue);
    if (isNaN(qty) || qty <= 0) return null;
    return estimateBagCups(product, qty, quantityUnit);
  }, [product, quantityValue, quantityUnit]);

  const effectiveServingSize = autoMode && autoServingResult ? autoServingResult.amount : manualServingSize;
  const effectiveServingUnit = autoMode && autoServingResult ? autoServingResult.unit : manualServingUnit;

  // Wet transition schedule (discrete food only)
  const wetUnitsPerDay = useMemo(() => {
    if (!autoServingResult || effectiveServingUnit !== 'units') return 2;
    return Math.max(1, Math.round(autoServingResult.amount));
  }, [autoServingResult, effectiveServingUnit]);

  const wetSchedule = useMemo(() => {
    if (isMixable || inferredRole !== 'base') return null;
    return getWetTransitionSchedule(wetUnitsPerDay, pet.species as 'dog' | 'cat');
  }, [isMixable, inferredRole, wetUnitsPerDay, pet.species]);

  const wetTotalDays = wetSchedule ? getWetTransitionTotalDays(wetSchedule) : 0;

  // Validation
  const bagValid = quantityValue.trim() !== '' && parseFloat(quantityValue) > 0;
  const questionShown = inferredRole === 'base' && !isMixable;
  const ctaReady = bagValid && (!questionShown || isNewToDiet !== null);

  // Handlers
  const handlePillSwitch = (val: boolean) => {
    chipToggle();
    setIsNewToDiet(val);
  };

  const handleCTA = async () => {
    setSubmitting(true);
    setError(null);

    // Treat / Topper / Supplement Path (simple add form layout)
    if (treat) {
      try {
        const input = buildAddToPantryInput({
          productId: product.id,
          quantityValue,
          quantityUnit: servingMode === 'unit' ? 'units' : quantityUnit,
          servingMode,
          servingSize: manualServingSize,
          servingSizeUnit: manualServingUnit,
          feedingsPerDay: 1,
          feedingFrequency,
          feedingRole: inferredRole,
          autoDeplete: inferredAutoDeplete,
        });
        await addItemWithRebalance(input, pet.id);
        saveSuccess();
        onAdded();
        onClose();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Daily Food Path (Behavioral)
    try {
      const input = buildAddToPantryInput({
        productId: product.id,
        quantityValue,
        quantityUnit: servingMode === 'unit' ? 'units' : quantityUnit,
        servingMode,
        servingSize: effectiveServingSize || 1,
        servingSizeUnit: effectiveServingUnit || 'cups',
        feedingsPerDay: 1,
        feedingFrequency,
        feedingRole: inferredRole,
        autoDeplete: inferredAutoDeplete,
      });

      await addItemWithRebalance(input, pet.id);

      // Save wet transition guide for discrete base food switches
      // Skip if a Safe Switch is already active — don't create conflicting guides
      if (isNewToDiet === true && inferredRole === 'base' && !isMixable && wetSchedule) {
        const hasActiveSafeSwitch = await hasActiveSwitchForPet(pet.id).catch(() => false);
        if (!hasActiveSafeSwitch) {
          saveWetTransition({
            petId: pet.id,
            productId: product.id,
            productName: stripBrandFromName(product.name, product.brand),
            startedAt: new Date().toISOString(),
            totalDays: wetTotalDays,
            unitsPerDay: wetUnitsPerDay,
            schedule: wetSchedule,
            dismissed: false,
          }).catch(() => {}); // Fire-and-forget — guide is non-critical
        }
      }

      saveSuccess();
      onAdded();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Helpers
  const renderChip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity key={label} style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  // Show Loading if Style Setup Intercepts
  if (showStyleSetup) {
    return (
      <FeedingStyleSetupSheet
        isVisible={true}
        petName={pet.name}
        onSelect={async (style) => {
          try {
            await updatePet(pet.id, { feeding_style: style });
          } catch (e) {
            // fail silently, proceed
          }
          setHasSeenStyleSetup(true);
          setShowStyleSetup(false);
        }}
        onDismiss={() => {
          setHasSeenStyleSetup(true);
          setShowStyleSetup(false);
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  {product.image_url ? (
                    <Image source={{ uri: product.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <Ionicons name="cube-outline" size={24} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.headerText}>
                    <Text style={styles.brandText} numberOfLines={1}>{product.brand}</Text>
                    <Text style={styles.nameText} numberOfLines={2}>{stripBrandFromName(product.brand, product.name)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* TREAT PATH */}
              {treat ? (
                <View style={styles.section}>
                  <Text style={styles.label}>{servingMode === 'weight' ? 'Bag size' : 'Total servings'}</Text>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.numberInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} value={quantityValue} onChangeText={setQuantityValue} />
                    {servingMode === 'weight' ? (
                      <View style={styles.chipRow}>
                        {WEIGHT_UNITS.map((u) => renderChip(u, quantityUnit === u, () => { chipToggle(); setQuantityUnit(u); }))}
                      </View>
                    ) : (
                      <Text style={styles.unitSuffix}>servings</Text>
                    )}
                  </View>
                </View>
              ) : (
                /* DAILY FOOD PATH */
                <>
                  {/* Diet switch question — discrete base food only (mixable foods skip question, V2-1) */}
                  {inferredRole === 'base' && !isMixable && (
                    <>
                      <Text style={styles.label}>Switching {pet.name}'s diet?</Text>
                      <View style={styles.pillToggleRow}>
                        <TouchableOpacity style={[styles.pillButton, isNewToDiet === true && styles.pillButtonActive]} onPress={() => handlePillSwitch(true)} activeOpacity={0.7}>
                          <Text style={[styles.pillText, isNewToDiet === true && styles.pillTextActive]}>Yes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.pillButton, isNewToDiet === false && styles.pillButtonActive]} onPress={() => handlePillSwitch(false)} activeOpacity={0.7}>
                          <Text style={[styles.pillText, isNewToDiet === false && styles.pillTextActive]}>No</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Discrete base food (cans, pouches): transition guide preview */}
                  {isNewToDiet === true && inferredRole === 'base' && !isMixable && (
                    <View style={styles.advisoryCard}>
                      <Text style={styles.advisoryTitle}>Meal Transition Guide</Text>
                      <Text style={styles.advisoryText}>
                        {wetTotalDays > 0
                          ? `We'll create a ${wetTotalDays}-day portion swap schedule to help ${pet.name} adjust gradually. The guide will appear in your pantry.`
                          : `Introduce new foods gradually over a few days. Start with small portions alongside the current food.`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.label}>{servingMode === 'weight' ? 'Bag Size' : 'Quantity'}</Text>
                    <View style={styles.inputRow}>
                      <TextInput style={styles.numberInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} value={quantityValue} onChangeText={setQuantityValue} />
                      <View style={styles.chipRow}>
                        {servingMode === 'weight'
                          ? WEIGHT_UNITS.map((u) => renderChip(u, quantityUnit === u, () => { chipToggle(); setQuantityUnit(u); }))
                          : <Text style={styles.unitSuffix}>{quantityUnit}</Text>
                        }
                      </View>
                    </View>
                    {servingMode === 'weight' && estimatedCups != null && (
                      <Text style={styles.cupEstimate}>
                        ~{Math.round(estimatedCups)} cups
                      </Text>
                    )}
                  </View>

                  <View style={{ marginTop: Spacing.md }} />

                  {/* Role Summary Badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardSurface, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.lg }}>
                    <Ionicons name={inferredRole === 'rotational' ? "sync" : "nutrition"} size={20} color={inferredRole === 'rotational' ? Colors.accent : Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 }}>
                        {inferredRole === 'rotational' ? 'Rotational Food' : 'Base Food'}
                      </Text>
                      <Text style={{ fontSize: FontSizes.xs, color: Colors.textSecondary }}>
                        {inferredRole === 'rotational' ? 'Logged manually as fed via "Fed This Today".' : 'Daily caloric anchor.'}
                      </Text>
                    </View>
                  </View>

                  {/* Auto Math Block */}
                  {inferredRole !== null && canAutoCalc && (
                    <View style={styles.autoStatusRow}>
                      <View style={autoMode ? styles.autoBadge : styles.manualBadge}>
                        <Text style={autoMode ? styles.autoBadgeText : styles.manualBadgeText}>{autoMode ? 'Auto' : 'Manual'}</Text>
                      </View>
                      {autoMode && autoServingResult ? (
                        <View style={{flex:1}}>
                          <Text style={styles.autoResultValue}>{Math.round(autoServingResult.amount * 100) / 100} <Text style={styles.autoResultUnit}>{autoServingResult.unit} / day</Text></Text>
                          {pet.feeding_style === 'dry_and_wet' && inferredRole === 'base' && !isNewToDiet && (
                             <Text style={styles.autoMathLine}><Text style={styles.dimmedText}>Budget excludes wet food allowance ({pet.wet_reserve_kcal || 0} kcal)</Text></Text>
                          )}
                          {pet.feeding_style === 'dry_and_wet' && inferredRole === 'rotational' && (
                             <Text style={styles.autoMathLine}><Text style={styles.dimmedText}>Wet food portion of daily budget</Text></Text>
                          )}
                          <Text style={styles.autoMathLine}><Text style={styles.dimmedText}>{Math.round(autoServingResult.basisKcal)} kcal daily allowance</Text></Text>
                        </View>
                      ) : (
                        <View style={styles.inputRow}>
                          <TextInput style={styles.numberInput} keyboardType="decimal-pad" value={String(manualServingSize)} onChangeText={(t) => setManualServingSize(parseFloat(t) || 0)} />
                          <Text style={styles.unitSuffix}>{manualServingUnit}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {!autoMode && inferredRole !== null && canAutoCalc && (
                    <TouchableOpacity onPress={() => { chipToggle(); setAutoMode(true); }} style={styles.resetToAutoLink}>
                      <Text style={styles.resetToAutoText}>Reset to Auto Math</Text>
                    </TouchableOpacity>
                  )}

                </>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!ctaReady || submitting) && styles.confirmButtonDisabled
                ]}
                onPress={handleCTA}
                disabled={!ctaReady || submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? 'Please wait...' : `Add to ${pet.name}'s Pantry`}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
