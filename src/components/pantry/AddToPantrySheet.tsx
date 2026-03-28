// AddToPantrySheet — Bottom sheet for adding a product to a pet's pantry.
// D-165: Budget-aware auto/manual serving recommendations.
// D-164: Unit label always 'servings'. D-084: Zero emoji. D-095: UPVM compliant.

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
  Pressable,
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
  computeAutoServingSize,
  computeBudgetWarning,
  getSmartDefaultFeedingsPerDay,
  parseProductSize,
  convertToKg,
  convertFromKg,
  convertWeightToCups,
} from '../../utils/pantryHelpers';
import { usePantryStore } from '../../stores/usePantryStore';
import { canUseGoalWeight } from '../../utils/permissions';
import { chipToggle, saveSuccess } from '../../utils/haptics';
import { stripBrandFromName } from '../../utils/formatters';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { styles } from './AddToPantryStyles';

// ─── Exported Pure Helpers ──────────────────────────────

export const FRACTIONAL_CHIPS: { label: string; value: number }[] = [
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
  return category === Category.Treat;
}

export function getDefaultFeedingsPerDay(category: Category): number {
  return category === Category.Treat ? 1 : 2;
}

export function getDefaultFeedingFrequency(category: Category): FeedingFrequency {
  return category === Category.Treat ? 'as_needed' : 'daily';
}

export function isFormValid(quantityValue: string, servingSize: number): boolean {
  const qty = parseFloat(quantityValue);
  return !isNaN(qty) && qty > 0 && servingSize > 0;
}

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

// ─── Weight unit options ────────────────────────────────

const WEIGHT_UNITS: QuantityUnit[] = ['lbs', 'oz', 'kg', 'g'];

// ─── Props ──────────────────────────────────────────────

interface AddToPantrySheetProps {
  product: Product;
  pet: Pet;
  visible: boolean;
  onClose: () => void;
  onAdded: (item: PantryItem) => void;
}

// ─── Component ──────────────────────────────────────────

export function AddToPantrySheet({
  product,
  pet,
  visible,
  onClose,
  onAdded,
}: AddToPantrySheetProps) {
  const treat = isTreat(product.category);

  // ─── Pantry store (D-165: budget awareness) ──────────────
  const pantryItems = usePantryStore(s => s.items);
  const pantryPetId = usePantryStore(s => s._petId);

  // ─── State ──────────────────────────────────────────────
  const [servingMode, setServingMode] = useState<ServingMode>('weight');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('lbs');
  const [servingSize, setServingSize] = useState(1);
  const [servingSizeUnit, setServingSizeUnit] = useState<ServingSizeUnit>('cups');
  const [feedingsPerDay, setFeedingsPerDay] = useState(2);
  const [feedingFrequency, setFeedingFrequency] = useState<FeedingFrequency>('daily');
  const [customServing, setCustomServing] = useState(false);
  const [customServingText, setCustomServingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);

  // Saved weight values for Weight→Units→Weight round-trip
  const savedWeight = useRef<{ value: string; unit: QuantityUnit } | null>(null);

  // ─── D-165: Budget values (memoized) ─────────────────────

  const petDer = useMemo(() => computePetDer(pet, canUseGoalWeight(), pet.weight_goal_level), [pet]);

  const existingKcal = useMemo(() => {
    if (pantryPetId !== pet.id) return 0;
    return computeExistingPantryKcal(pantryItems, pet.id);
  }, [pantryItems, pantryPetId, pet.id]);

  const remainingBudget = petDer != null ? Math.max(0, petDer - existingKcal) : null;

  const autoServing = useMemo(() => {
    if (treat || remainingBudget == null) return null;
    return computeAutoServingSize(remainingBudget, feedingsPerDay, product);
  }, [treat, remainingBudget, feedingsPerDay, product]);

  // Whether auto mode can work (needs calorie data)
  const canAutoCalc = autoServing != null;

  // ─── Auto-sync serving size ──────────────────────────────
  useEffect(() => {
    if (!autoMode || !autoServing) return;
    setServingSize(Math.round(autoServing.amount * 100) / 100);
    setServingSizeUnit(autoServing.unit);
  }, [autoMode, autoServing]);

  // ─── Reset on open ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const mode = treat ? 'unit' : defaultServingMode(product.product_form);
    setServingMode(mode);
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setFeedingsPerDay(getSmartDefaultFeedingsPerDay(product.category, pantryItems, pet.id));
    setFeedingFrequency(getDefaultFeedingFrequency(product.category));
    setCustomServing(false);
    setCustomServingText('');
    setSubmitting(false);
    setError(null);
    setAutoMode(true);
    savedWeight.current = null;

    // D-165: Product size pre-fill
    const parsed = parseProductSize(product.name);
    if (parsed) {
      setQuantityValue(String(parsed.quantity));
      if (parsed.unit !== 'units' && mode === 'weight') {
        setQuantityUnit(parsed.unit);
      }
    } else {
      setQuantityValue('');
    }

    // Compute auto serving directly on open (don't rely on effect chain —
    // if memo dependencies haven't changed, auto-sync effect won't re-fire)
    const newFeedings = getSmartDefaultFeedingsPerDay(product.category, pantryItems, pet.id);
    const der = computePetDer(pet, canUseGoalWeight(), pet.weight_goal_level);
    if (!treat && der != null) {
      const existKcal = computeExistingPantryKcal(pantryItems, pet.id);
      const budget = Math.max(0, der - existKcal);
      const auto = computeAutoServingSize(budget, newFeedings, product);
      if (auto) {
        setServingSize(Math.round(auto.amount * 100) / 100);
        setServingSizeUnit(auto.unit);
      } else {
        setServingSize(1);
        setServingSizeUnit(mode === 'weight' ? 'cups' : 'units');
      }
    } else {
      setServingSize(1);
      setServingSizeUnit(mode === 'weight' ? 'cups' : 'units');
    }

    // Ensure pantry data is loaded for this pet
    if (pantryPetId !== pet.id) {
      usePantryStore.getState().loadPantry(pet.id);
    }
  }, [visible, product, pet, treat]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ────────────────────────────────────────────

  const effectiveQuantityUnit: QuantityUnit =
    servingMode === 'unit' ? 'units' : quantityUnit;

  const effectiveServingSizeUnit: ServingSizeUnit =
    servingMode === 'unit' ? 'units' : servingSizeUnit;

  const effectiveServingSize = (autoMode && canAutoCalc && autoServing)
    ? autoServing.amount
    : servingSize;

  const depletion = useMemo(() => {
    if (treat) return null;
    const qty = parseFloat(quantityValue);
    if (isNaN(qty) || qty <= 0 || effectiveServingSize <= 0) return null;
    return calculateDepletionBreakdown(
      effectiveServingSize,
      effectiveServingSizeUnit,
      feedingsPerDay,
      qty,
      effectiveQuantityUnit,
      servingMode === 'unit' ? 'servings' : null,
      product,
    );
  }, [treat, quantityValue, effectiveServingSize, effectiveServingSizeUnit, feedingsPerDay, effectiveQuantityUnit, servingMode, product]);

  // D-165: Budget warning (manual mode only)
  const budgetWarning = useMemo(() => {
    if (treat || autoMode || petDer == null) return null;
    return computeBudgetWarning({
      servingSize,
      servingSizeUnit: effectiveServingSizeUnit,
      feedingsPerDay,
      product,
      maintenanceDer: petDer,
      adjustedDer: petDer, // D-160: already includes weight_goal_level via computePetDer
      existingPantryKcal: existingKcal,
      petName: pet.name,
      isTreat: treat,
    });
  }, [treat, autoMode, petDer, servingSize, effectiveServingSizeUnit, feedingsPerDay, product, existingKcal, pet.name]);

  // Form validation — auto mode only needs quantity; manual needs quantity + serving
  const formValid = (() => {
    const qty = parseFloat(quantityValue);
    if (isNaN(qty) || qty <= 0) return false;
    if (treat) return true;
    if (autoMode && canAutoCalc) return true;
    return servingSize > 0;
  })();

  // ─── Handlers ───────────────────────────────────────────

  const handleServingModeToggle = useCallback((mode: ServingMode) => {
    chipToggle();
    if (mode === 'unit' && servingMode === 'weight') {
      // Save weight values before switching to units
      savedWeight.current = { value: quantityValue, unit: quantityUnit };
    } else if (mode === 'weight' && servingMode === 'unit' && savedWeight.current) {
      // Restore saved weight values
      setQuantityValue(savedWeight.current.value);
      setQuantityUnit(savedWeight.current.unit);
      setServingSizeUnit('cups');
      setServingMode('weight');
      setCustomServing(false);
      return;
    }
    setServingMode(mode);
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setServingSizeUnit(mode === 'weight' ? 'cups' : 'units');
    setCustomServing(false);
  }, [servingMode, quantityValue, quantityUnit]);

  const handleAutoManualToggle = useCallback((isAuto: boolean) => {
    chipToggle();
    setAutoMode(isAuto);
    if (!isAuto && autoServing) {
      // Pre-fill manual input with current auto value
      setServingSize(Math.round(autoServing.amount * 100) / 100);
      setServingSizeUnit(autoServing.unit);
    }
  }, [autoServing]);

  const handleFractionalChip = useCallback((value: number) => {
    chipToggle();
    setServingSize(value);
    setCustomServing(false);
  }, []);

  const handleCustomChip = useCallback(() => {
    chipToggle();
    setCustomServing(true);
    setCustomServingText(String(servingSize));
  }, [servingSize]);

  const handleCustomServingChange = useCallback((text: string) => {
    setCustomServingText(text);
    const val = parseFloat(text);
    if (!isNaN(val) && val > 0) setServingSize(val);
  }, []);

  const adjustFeedings = useCallback((delta: number) => {
    chipToggle();
    setFeedingsPerDay((prev) => Math.max(1, Math.min(5, prev + delta)));
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const input = buildAddToPantryInput({
        productId: product.id,
        quantityValue,
        quantityUnit: effectiveQuantityUnit,
        servingMode,
        servingSize: treat ? 1 : servingSize,
        servingSizeUnit: treat ? 'units' : effectiveServingSizeUnit,
        feedingsPerDay: treat ? 1 : feedingsPerDay,
        feedingFrequency,
      });
      const item = await addToPantry(input, pet.id);
      saveSuccess();
      onAdded(item);
      onClose();
    } catch (e) {
      const msg = e instanceof PantryOfflineError
        ? e.message
        : e instanceof Error ? e.message : 'Failed to add to pantry. Please try again.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    product.id, quantityValue, effectiveQuantityUnit, servingMode,
    servingSize, effectiveServingSizeUnit, feedingsPerDay, feedingFrequency,
    treat, pet.id, onAdded, onClose,
  ]);

  // ─── Render Helpers ─────────────────────────────────────

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    key: string,
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const effectiveAutoMode = autoMode && canAutoCalc;

  // ─── JSX ────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* A. Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={styles.productImage}
                    />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <Ionicons name="cube-outline" size={24} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.headerText}>
                    <Text style={styles.brandText} numberOfLines={1}>
                      {product.brand}
                    </Text>
                    <Text style={styles.nameText} numberOfLines={2}>
                      {stripBrandFromName(product.brand, product.name)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.closeButton}
                >
                  <Ionicons name="close-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* D-165: Significantly over budget warning banner */}
              {budgetWarning?.level === 'significantly_over' && (
                <View style={styles.warningBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.severityAmber} />
                  <Text style={styles.warningBannerText}>{budgetWarning.message}</Text>
                </View>
              )}

              {/* B. Serving mode toggle (hidden for treats) */}
              {!treat && (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleButton, servingMode === 'weight' && styles.toggleButtonActive]}
                    onPress={() => handleServingModeToggle('weight')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toggleText, servingMode === 'weight' && styles.toggleTextActive]}>
                      Weight
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleButton, servingMode === 'unit' && styles.toggleButtonActive]}
                    onPress={() => handleServingModeToggle('unit')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toggleText, servingMode === 'unit' && styles.toggleTextActive]}>
                      Units
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* C. Quantity inputs */}
              <View style={styles.section}>
                {/* Row 1: Quantity / Bag size */}
                <Text style={styles.label}>
                  {servingMode === 'weight' ? 'Bag size' : 'Total servings'}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.numberInput}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    value={quantityValue}
                    onChangeText={setQuantityValue}
                  />
                  {servingMode === 'weight' ? (
                    <View style={styles.chipRow}>
                      {WEIGHT_UNITS.map((u) =>
                        renderChip(u, quantityUnit === u, () => {
                          const val = parseFloat(quantityValue);
                          if (!isNaN(val) && val > 0 && quantityUnit !== u) {
                            const kg = convertToKg(val, quantityUnit);
                            const converted = convertFromKg(kg, u);
                            const rounded = u === 'g' ? Math.round(converted)
                              : u === 'kg' ? Math.round(converted * 100) / 100
                              : Math.round(converted * 10) / 10;
                            setQuantityValue(String(rounded));
                          }
                          chipToggle();
                          setQuantityUnit(u);
                        }, `wu-${u}`),
                      )}
                    </View>
                  ) : (
                    <Text style={styles.unitSuffix}>servings</Text>
                  )}
                </View>
                {servingMode === 'weight' && product.product_form === 'dry' && (() => {
                  const val = parseFloat(quantityValue);
                  if (isNaN(val) || val <= 0) return null;
                  const cups = convertWeightToCups(val, quantityUnit, product.ga_kcal_per_kg, product.ga_kcal_per_cup);
                  if (cups == null) return null;
                  const roundedCups = Math.round(cups);
                  return (
                    <View>
                      <Text style={styles.cupEquivalent}>
                        {`\u2248 ${roundedCups} cups`}
                        {effectiveServingSize > 0
                          ? ` \u00B7 ~${Math.round(roundedCups / effectiveServingSize)} servings at ${Math.round(effectiveServingSize * 100) / 100} cups each`
                          : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          chipToggle();
                          savedWeight.current = { value: quantityValue, unit: quantityUnit };
                          setServingMode('unit');
                          setQuantityValue(String(roundedCups));
                          setQuantityUnit('units');
                          setServingSizeUnit('units');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.servingsLink}>Track in cups instead</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Row 2: Feedings per day (non-treats only) — moved ABOVE serving */}
                {!treat && (
                  <>
                    <Text style={styles.label}>Feedings per day</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => adjustFeedings(-1)}
                        disabled={feedingsPerDay <= 1}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color={feedingsPerDay <= 1 ? Colors.textTertiary : Colors.textPrimary}
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{feedingsPerDay}</Text>
                      <TouchableOpacity
                        style={styles.stepperButton}
                        onPress={() => adjustFeedings(1)}
                        disabled={feedingsPerDay >= 5}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={feedingsPerDay >= 5 ? Colors.textTertiary : Colors.textPrimary}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Row 3: Auto/Manual toggle (non-treats, only when calorie data exists) */}
                {!treat && canAutoCalc && (
                  <>
                    <Text style={styles.label}>Serving calculation</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.toggleButton, autoMode && styles.toggleButtonActive]}
                        onPress={() => handleAutoManualToggle(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.toggleText, autoMode && styles.toggleTextActive]}>
                          Auto
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleButton, !autoMode && styles.toggleButtonActive]}
                        onPress={() => handleAutoManualToggle(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.toggleText, !autoMode && styles.toggleTextActive]}>
                          Manual
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Row 4: Serving size display / input (non-treats only) */}
                {!treat && effectiveAutoMode && autoServing && (
                  <>
                    <Text style={styles.label}>Amount per feeding</Text>
                    <View style={styles.autoServingDisplay}>
                      <Text style={styles.autoServingValue}>
                        {Math.round(autoServing.amount * 100) / 100}
                      </Text>
                      <Text style={styles.autoServingUnit}>
                        {autoServing.unit} per feeding
                      </Text>
                    </View>
                    {remainingBudget != null && petDer != null && (
                      <Text style={styles.autoServingMath}>
                        {existingKcal > 0
                          ? `${remainingBudget} kcal remaining of ${petDer} kcal budget`
                          : `${petDer} kcal daily budget`}
                        {` \u00F7 ${feedingsPerDay} feeding${feedingsPerDay > 1 ? 's' : ''}`}
                      </Text>
                    )}
                    {remainingBudget === 0 && (
                      <Text style={styles.budgetMetText}>
                        {pet.name}'s calorie budget is already met by current pantry items.
                      </Text>
                    )}
                  </>
                )}

                {!treat && !effectiveAutoMode && (
                  <>
                    <Text style={styles.label}>Amount per feeding</Text>
                    {servingMode === 'weight' ? (
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.numberInput}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textTertiary}
                          value={String(servingSize)}
                          onChangeText={(t) => {
                            const val = parseFloat(t);
                            if (!isNaN(val)) setServingSize(val);
                            else if (t === '') setServingSize(0);
                          }}
                        />
                        <Text style={styles.unitSuffix}>cups</Text>
                      </View>
                    ) : (
                      <View style={styles.chipRow}>
                        {FRACTIONAL_CHIPS.map((chip) =>
                          renderChip(
                            chip.label,
                            !customServing && servingSize === chip.value,
                            () => handleFractionalChip(chip.value),
                            `fc-${chip.value}`,
                          ),
                        )}
                        {renderChip(
                          'Custom',
                          customServing,
                          handleCustomChip,
                          'fc-custom',
                        )}
                      </View>
                    )}
                    {customServing && servingMode === 'unit' && (
                      <TextInput
                        style={[styles.numberInput, styles.customInput]}
                        keyboardType="decimal-pad"
                        placeholder="Enter amount"
                        placeholderTextColor={Colors.textTertiary}
                        value={customServingText}
                        onChangeText={handleCustomServingChange}
                        autoFocus
                      />
                    )}
                    {/* Auto-calc reference in manual mode */}
                    {autoServing && (
                      <Text style={styles.autoReference}>
                        Recommended: ~{Math.round(autoServing.amount * 100) / 100} {autoServing.unit}
                      </Text>
                    )}
                    {/* Budget warnings (manual mode only) */}
                    {budgetWarning?.level === 'over' && (
                      <Text style={styles.warningText}>{budgetWarning.message}</Text>
                    )}
                    {budgetWarning?.level === 'under' && (
                      <Text style={styles.underBudgetText}>{budgetWarning.message}</Text>
                    )}
                  </>
                )}
              </View>

              {/* D. Depletion breakdown */}
              {depletion && (
                <View style={styles.infoRow}>
                  <Ionicons name="timer-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    {depletion.rateText}
                    {depletion.daysText ? ` \u00B7 ${depletion.daysText}` : ''}
                  </Text>
                </View>
              )}

              {/* E. Calorie budget context */}
              {!treat && petDer != null && servingSize > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="nutrition-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    {existingKcal > 0
                      ? `${existingKcal} kcal from other pantry items \u00B7 ${remainingBudget} kcal remaining of ${petDer} kcal target`
                      : `${pet.name}'s daily target: ${petDer} kcal`}
                  </Text>
                </View>
              )}

              {/* Error */}
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* F. Confirm button */}
              <TouchableOpacity
                style={[styles.confirmButton, (!formValid || submitting) && styles.confirmButtonDisabled]}
                onPress={handleConfirm}
                disabled={!formValid || submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? 'Adding...' : `Add to ${pet.name}'s Pantry`}
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

