// AddToPantrySheet — Bottom sheet for adding a product to a pet's pantry.
// Entry point: ResultScreen CTA. Spec: PANTRY_SPEC.md §3a.
// Zero emoji (D-084). UPVM compliant (D-095).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  UnitLabel,
  FeedingFrequency,
} from '../../types/pantry';
import { PantryOfflineError } from '../../types/pantry';
import { addToPantry } from '../../services/pantryService';
import {
  defaultServingMode,
  getSystemRecommendation,
  calculateDepletionBreakdown,
  getCalorieContext,
} from '../../utils/pantryHelpers';
import { canUseGoalWeight } from '../../utils/permissions';
import { chipToggle, saveSuccess } from '../../utils/haptics';
import { stripBrandFromName } from '../../utils/formatters';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

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
  unitLabel: UnitLabel;
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
    ...(params.servingMode === 'unit' ? { unit_label: params.unitLabel } : {}),
    serving_size: params.servingSize,
    serving_size_unit: params.servingSizeUnit,
    feedings_per_day: params.feedingsPerDay,
    feeding_frequency: params.feedingFrequency,
  };
}

// ─── Weight unit options ────────────────────────────────

const WEIGHT_UNITS: QuantityUnit[] = ['lbs', 'oz', 'kg', 'g'];
const UNIT_LABELS: UnitLabel[] = ['cans', 'pouches'];

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

  // ─── State ──────────────────────────────────────────────
  const [servingMode, setServingMode] = useState<ServingMode>('weight');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('lbs');
  const [unitLabel, setUnitLabel] = useState<UnitLabel>('cans');
  const [servingSize, setServingSize] = useState(1);
  const [servingSizeUnit, setServingSizeUnit] = useState<ServingSizeUnit>('cups');
  const [feedingsPerDay, setFeedingsPerDay] = useState(2);
  const [feedingFrequency, setFeedingFrequency] = useState<FeedingFrequency>('daily');
  const [customServing, setCustomServing] = useState(false);
  const [customServingText, setCustomServingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Reset on open ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const mode = treat ? 'unit' : defaultServingMode(product.product_form);
    setServingMode(mode);
    setQuantityValue('');
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setUnitLabel(product.product_form === 'wet' ? 'cans' : 'pouches');
    setFeedingsPerDay(getDefaultFeedingsPerDay(product.category));
    setFeedingFrequency(getDefaultFeedingFrequency(product.category));
    setCustomServing(false);
    setCustomServingText('');
    setSubmitting(false);
    setError(null);

    // Pre-fill serving from recommendation
    const rec = getSystemRecommendation(product, pet, canUseGoalWeight());
    if (rec) {
      setServingSize(Math.round(rec.amount * 10) / 10);
      setServingSizeUnit(rec.unit);
    } else {
      setServingSize(1);
      setServingSizeUnit(mode === 'weight' ? 'cups' : 'units');
    }
  }, [visible, product, pet, treat]);

  // ─── Derived ────────────────────────────────────────────

  const effectiveQuantityUnit: QuantityUnit =
    servingMode === 'unit' ? 'units' : quantityUnit;

  const effectiveServingSizeUnit: ServingSizeUnit =
    servingMode === 'unit' ? 'units' : servingSizeUnit;

  const depletion = useMemo(() => {
    if (treat) return null;
    const qty = parseFloat(quantityValue);
    if (isNaN(qty) || qty <= 0 || servingSize <= 0) return null;
    return calculateDepletionBreakdown(
      servingSize,
      effectiveServingSizeUnit,
      feedingsPerDay,
      qty,
      effectiveQuantityUnit,
      servingMode === 'unit' ? unitLabel : null,
      product,
    );
  }, [treat, quantityValue, servingSize, effectiveServingSizeUnit, feedingsPerDay, effectiveQuantityUnit, unitLabel, servingMode, product]);

  const recommendation = useMemo(() => {
    if (treat) return null;
    return getSystemRecommendation(product, pet, canUseGoalWeight());
  }, [treat, product, pet]);

  const calorieCtx = useMemo(() => {
    if (treat) return null;
    return getCalorieContext(product, pet, servingSize, effectiveServingSizeUnit, feedingsPerDay);
  }, [treat, product, pet, servingSize, effectiveServingSizeUnit, feedingsPerDay]);

  const formValid = isFormValid(quantityValue, treat ? 1 : servingSize);

  // ─── Handlers ───────────────────────────────────────────

  const handleServingModeToggle = useCallback((mode: ServingMode) => {
    chipToggle();
    setServingMode(mode);
    setQuantityUnit(mode === 'weight' ? 'lbs' : 'units');
    setServingSizeUnit(mode === 'weight' ? 'cups' : 'units');
    setCustomServing(false);
  }, []);

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
    setFeedingsPerDay((prev) => Math.max(1, Math.min(3, prev + delta)));
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
        unitLabel,
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
      const msg =
        e instanceof PantryOfflineError
          ? e.message
          : 'Failed to add to pantry. Please try again.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    product.id, quantityValue, effectiveQuantityUnit, servingMode, unitLabel,
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
                {/* Row 1: Quantity */}
                <Text style={styles.label}>
                  {servingMode === 'weight' ? 'Bag size' : 'Total count'}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.numberInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    value={quantityValue}
                    onChangeText={setQuantityValue}
                  />
                  {servingMode === 'weight' ? (
                    <View style={styles.chipRow}>
                      {WEIGHT_UNITS.map((u) =>
                        renderChip(u, quantityUnit === u, () => {
                          chipToggle();
                          setQuantityUnit(u);
                        }, `wu-${u}`),
                      )}
                    </View>
                  ) : (
                    <View style={styles.chipRow}>
                      {UNIT_LABELS.map((l) =>
                        renderChip(l, unitLabel === l, () => {
                          chipToggle();
                          setUnitLabel(l);
                        }, `ul-${l}`),
                      )}
                    </View>
                  )}
                </View>

                {/* Row 2: Serving size (non-treats only) */}
                {!treat && (
                  <>
                    <Text style={styles.label}>Amount per feeding</Text>
                    {servingMode === 'weight' ? (
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.numberInput}
                          keyboardType="numeric"
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
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor={Colors.textTertiary}
                        value={customServingText}
                        onChangeText={handleCustomServingChange}
                        autoFocus
                      />
                    )}
                  </>
                )}

                {/* Row 3: Feedings per day (non-treats only) */}
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
                        disabled={feedingsPerDay >= 3}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={feedingsPerDay >= 3 ? Colors.textTertiary : Colors.textPrimary}
                        />
                      </TouchableOpacity>
                    </View>
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

              {/* E. System recommendation */}
              {recommendation && !treat && (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>
                    Recommended: ~{Math.round(recommendation.amount * 10) / 10} {recommendation.unit}/day based on {pet.name}'s profile
                  </Text>
                </View>
              )}

              {/* F. Calorie context */}
              {calorieCtx && !treat && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>
                    ~{calorieCtx.daily_kcal} kcal/day of {pet.name}'s {calorieCtx.target_kcal} kcal target
                    {calorieCtx.source === 'estimated' ? ' (estimated)' : ''}
                  </Text>
                </View>
              )}

              {/* Error */}
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* G. Confirm button */}
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

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  brandText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  nameText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.card,
  },
  toggleText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },

  // Section
  section: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    minWidth: 70,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  customInput: {
    marginTop: Spacing.sm,
    width: '100%',
  },
  unitSuffix: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.accent,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepperValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Error
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.severityRed,
    marginBottom: Spacing.sm,
  },

  // Confirm
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  bottomSpacer: {
    height: 34,
  },
});
