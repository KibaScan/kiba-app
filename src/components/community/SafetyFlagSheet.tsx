// Kiba — M9 Community SafetyFlagSheet (Task 27)
// Shared bottom sheet for D-072 community safety flag submission. Used by:
//   - ResultScreen overflow (Task 29) — full reason set, score-aware context
//   - any other in-app surface needing per-pet flag submission
//
// Recipe-concern path is intentionally NOT wired here: score_flags has FK
// constraints on BOTH pet_id and product_id (migration 045), so a bare recipe
// has no clean row shape. Kitchen detail's "Report issue" was removed in this
// task's wiring step — see KibaKitchenRecipeDetailScreen for the rationale.
//
// Pattern: Modal presentationStyle="pageSheet" (matches ToxicEntrySheet).

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle, saveSuccess, scanError } from '../../utils/haptics';
import { submitFlag } from '../../services/scoreFlagService';
import {
  ScoreFlagOfflineError,
  type ScoreFlagReason,
} from '../../types/scoreFlag';
import { REASON_LABELS, DEFAULT_REASON_ORDER } from '../../utils/safetyFlagLabels';

const DETAIL_MAX_LENGTH = 500;
const AUTO_CLOSE_DELAY_MS = 1500;

// ─── Props ──────────────────────────────────────────────

interface SafetyFlagSheetProps {
  visible: boolean;
  onClose: () => void;
  petId: string;
  productId: string;
  scanId?: string;
  defaultReason?: ScoreFlagReason;
  reasonOptions?: ScoreFlagReason[];
}

// ─── Component ──────────────────────────────────────────

export function SafetyFlagSheet({
  visible,
  onClose,
  petId,
  productId,
  scanId,
  defaultReason,
  reasonOptions,
}: SafetyFlagSheetProps) {
  const [selectedReason, setSelectedReason] = useState<ScoreFlagReason | null>(
    defaultReason ?? null,
  );
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const options = reasonOptions ?? DEFAULT_REASON_ORDER;
  const isRecipeContext = defaultReason === 'recipe_concern';
  const headerTitle = isRecipeContext ? 'Report a concern' : 'Flag this score';

  // Reset internal state on visibility flip so a closed-mid-submit / reopened
  // sheet doesn't carry over stale state. Mirrors AddToPantrySheet pattern.
  useEffect(() => {
    if (visible) {
      setSelectedReason(defaultReason ?? null);
      setDetail('');
      setSubmitting(false);
      setSubmitted(false);
      setErrorMessage(null);
    }
  }, [visible, defaultReason]);

  // Auto-close after submit success. Cleanup prevents setState-after-unmount
  // if user dismisses the sheet during the delay window.
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      onClose();
    }, AUTO_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [submitted, onClose]);

  const handleSelectReason = useCallback((reason: ScoreFlagReason) => {
    chipToggle();
    setSelectedReason(reason);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await submitFlag({
        pet_id: petId,
        product_id: productId,
        ...(scanId ? { scan_id: scanId } : {}),
        reason: selectedReason,
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      });
      saveSuccess();
      setSubmitted(true);
    } catch (e) {
      scanError();
      if (e instanceof ScoreFlagOfflineError) {
        setErrorMessage("You're offline — try again when connected.");
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [selectedReason, submitting, petId, productId, scanId, detail]);

  const submitDisabled = !selectedReason || submitting || submitted;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>What's the issue?</Text>
          <View
            style={styles.reasonGroup}
            accessibilityRole="radiogroup"
          >
            {options.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                  onPress={() => handleSelectReason(reason)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={REASON_LABELS[reason]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.reasonText}>{REASON_LABELS[reason]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, styles.detailLabel]}>
            Add more detail (optional)
          </Text>
          <TextInput
            style={styles.detailInput}
            value={detail}
            onChangeText={setDetail}
            placeholder="Add details (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={DETAIL_MAX_LENGTH}
            textAlignVertical="top"
            accessibilityLabel="Additional details"
          />
          <Text style={styles.detailCounter}>
            {detail.length}/{DETAIL_MAX_LENGTH}
          </Text>

          {submitted && (
            <View style={styles.confirmCard} accessibilityLiveRegion="polite">
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={Colors.severityGreen}
              />
              <Text style={styles.confirmText}>
                Thanks — your report was submitted.
              </Text>
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorCard} accessibilityLiveRegion="polite">
              <Ionicons
                name="warning-outline"
                size={20}
                color={Colors.severityRed}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              submitDisabled && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitDisabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Submit report"
            accessibilityState={{ disabled: submitDisabled }}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Submit report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: {
    flex: 1,
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    marginTop: Spacing.lg,
  },
  reasonGroup: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  reasonRowSelected: {
    backgroundColor: Colors.accentTint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  reasonText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  detailInput: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 96,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  detailCounter: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.severityGreen,
  },
  confirmText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.severityRed,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.chipSurface,
  },
  submitButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cancelButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
