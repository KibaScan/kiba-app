// Kiba — M9 Community RecipeIngredientRow (Task 24)
// One editable row in the submit form's dynamic ingredients list. Caller owns
// state; this component is pure presentation. `canRemove` hides the trash
// button at the min-count boundary (currently 2).
// D-084: Ionicons only. Matte Premium tokens.

import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

/**
 * Ingredient in-flight value. Quantity is a string while editing — we parse
 * to `number` only when building the submit payload (empty / NaN blocks submit).
 */
export interface RecipeIngredientDraft {
  name: string;
  quantity: string;
  unit: string;
}

interface Props {
  ingredient: RecipeIngredientDraft;
  onChange: (next: RecipeIngredientDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function RecipeIngredientRow({
  ingredient,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, styles.nameInput]}
        placeholder="Ingredient name"
        placeholderTextColor={Colors.textTertiary}
        value={ingredient.name}
        onChangeText={(name) => onChange({ ...ingredient, name })}
        maxLength={60}
        accessibilityLabel="Ingredient name"
      />
      <TextInput
        style={[styles.input, styles.qtyInput]}
        placeholder="Qty"
        placeholderTextColor={Colors.textTertiary}
        value={ingredient.quantity}
        onChangeText={(quantity) => onChange({ ...ingredient, quantity })}
        keyboardType="decimal-pad"
        maxLength={8}
        accessibilityLabel="Ingredient quantity"
      />
      <TextInput
        style={[styles.input, styles.unitInput]}
        placeholder="Unit"
        placeholderTextColor={Colors.textTertiary}
        value={ingredient.unit}
        onChangeText={(unit) => onChange({ ...ingredient, unit })}
        maxLength={16}
        accessibilityLabel="Ingredient unit"
      />
      {canRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel="Remove ingredient"
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.severityRed} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  nameInput: {
    flex: 2,
  },
  qtyInput: {
    width: 56,
    textAlign: 'center',
  },
  unitInput: {
    width: 64,
    textAlign: 'center',
  },
  removeBtn: {
    padding: 4,
  },
});
