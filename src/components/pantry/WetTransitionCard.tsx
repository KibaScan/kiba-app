// Kiba — Wet Transition Card (V2-3)
// Lightweight persistent card on PantryScreen during discrete food transitions.
// Shows current phase + day counter + next-phase preview. Dismissible.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { WetTransitionRecord } from '../../utils/wetTransitionHelpers';
import { getCurrentWetPhase, getWetTransitionTotalDays } from '../../utils/wetTransitionHelpers';

interface Props {
  record: WetTransitionRecord;
  onDismiss: () => void;
}

export function WetTransitionCard({ record, onDismiss }: Props) {
  const totalDays = getWetTransitionTotalDays(record.schedule);
  const current = getCurrentWetPhase(record.startedAt, record.schedule);

  if (!current) return null;

  // Next phase preview — find the next non-current phase with days > 0, or final
  const nextPhase = record.schedule[current.phaseIndex + 1];
  const nextDayStart = current.overallDay + (current.phase.days - current.dayInPhase + 1);
  const isLastTransitionPhase = !nextPhase || nextPhase.days === 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="restaurant-outline" size={18} color={Colors.severityAmber} style={styles.icon} />
        <Text style={styles.title}>Meal Transition Guide</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-outline" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.dayCounter}>Day {current.overallDay} of {totalDays}</Text>
      <Text style={styles.phaseLabel}>{current.phase.label}</Text>
      {isLastTransitionPhase ? (
        <Text style={styles.nextPhase}>Next: 100% new diet from Day {totalDays + 1}</Text>
      ) : (
        <Text style={styles.nextPhase}>Next: {nextPhase.label} from Day {nextDayStart}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.severityAmber,
    flex: 1,
  },
  dayCounter: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 2,
  },
  phaseLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 2,
  },
  nextPhase: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
