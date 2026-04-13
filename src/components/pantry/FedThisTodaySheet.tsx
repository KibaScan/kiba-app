import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Modal, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle, saveSuccess, scanWarning } from '../../utils/haptics';
import type { PantryItem, PantryPetAssignment } from '../../types/pantry';
import type { Product } from '../../types';
import { getWetFoodKcal } from '../../utils/pantryHelpers';
import { stripBrandFromName } from '../../utils/formatters';
import { logWetFeeding } from '../../services/pantryService';

// ─── Exported Pure Helpers ──────────────────────────────

/**
 * Convert a plural unit label to its singular form.
 * Handles special cases (cans/pouches → can/pouch) and trailing-s stripping.
 */
export function singularize(plural: string): string {
  if (plural === 'cans/pouches') return 'can/pouch';
  if (plural.endsWith('ches')) return plural.slice(0, -2); // pouches → pouch
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}

/**
 * Resolve the per-feeding display unit for the stepper label.
 * Priority: assignment.serving_size_unit → fall back by product_form.
 * Never reads pantryItem.quantity_unit (that's bag inventory, often 'lbs' for dry).
 */
export function resolveDisplayUnit(
  assignment: PantryPetAssignment | null,
  pantryItem: PantryItem | null,
  product: Product | null
): string {
  if (assignment?.serving_size_unit === 'cups') return 'cups';
  if (assignment?.serving_size_unit === 'scoops') return 'scoops';
  if (assignment?.serving_size_unit === 'units') {
    return pantryItem?.unit_label ?? 'servings';
  }
  // No assignment match: derive by product form
  if (product?.product_form === 'dry') return 'cups';
  return pantryItem?.unit_label ?? 'servings';
}

interface FedThisTodaySheetProps {
  isVisible: boolean;
  petId: string | null;
  pantryItem: PantryItem | null;
  product: Product | null;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function FedThisTodaySheet({
  isVisible,
  petId,
  pantryItem,
  product,
  onDismiss,
  onSuccess,
}: FedThisTodaySheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantityStr, setQuantityStr] = useState('1');

  // Reset quantity when opened
  React.useEffect(() => {
    if (isVisible) {
      setQuantityStr('1');
    } else {
      setIsSubmitting(false);
    }
  }, [isVisible]);

  const calories = useMemo(() => {
    if (!product) return 0;
    const resolved = getWetFoodKcal(product);
    return resolved?.kcal ?? 0;
  }, [product]);

  const qty = parseFloat(quantityStr) || 1;
  const totalKcal = Math.round(calories * qty);

  const handleLog = async () => {
    if (!petId || !pantryItem || !product || isSubmitting) return;

    if (qty <= 0) {
      scanWarning();
      return;
    }

    setIsSubmitting(true);
    chipToggle();

    const { error } = await logWetFeeding({
      petId,
      pantryItemId: pantryItem.id,
      kcalFed: totalKcal,
      quantityFed: qty,
    });

    if (error) {
      scanWarning();
      // Error handling is normally done by a global toast or similar
      setIsSubmitting(false);
    } else {
      saveSuccess();
      setIsSubmitting(false);
      onSuccess();
    }
  };

  const handleIncrement = () => { chipToggle(); setQuantityStr(String(qty + 0.5)); };
  const handleDecrement = () => { chipToggle(); setQuantityStr(String(Math.max(0.5, qty - 0.5))); };

  const productName = product ? stripBrandFromName(product.brand, product.name) : '';
  const unitLabel = pantryItem?.quantity_unit === 'units' ? 'cans/pouches' : pantryItem?.quantity_unit || 'units';

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Log Feeding</Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {productName}
                </Text>
              </View>

              <View style={styles.stepperContainer}>
                <Text style={styles.stepperLabel}>Amount Fed</Text>
                <View style={styles.stepperControls}>
                  <Pressable style={styles.stepperButton} onPress={handleDecrement}>
                    <Ionicons name="remove" size={24} color={Colors.textPrimary} />
                  </Pressable>
                  <View style={styles.valueDisplay}>
                    <Text style={styles.valueText}>{qty.toString().replace(/0$/, '').replace(/\.$/, '')}</Text>
                    <Text style={styles.unitText}>{qty === 1 ? unitLabel.replace(/s\/?pouches$/, '/pouch').replace(/s$/, '') : unitLabel}</Text>
                  </View>
                  <Pressable style={styles.stepperButton} onPress={handleIncrement}>
                    <Ionicons name="add" size={24} color={Colors.textPrimary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.summaryBox}>
                <Ionicons name="flame" size={20} color={Colors.severityAmber} style={styles.summaryIcon} />
                <Text style={styles.summaryText}>
                  This will log <Text style={styles.summaryBold}>{totalKcal} kcal</Text> for today.
                </Text>
              </View>

              <View style={styles.spacer} />

              <Pressable
                style={[styles.primaryCTA, isSubmitting && styles.primaryCTADisabled]}
                onPress={handleLog}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                   <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryCTAText}>Log It</Text>
                )}
              </Pressable>
              
              <View style={styles.bottomSpacer} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineBorder,
  },
  bottomSpacer: {
    height: 40,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  stepperContainer: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  stepperLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineBorder,
  },
  stepperButton: {
    padding: Spacing.md,
  },
  valueDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  valueText: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unitText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: Spacing.md,
    borderRadius: 12,
    marginVertical: Spacing.sm,
    justifyContent: 'center',
  },
  summaryIcon: {
    marginRight: 8,
  },
  summaryText: {
    fontSize: FontSizes.sm,
    color: Colors.severityAmber,
  },
  summaryBold: {
    fontWeight: '700',
  },
  spacer: {
    height: 24,
  },
  primaryCTA: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryCTADisabled: {
    opacity: 0.6,
  },
  primaryCTAText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
