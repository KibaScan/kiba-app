// Kiba — M9 Community RecipePrepStepRow (Task 24)
// One prep-step in the submit form's ordered list. Caller owns state. The step
// number is derived from `index` (1-based in UI) and re-renders automatically
// when siblings are removed. `canRemove` hides the trash when at min count (1).
// D-084: Ionicons only.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface Props {
  step: string;
  index: number;
  onChange: (next: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function RecipePrepStepRow({
  step,
  index,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.numberBubble}>
        <Text style={styles.numberText}>{index + 1}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={`Step ${index + 1}`}
        placeholderTextColor={Colors.textTertiary}
        value={step}
        onChangeText={onChange}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        maxLength={400}
        accessibilityLabel={`Prep step ${index + 1}`}
      />
      {canRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel="Remove step"
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
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  numberBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.chipSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  numberText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  removeBtn: {
    padding: 4,
    marginTop: 6,
  },
});
