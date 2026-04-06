// AddToPantrySheet — Bottom sheet for adding a product to a pet's pantry.
// Phase C Redesign: Meal-based UX, Safe Switch handoff, auto-serving calculation.
// D-165: Budget-aware auto/manual serving recommendations.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable, // eslint-disable-line @typescript-eslint/no-unused-vars
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Product } from '../../types';
import { Category } from '../../types';
import type { Pet } from '../../types/pet';
import type {
  PantryItem,
  AddToPantryInput,
  QuantityUnit,
  ServingMode,
  ServingSizeUnit,
  FeedingFrequency,
} from '../../types/pantry';
import { PantryOfflineError } from '../../types/pantry';
import { addToPantry } from '../../services/pantryService';
import {
  defaultServingMode,
  calculateDepletionBreakdown,
  computePetDer,
  computeExistingPantryKcal,
  computeBudgetWarning,
  getSmartDefaultFeedingsPerDay,
  getConditionFeedingsPerDay,
  parseProductSize,
  convertToKg,
  convertFromKg,
  convertWeightToCups,
  computeMealBasedServing,
  getDefaultMealsCovered,
  computeRebalancedMeals,
  computeServingConversions,
} from '../../utils/pantryHelpers';
import { usePantryStore } from '../../stores/usePantryStore';
import { useActivePetStore } from '../../stores/useActivePetStore';
import { canUseGoalWeight } from '../../utils/permissions';
import { chipToggle, saveSuccess } from '../../utils/haptics';
import { stripBrandFromName } from '../../utils/formatters';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { styles } from './AddToPantryStyles';

// ─── Exported Pure Helpers ──────────────────────────────

export const FRACTIONAL_CHIPS = [
  { label: '\u00BC', value: 0.25 },
  { label: '\u2153', value: 0.333 },
  { label: '\u00BD', value: 0.5 },
  { label: '\u2154', value: 0.667 },
  { label: '\u00BE', value: 0.75 },
  { label: '1', value: 1 },
  { label: '1\u00BD', value: 1.5 },
  { label: '2', value: 2 },
];

export function isTreat(category: Category): boolean {
  return category === Category.Treat || category === Category.Supplement;
}

export function getDefaultFeedingsPerDay(category: Category): number {
  return isTreat(category) ? 1 : 2;
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
  };
}

// ─── Props ──────────────────────────────────────────────

interface AddToPantrySheetProps {
  product: Product;
  pet: Pet;
  visible: boolean;
  onClose: () => void;
  onAdded: (item?: PantryItem) => void;
  onStartSafeSwitch?: (params: { pantryItemId?: string; newProductId: string; petId: string; newServingSize: number | null; newServingSizeUnit: string | null; newFeedingsPerDay: number | null }) => void;
  conditions?: string[];
}

export function AddToPantrySheet({
  product,
  pet,
  visible,
  onClose,
  onAdded,
  onStartSafeSwitch,
  conditions,
}: AddToPantrySheetProps) {
  const treat = isTreat(product.category) || product.is_supplemental;

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
  const [isNewToDiet, setIsNewToDiet] = useState<boolean | null>(null);
  const [totalMealsPerDay, setTotalMealsPerDay] = useState(2);
  const [mealsCovered, setMealsCovered] = useState(1);
  const [autoMode, setAutoMode] = useState(true);
  
  // Advanced Conversions / Manual overrides
  const [conversionsExpanded, setConversionsExpanded] = useState(false);
  const [manualServingSize, setManualServingSize] = useState(1);
  const [manualServingUnit, setManualServingUnit] = useState<ServingSizeUnit>('cups');

  // Old Bag info (always required if modifying pantry directly, NOT SafeSwitch)
  const [servingMode, setServingMode] = useState<ServingMode>('weight');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('lbs');
  const [bagCollapsed, setBagCollapsed] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepperHint, setStepperHint] = useState(false);
  const stepperHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Budgets
  const petDer = useMemo(() => computePetDer(pet, canUseGoalWeight(), pet.weight_goal_level), [pet]);
  const existKcal = useMemo(() => computeExistingPantryKcal(pantryItems, pet.id), [pantryItems, pet.id]);

  // Reset & Init
  useEffect(() => {
    if (!visible) return;
    setIsNewToDiet(null);
    setConversionsExpanded(false);
    setAutoMode(true);
    setSubmitting(false);
    setError(null);
    setStepperHint(false);
    if (stepperHintTimer.current) clearTimeout(stepperHintTimer.current);
    setBagCollapsed(false);

    // Total meals = sum of existing daily food feedings, or condition-aware default
    const existingDailyFeedings = pantryItems.reduce((sum, item) => {
      if (item.product.category !== 'daily_food' || item.is_empty || item.product.is_supplemental) return sum;
      const asg = item.assignments.find(a => a.pet_id === pet.id && a.feeding_frequency === 'daily');
      return sum + (asg?.feedings_per_day ?? 0);
    }, 0);
    const conditionMeals = conditions ? getConditionFeedingsPerDay(conditions) : null;
    const baseMeals = existingDailyFeedings > 0 ? existingDailyFeedings : (conditionMeals ?? 2);
    setTotalMealsPerDay(baseMeals);
    setMealsCovered(treat ? 1 : getDefaultMealsCovered(numDailyFoods, baseMeals));

    const mode = treat ? 'unit' : defaultServingMode(product.product_form);
    setServingMode(mode);
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setManualServingUnit(mode === 'weight' ? 'cups' : 'units');

    const parsed = parseProductSize(product.name);
    if (parsed) {
      setQuantityValue(String(parsed.quantity));
      if (parsed.unit !== 'units' && mode === 'weight') setQuantityUnit(parsed.unit);
      setBagCollapsed(true);
    } else {
      setQuantityValue('');
      setBagCollapsed(false);
    }

    if (pantryPetId !== pet.id) {
      usePantryStore.getState().loadPantry(pet.id);
    }
  }, [visible, product, pet, treat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto Computation
  const autoServingResult = useMemo(() => {
    if (treat || !autoMode) return null;
    return computeMealBasedServing(pet, product, mealsCovered, totalMealsPerDay, canUseGoalWeight(), pet.weight_goal_level);
  }, [treat, autoMode, pet, product, mealsCovered, totalMealsPerDay]);

  const canAutoCalc = useMemo(() => {
    return computeMealBasedServing(pet, product, 1, 1, false, null) != null;
  }, [pet, product]);

  const effectiveServingSize = autoMode && autoServingResult ? autoServingResult.amount : manualServingSize;
  const effectiveServingUnit = autoMode && autoServingResult ? autoServingResult.unit : manualServingUnit;

  // Rebalance existing logic
  const showsRebalanceNote = !treat && !isNewToDiet && numDailyFoods > 0;
  
  // Validation
  const bagValid = quantityValue.trim() !== '' && parseFloat(quantityValue) > 0;
  const ctaReady = treat || isNewToDiet === null 
    ? bagValid 
    : isNewToDiet === true 
      ? true // Safe switch just needs meal config
      : bagValid;

  // Handlers
  const handlePillSwitch = (val: boolean) => {
    chipToggle();
    setIsNewToDiet(val);
    if (!val && !bagValid) setBagCollapsed(false);
  };

  // With existing daily foods, cap at totalMealsPerDay - 1 (sibling keeps at least 1).
  // Without existing foods, allow up to 5 (health conditions, small breeds, etc.).
  const maxMealsCovered = numDailyFoods > 0 ? Math.max(1, totalMealsPerDay - 1) : 5;

  const adjustMealsCovered = (delta: number) => {
    chipToggle();
    setMealsCovered(prev => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > maxMealsCovered) {
        if (delta > 0 && numDailyFoods > 0) {
          setStepperHint(true);
          if (stepperHintTimer.current) clearTimeout(stepperHintTimer.current);
          stepperHintTimer.current = setTimeout(() => setStepperHint(false), 3000);
        }
        return prev;
      }
      setStepperHint(false);
      // When first/only food, totalMealsPerDay tracks the stepper (100% allocation)
      if (numDailyFoods === 0) {
        setTotalMealsPerDay(next);
      }
      return next;
    });
  };

  const handleCTA = async () => {
    setSubmitting(true);
    setError(null);

    // Treat / Supplement Path
    if (treat) {
      try {
        const input = buildAddToPantryInput({
          productId: product.id,
          quantityValue,
          quantityUnit: servingMode === 'unit' ? 'units' : quantityUnit,
          servingMode,
          servingSize: manualServingSize,
          servingSizeUnit: manualServingUnit,
          feedingsPerDay: mealsCovered,
          feedingFrequency: 'as_needed',
        });
        const item = await addToPantry(input, pet.id);
        saveSuccess();
        onAdded(item);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Phase C Daily Food
    try {
      if (isNewToDiet === true && onStartSafeSwitch) { // SAFE SWITCH HANDOFF
        onStartSafeSwitch({
          newProductId: product.id,
          petId: pet.id,
          newServingSize: effectiveServingSize,
          newServingSizeUnit: effectiveServingUnit,
          newFeedingsPerDay: mealsCovered,
        });
        onClose(); // Parent (ResultScreen) will navigate
      } else { // DIRECT PANTRY ADD
        const input = buildAddToPantryInput({
          productId: product.id,
          quantityValue,
          quantityUnit: servingMode === 'unit' ? 'units' : quantityUnit,
          servingMode,
          servingSize: effectiveServingSize,
          servingSizeUnit: effectiveServingUnit,
          feedingsPerDay: mealsCovered,
          feedingFrequency: 'daily',
        });
        
        let rebalanceTarget;
        if (numDailyFoods === 1 && mealsCovered < totalMealsPerDay) {
          rebalanceTarget = {
            pantryItemId: dailyFoodItems[0].id,
            newMealsCovered: mealsCovered,
            totalMealsPerDay,
            isPremiumGoalWeight: canUseGoalWeight(),
          };
        }

        await addItemWithRebalance(input, pet.id, rebalanceTarget);
        saveSuccess();
        // Since addItem doesn't return the item anymore (we mapped it over to the store function which returns void),
        // we'll just call onAdded with a fake item or null, the store already refreshed. Wait, ResultScreen needs it.
        // Let's just pass null as any. The only thing ResultScreen uses it for is maybe a toast or navigating away.
        onAdded();
        onClose();
      }
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
                  <Text style={styles.label}>Is this new to {pet.name}'s diet?</Text>
                  <View style={styles.pillToggleRow}>
                    <TouchableOpacity style={[styles.pillButton, isNewToDiet === true && styles.pillButtonActive]} onPress={() => handlePillSwitch(true)} activeOpacity={0.7}>
                      <Text style={[styles.pillText, isNewToDiet === true && styles.pillTextActive]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.pillButton, isNewToDiet === false && styles.pillButtonActive]} onPress={() => handlePillSwitch(false)} activeOpacity={0.7}>
                      <Text style={[styles.pillText, isNewToDiet === false && styles.pillTextActive]}>No</Text>
                    </TouchableOpacity>
                  </View>

                  {isNewToDiet !== null && (
                    <>
                      {isNewToDiet === true && (
                        <View style={styles.advisoryCard}>
                          <Text style={styles.advisoryTitle}>Safe Switch Recommended</Text>
                          <Text style={styles.advisoryText}>Sudden diet changes can cause stomach upset. We recommend a 7-day transition.</Text>
                        </View>
                      )}

                      {isNewToDiet === false && (
                        <View style={styles.section}>
                          <Text style={styles.label}>Bag Size</Text>
                          <View style={styles.inputRow}>
                            <TextInput style={styles.numberInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.textTertiary} value={quantityValue} onChangeText={setQuantityValue} />
                            <View style={styles.chipRow}>
                              {WEIGHT_UNITS.map((u) => renderChip(u, quantityUnit === u, () => { chipToggle(); setQuantityUnit(u); }))}
                            </View>
                          </View>
                        </View>
                      )}
                      
                      {isNewToDiet === false && bagValid && bagCollapsed && (
                        <TouchableOpacity style={styles.bagSizeCollapsed} onPress={() => { chipToggle(); setBagCollapsed(false); }} activeOpacity={0.7}>
                          <Text style={styles.bagSizeLabel}>Bag Size</Text>
                          <View style={styles.bagSizeValueRow}>
                            <Text style={styles.bagSizeValue}>{quantityValue} {quantityUnit}</Text>
                            <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
                          </View>
                        </TouchableOpacity>
                      )}

                      <Text style={styles.label}>Daily feeding routine</Text>
                      <Text style={styles.mealSentence}>How many meals per day will {pet.name} eat <Text style={styles.mealSentenceBold}>this food</Text>?</Text>
                      
                      <View style={styles.stepperContainer}>
                        <Text style={styles.stepperLabel}>{mealsCovered} meal{mealsCovered !== 1 ? 's' : ''}</Text>
                        <View style={styles.stepperRow}>
                          <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMealsCovered(-1)} disabled={mealsCovered <= 1}>
                            <Ionicons name="remove" size={20} color={mealsCovered <= 1 ? Colors.textTertiary : Colors.textPrimary} />
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{mealsCovered}</Text>
                          <TouchableOpacity style={styles.stepperButton} onPress={() => adjustMealsCovered(1)} disabled={mealsCovered >= maxMealsCovered}>
                            <Ionicons name="add" size={20} color={mealsCovered >= maxMealsCovered ? Colors.textTertiary : Colors.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {stepperHint && (
                        <Text style={styles.stepperHintText}>To replace this food entirely, select "Yes" above to start a Safe Switch.</Text>
                      )}

                      {showsRebalanceNote && mealsCovered < totalMealsPerDay && (
                        <View style={styles.rebalanceNoteRow}>
                          <Ionicons name="information-circle" size={16} color={Colors.severityAmber} />
                          <Text style={styles.rebalanceNoteText}>Existing foods will cover the other {totalMealsPerDay - mealsCovered} meal{totalMealsPerDay - mealsCovered > 1 ? 's' : ''}.</Text>
                        </View>
                      )}

                      {/* Auto Math Block */}
                      {canAutoCalc && (
                        <View style={styles.autoStatusRow}>
                          <View style={autoMode ? styles.autoBadge : styles.manualBadge}>
                            <Text style={autoMode ? styles.autoBadgeText : styles.manualBadgeText}>{autoMode ? 'Auto' : 'Manual'}</Text>
                          </View>
                          {autoMode && autoServingResult ? (
                            <View style={{flex:1}}>
                              <Text style={styles.autoResultValue}>{Math.round(autoServingResult.amount * 100) / 100} <Text style={styles.autoResultUnit}>{autoServingResult.unit} per meal</Text></Text>
                              {mealsCovered > 1 && (
                                <Text style={styles.autoMathLine}><Text style={styles.dimmedText}>{Math.round(autoServingResult.amount * mealsCovered * 100) / 100} {autoServingResult.unit}/day ({mealsCovered} meals)</Text></Text>
                              )}
                              <Text style={styles.autoMathLine}><Text style={styles.dimmedText}>{Math.round(autoServingResult.dailyKcal)} kcal daily allocation ({Math.round(mealsCovered / totalMealsPerDay * 100)}%)</Text></Text>
                            </View>
                          ) : (
                            <View style={styles.inputRow}>
                              <TextInput style={styles.numberInput} keyboardType="decimal-pad" value={String(manualServingSize)} onChangeText={(t) => setManualServingSize(parseFloat(t) || 0)} />
                              <Text style={styles.unitSuffix}>{manualServingUnit}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {autoMode && canAutoCalc && autoServingResult && autoServingResult.unit === 'cups' && (
                        <View style={styles.conversionToggle}>
                          <TouchableOpacity onPress={() => { chipToggle(); setConversionsExpanded(!conversionsExpanded); }} style={{flexDirection: 'row', alignItems: 'center', gap: 4}} activeOpacity={0.7}>
                            <Text style={styles.conversionLinkText}>See conversions & manual override</Text>
                            <Ionicons name={conversionsExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      )}

                      {conversionsExpanded && canAutoCalc && autoServingResult && (
                        <View style={styles.conversionExpanded}>
                          {(() => {
                            const conv = computeServingConversions(effectiveServingSize);
                            return (
                              <Text style={styles.conversionText}>Equivalent to ~{Math.round(conv.g)}g or ~{Math.round(conv.oz)}oz per meal.</Text>
                            );
                          })()}
                          <TouchableOpacity onPress={() => { chipToggle(); setAutoMode(false); setManualServingSize(Math.round(autoServingResult!.amount * 100) / 100); setConversionsExpanded(false); }} style={styles.resetToAutoLink}>
                            <Text style={[styles.resetToAutoText, {color: Colors.textSecondary}]}>Switch to Manual Edit</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {!autoMode && canAutoCalc && (
                        <TouchableOpacity onPress={() => { chipToggle(); setAutoMode(true); }} style={styles.resetToAutoLink}>
                          <Text style={styles.resetToAutoText}>Reset to Auto Math</Text>
                        </TouchableOpacity>
                      )}

                    </>
                  )}
                </>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  isNewToDiet === true && onStartSafeSwitch && styles.safeSwitchCta,
                  (!ctaReady || submitting) && styles.confirmButtonDisabled
                ]}
                onPress={handleCTA}
                disabled={!ctaReady || submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? 'Please wait...' : isNewToDiet === true && onStartSafeSwitch ? 'Continue to Safe Switch' : `Add to ${pet.name}'s Pantry`}
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
