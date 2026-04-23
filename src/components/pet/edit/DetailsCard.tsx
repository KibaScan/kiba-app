// DetailsCard — activity level, feeding style, and neutered toggle for EditPetScreen.
// Parent owns all state; this component is pure presentation + callbacks.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import type { ActivityLevel, FeedingStyle, Species } from '../../../types/pet';

// D-123: Species-specific activity labels. DB values unchanged.
const DOG_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'working', label: 'Working' },
];

const CAT_ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'low', label: 'Indoor' },
  { value: 'moderate', label: 'Mixed' },
  { value: 'high', label: 'Outdoor' },
];

interface Props {
  species: Species;
  activityLevel: ActivityLevel;
  onActivitySelect: (value: ActivityLevel) => void;
  feedingStyle: FeedingStyle;
  onOpenFeedingStyle: () => void;
  isNeutered: boolean;
  setIsNeutered: (v: boolean) => void;
}

function feedingStyleLabel(style: FeedingStyle): string {
  switch (style) {
    case 'dry_only': return 'Dry food only';
    case 'dry_and_wet': return 'Mixed feeding';
    case 'wet_only': return 'Wet food only';
    case 'custom': return 'Custom split';
    default: return 'Dry food only';
  }
}

export function DetailsCard({
  species,
  activityLevel,
  onActivitySelect,
  feedingStyle,
  onOpenFeedingStyle,
  isNeutered,
  setIsNeutered,
}: Props) {
  const activityLevels = species === 'cat' ? CAT_ACTIVITY_LEVELS : DOG_ACTIVITY_LEVELS;

  return (
    <View style={styles.card}>
      {/* Activity Level */}
      <Text style={styles.fieldLabel}>Activity Level</Text>
      <View style={styles.segmentedRow}>
        {activityLevels.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={[
              styles.segmentButton,
              styles.segmentButtonSmall,
              activityLevel === level.value && styles.segmentButtonActive,
            ]}
            onPress={() => onActivitySelect(level.value)}
          >
            <Text
              style={[
                styles.segmentText,
                styles.segmentTextSmall,
                activityLevel === level.value && styles.segmentTextActive,
              ]}
            >
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feeding Style */}
      <Text style={styles.fieldLabel}>Feeding Style</Text>
      <TouchableOpacity
        style={styles.linkRow}
        activeOpacity={0.6}
        onPress={onOpenFeedingStyle}
      >
        <Text style={styles.switchLabel}>{feedingStyleLabel(feedingStyle)}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {/* Neutered */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Spayed / Neutered</Text>
        <Switch
          value={isNeutered}
          onValueChange={setIsNeutered}
          trackColor={{ false: Colors.chipSurface, true: Colors.accent }}
          thumbColor="#FFFFFF"
        />
      </View>
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
  segmentButtonSmall: {
    paddingHorizontal: Spacing.xs,
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
  segmentTextSmall: {
    fontSize: FontSizes.sm,
  },
  segmentTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 52,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  switchLabel: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
});
