// WeightEstimateSheet — D-161: Bottom sheet for weight estimate confirm/enter/dismiss.
// Opens from PetHubScreen banner or weight_estimate push notification tap.
// D-095: "may have", "estimate based on tracked feeding" — never definitive.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pet } from '../types/pet';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { updatePet } from '../services/petService';
import { KCAL_PER_LB } from '../utils/weightGoal';

interface WeightEstimateSheetProps {
  pet: Pet;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onLearnMore?: () => void;
}

export default function WeightEstimateSheet({
  pet,
  visible,
  onClose,
  onUpdate,
  onLearnMore,
}: WeightEstimateSheetProps) {
  const [enterMode, setEnterMode] = useState(false);
  const [manualWeight, setManualWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const accumulator = pet.caloric_accumulator ?? 0;
  const threshold = KCAL_PER_LB[pet.species] ?? 3150;
  const lbsChanged = Math.round(Math.abs(accumulator / threshold) * 10) / 10;
  const direction = accumulator > 0 ? 'gained' : 'lost';
  const currentWeight = pet.weight_current_lbs ?? 0;
  const estimatedWeight =
    accumulator > 0
      ? Math.round((currentWeight + lbsChanged) * 10) / 10
      : Math.round((currentWeight - lbsChanged) * 10) / 10;

  const resetAccumulator = async (newWeight?: number) => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        caloric_accumulator: 0,
        accumulator_notification_sent: false,
        accumulator_last_reset_at: new Date().toISOString(),
      };
      if (newWeight != null) {
        patch.weight_current_lbs = newWeight;
      }
      await updatePet(pet.id, patch as Partial<Pet>);
      onUpdate();
      onClose();
    } catch {
      // Silent fail — user can retry
    } finally {
      setSaving(false);
      setEnterMode(false);
      setManualWeight('');
    }
  };

  const handleConfirm = () => resetAccumulator(estimatedWeight);

  const handleEnterActual = () => {
    const parsed = parseFloat(manualWeight);
    if (isNaN(parsed) || parsed <= 0) return;
    resetAccumulator(parsed);
  };

  const handleDismiss = () => resetAccumulator();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <Text style={styles.title}>Weight Estimate for {pet.name}</Text>

            {/* Body */}
            <Text style={styles.body}>
              Based on feeding data, {pet.name} may have {direction} about{' '}
              {lbsChanged} lb.
            </Text>

            {/* Weight display */}
            <View style={styles.weightRow}>
              <View style={styles.weightCol}>
                <Text style={styles.weightLabel}>Current weight</Text>
                <Text style={styles.weightValue}>{currentWeight} lbs</Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={Colors.textTertiary}
              />
              <View style={styles.weightCol}>
                <Text style={styles.weightLabel}>Estimated</Text>
                <Text style={styles.weightValue}>~{estimatedWeight} lbs</Text>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleConfirm}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>
                Update to {estimatedWeight} lbs
              </Text>
            </TouchableOpacity>

            {enterMode ? (
              <View style={styles.enterRow}>
                <TextInput
                  style={styles.weightInput}
                  placeholder="Enter weight (lbs)"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={manualWeight}
                  onChangeText={setManualWeight}
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.enterButton,
                    (!manualWeight || saving) && styles.enterButtonDisabled,
                  ]}
                  onPress={handleEnterActual}
                  disabled={!manualWeight || saving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.enterButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setEnterMode(true)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>
                  Enter actual weight
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={handleDismiss}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.tertiaryButtonText}>Dismiss</Text>
            </TouchableOpacity>

            {/* Learn more link → BCS Reference */}
            {onLearnMore && (
              <TouchableOpacity onPress={onLearnMore} style={styles.learnMore} activeOpacity={0.7}>
                <Text style={styles.learnMoreText}>Learn about body condition scoring</Text>
              </TouchableOpacity>
            )}

            {/* Disclaimer — D-095 */}
            <Text style={styles.disclaimer}>
              This is an estimate based on tracked feeding. For accurate weight,
              use a pet scale or ask your vet.
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  body: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
  },
  weightCol: {
    alignItems: 'center',
    gap: 4,
  },
  weightLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  weightValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  secondaryButton: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  secondaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  enterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  enterButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  enterButtonDisabled: {
    opacity: 0.4,
  },
  enterButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tertiaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
  learnMore: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  learnMoreText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
