// Kiba — Reusable Condition/Allergen Chip
// Used by HealthConditionsScreen for both condition and allergen grids.
// D-119: "Perfectly Healthy" uses isSpecial for green variant.
// D-121: chipToggle() haptic on every press.

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle } from '../../utils/haptics';

export interface ConditionChipProps {
  label: string;
  isSelected: boolean;
  isSpecial?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon?: string;
}

export default function ConditionChip({
  label,
  isSelected,
  isSpecial = false,
  onToggle,
  disabled = false,
  icon,
}: ConditionChipProps) {
  function handlePress() {
    chipToggle();
    onToggle();
  }

  const chipStyle = [
    styles.chip,
    isSelected && !isSpecial && styles.chipSelected,
    isSelected && isSpecial && styles.chipSpecial,
    disabled && styles.chipDisabled,
  ];

  const textStyle = [
    styles.chipText,
    isSelected && !isSpecial && styles.chipTextSelected,
    isSelected && isSpecial && styles.chipTextSpecial,
  ];

  const iconColor = isSelected
    ? isSpecial
      ? '#FFFFFF'
      : Colors.accent
    : Colors.textSecondary;

  return (
    <TouchableOpacity
      style={chipStyle}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={iconColor}
          style={styles.chipIcon}
        />
      )}
      <Text style={textStyle}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm + 2, // 10px
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#00B4D820',
    borderColor: Colors.accent,
  },
  chipSpecial: {
    backgroundColor: Colors.severityGreen,
    borderColor: Colors.severityGreen,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipIcon: {
    flexShrink: 0,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  chipTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  chipTextSpecial: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
