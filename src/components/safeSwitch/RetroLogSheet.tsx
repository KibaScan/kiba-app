// Kiba — RetroLogSheet
// Bottom sheet for retroactive or read-only tummy check logging.
// D-084: Zero emoji. Fix 8: canonical sheet spec from .agent/design.md.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { TummyCheck } from '../../types/safeSwitch';

const TUMMY_OPTIONS: { key: TummyCheck; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'perfect', label: 'Perfect', icon: 'checkmark-circle-outline', color: Colors.severityGreen },
  { key: 'soft_stool', label: 'Soft Stool', icon: 'remove-circle-outline', color: Colors.severityAmber },
  { key: 'upset', label: 'Upset', icon: 'alert-circle-outline', color: Colors.severityRed },
];

interface TummyLog {
  day_number: number;
  tummy_check?: string | null;
}

interface ScheduleEntry {
  day: number;
  phase: string;
}

interface RetroLogSheetProps {
  retroDay: number | null;
  logs: TummyLog[];
  schedule: ScheduleEntry[];
  petName: string;
  tummyLoading: boolean;
  onLog: (check: TummyCheck, day: number) => void;
  onClose: () => void;
}

export default function RetroLogSheet({
  retroDay,
  logs,
  schedule,
  petName,
  tummyLoading,
  onLog,
  onClose,
}: RetroLogSheetProps) {
  return (
    <Modal
      visible={retroDay != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.sheetContainer}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {retroDay != null && (() => {
            const retroLog = logs.find(l => l.day_number === retroDay);
            const isReadOnly = !!retroLog?.tummy_check;
            const retroEntry = schedule.find(s => s.day === retroDay);

            return (
              <>
                <Text style={styles.sheetTitle}>
                  {isReadOnly ? `Day ${retroDay} — Logged` : `Log Day ${retroDay}`}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {retroEntry ? `${retroEntry.phase}` : ''}
                </Text>
                <Text style={styles.sheetQuestion}>
                  {isReadOnly
                    ? `${petName}'s digestion on Day ${retroDay}:`
                    : `How was ${petName}'s digestion on Day ${retroDay}?`}
                </Text>

                <View style={styles.sheetPills}>
                  {TUMMY_OPTIONS.map(opt => {
                    const isSelected = retroLog?.tummy_check === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.tummyPill,
                          isSelected && {
                            backgroundColor: `${opt.color}25`,
                            borderColor: opt.color,
                          },
                        ]}
                        onPress={() => {
                          if (!isReadOnly) onLog(opt.key, retroDay);
                        }}
                        disabled={isReadOnly || tummyLoading}
                        activeOpacity={isReadOnly ? 1 : 0.7}
                      >
                        <Ionicons name={opt.icon} size={18} color={isSelected ? opt.color : Colors.textSecondary} />
                        <Text style={[styles.tummyPillText, isSelected && { color: opt.color }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isReadOnly && (
                  <Text style={styles.sheetReadOnlyHint}>
                    Tap a missed day to log retroactively
                  </Text>
                )}
              </>
            );
          })()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fix 8: Bottom sheet — canonical spec from .agent/design.md:307-365
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  sheetQuestion: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  sheetPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sheetReadOnlyHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  tummyPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tummyPillText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
});
