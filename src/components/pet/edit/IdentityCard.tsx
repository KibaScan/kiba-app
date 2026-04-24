// IdentityCard — photo picker, name input, and sex selector for EditPetScreen.
// Parent owns all state; this component is pure presentation + callbacks.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import PetPhotoSelector from '../PetPhotoSelector';
import type { Sex, Species } from '../../../types/pet';

interface Props {
  photoUri: string | null;
  species: Species;
  onPhotoSelected: (uri: string | null) => void;
  name: string;
  onNameChange: (v: string) => void;
  nameError?: string;
  sex: Sex | null;
  onSexSelect: (value: Sex) => void;
}

export function IdentityCard({
  photoUri,
  species,
  onPhotoSelected,
  name,
  onNameChange,
  nameError,
  sex,
  onSexSelect,
}: Props) {
  return (
    <View style={styles.card}>
      {/* Photo */}
      <PetPhotoSelector
        photoUrl={photoUri}
        species={species}
        onPhotoSelected={onPhotoSelected}
      />

      {/* Name */}
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={[styles.textInput, nameError && styles.inputError]}
        placeholder="What's your pet's name?"
        placeholderTextColor={Colors.textTertiary}
        value={name}
        onChangeText={onNameChange}
        maxLength={20}
        autoCapitalize="words"
        returnKeyType="done"
      />
      {nameError && <Text style={styles.errorText}>{nameError}</Text>}

      {/* Sex */}
      <Text style={styles.fieldLabel}>Sex</Text>
      <View style={styles.segmentedRow}>
        <TouchableOpacity
          style={[styles.segmentButton, sex === 'male' && styles.segmentButtonActive]}
          onPress={() => onSexSelect('male')}
        >
          <Text style={[styles.segmentText, sex === 'male' && styles.segmentTextActive]}>
            Male
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, sex === 'female' && styles.segmentButtonActive]}
          onPress={() => onSexSelect('female')}
        >
          <Text style={[styles.segmentText, sex === 'female' && styles.segmentTextActive]}>
            Female
          </Text>
        </TouchableOpacity>
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
});
