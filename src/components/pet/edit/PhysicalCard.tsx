// PhysicalCard — breed selector, date of birth pickers, and weight input for EditPetScreen.
// Parent owns all state and handlers; this component is pure presentation + callbacks.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import WheelPicker, {
  SHORT_MONTHS,
  CURRENT_YEAR,
  YEAR_ITEMS,
  APPROX_YEARS,
  APPROX_MONTHS_ITEMS,
} from '../WheelPicker';

interface Props {
  // Breed
  breed: string | null;
  onOpenBreedSelector: () => void;

  // DOB
  dobMode: 'exact' | 'approximate';
  onDobModeToggle: (mode: 'exact' | 'approximate') => void;
  dobMonth: number;
  onDobMonthSelect: (i: number) => void;
  dobYear: number;
  onDobYearSelect: (i: number) => void;
  approxYears: number;
  onApproxYearsSelect: (i: number) => void;
  approxMonths: number;
  onApproxMonthsSelect: (i: number) => void;
  dobError?: string;

  // Weight
  weight: string;
  onWeightChange: (v: string) => void;
  weightUnit: 'lbs' | 'kg';
  onWeightUnitChange: (u: 'lbs' | 'kg') => void;
  weightError?: string;
}

export function PhysicalCard({
  breed,
  onOpenBreedSelector,
  dobMode,
  onDobModeToggle,
  dobMonth,
  onDobMonthSelect,
  dobYear,
  onDobYearSelect,
  approxYears,
  onApproxYearsSelect,
  approxMonths,
  onApproxMonthsSelect,
  dobError,
  weight,
  onWeightChange,
  weightUnit,
  onWeightUnitChange,
  weightError,
}: Props) {
  return (
    <View style={styles.card}>
      {/* Breed */}
      <Text style={styles.fieldLabel}>Breed</Text>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={onOpenBreedSelector}
        activeOpacity={0.6}
      >
        <Text style={[styles.selectorText, !breed && styles.selectorPlaceholder]}>
          {breed ?? 'Select breed'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {/* Date of Birth */}
      <Text style={styles.fieldLabel}>Date of Birth</Text>
      <View style={styles.segmentedRow}>
        <TouchableOpacity
          style={[styles.segmentButton, dobMode === 'exact' && styles.segmentButtonActive]}
          onPress={() => onDobModeToggle('exact')}
        >
          <Text style={[styles.segmentText, dobMode === 'exact' && styles.segmentTextActive]}>
            Exact Date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, dobMode === 'approximate' && styles.segmentButtonActive]}
          onPress={() => onDobModeToggle('approximate')}
        >
          <Text
            style={[styles.segmentText, dobMode === 'approximate' && styles.segmentTextActive]}
          >
            Estimate
          </Text>
        </TouchableOpacity>
      </View>

      {dobMode === 'exact' ? (
        <View style={styles.dobRow}>
          <View style={styles.dobPickerGroup}>
            <Text style={styles.dobPickerLabel}>Month</Text>
            <WheelPicker
              items={SHORT_MONTHS}
              selectedIndex={dobMonth}
              onSelect={onDobMonthSelect}
            />
          </View>
          <View style={styles.dobPickerGroup}>
            <Text style={styles.dobPickerLabel}>Year</Text>
            <WheelPicker
              items={YEAR_ITEMS}
              selectedIndex={dobYear - (CURRENT_YEAR - 30)}
              onSelect={onDobYearSelect}
            />
          </View>
        </View>
      ) : (
        <View style={styles.dobRow}>
          <View style={styles.dobPickerGroup}>
            <Text style={styles.dobPickerLabel}>Years</Text>
            <WheelPicker
              items={APPROX_YEARS}
              selectedIndex={approxYears}
              onSelect={onApproxYearsSelect}
            />
          </View>
          <View style={styles.dobPickerGroup}>
            <Text style={styles.dobPickerLabel}>Months</Text>
            <WheelPicker
              items={APPROX_MONTHS_ITEMS}
              selectedIndex={approxMonths}
              onSelect={onApproxMonthsSelect}
            />
          </View>
        </View>
      )}

      {dobError && <Text style={styles.errorText}>{dobError}</Text>}

      {/* Weight */}
      <Text style={styles.fieldLabel}>Weight</Text>
      <View style={styles.weightRow}>
        <TextInput
          style={[styles.textInput, styles.weightInput, weightError && styles.inputError]}
          placeholder="Current weight"
          placeholderTextColor={Colors.textTertiary}
          value={weight}
          onChangeText={onWeightChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        <View style={styles.weightChipRow}>
          {(['lbs', 'kg'] as const).map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.weightChip, weightUnit === u && styles.weightChipSelected]}
              onPress={() => onWeightUnitChange(u)}
            >
              <Text
                style={[
                  styles.weightChipText,
                  weightUnit === u && styles.weightChipTextSelected,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {weightError && <Text style={styles.errorText}>{weightError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  inputError: {
    borderColor: Colors.severityRed,
  },
  errorText: {
    fontSize: FontSizes.xs,
    color: Colors.severityRed,
    marginTop: Spacing.xs,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.chipSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#00B4D820',
    borderColor: Colors.accent,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  selectorButton: {
    height: 52,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  selectorText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  selectorPlaceholder: {
    color: Colors.textTertiary,
  },
  dobRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  dobPickerGroup: {
    flex: 1,
  },
  dobPickerLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
  },
  weightChipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  weightChip: {
    backgroundColor: Colors.chipSurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  weightChipSelected: {
    backgroundColor: '#00B4D820',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  weightChipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  weightChipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
