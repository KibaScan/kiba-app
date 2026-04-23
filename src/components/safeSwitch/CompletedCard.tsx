// Kiba — CompletedCard
// Outcome-aware completion card (Phase A).
// D-084: Zero emoji. D-095: UPVM compliant.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { SwitchOutcome } from '../../types/safeSwitch';

// ─── Outcome tone helpers ────────────────────────────────

type OutcomeTone = 'good' | 'neutral' | 'caution';

function outcomeToneColor(tone: OutcomeTone): string {
  if (tone === 'good') return Colors.severityGreen;
  if (tone === 'caution') return Colors.severityAmber;
  return Colors.textPrimary;
}

function outcomeToneIcon(tone: OutcomeTone): keyof typeof Ionicons.glyphMap {
  return tone === 'caution' ? 'alert-circle' : 'checkmark-circle';
}

interface OutcomeStatItem {
  label: string;
  count: number;
  dot: string;
}

function buildOutcomeStatItems(outcome: SwitchOutcome): OutcomeStatItem[] {
  const items: OutcomeStatItem[] = [];
  if (outcome.perfectCount > 0) {
    items.push({ label: 'Perfect', count: outcome.perfectCount, dot: Colors.severityGreen });
  }
  if (outcome.softStoolCount > 0) {
    items.push({ label: 'Soft Stool', count: outcome.softStoolCount, dot: Colors.severityAmber });
  }
  if (outcome.upsetCount > 0) {
    items.push({ label: 'Upset', count: outcome.upsetCount, dot: Colors.severityRed });
  }
  if (outcome.missedDays > 0) {
    items.push({ label: 'Missed', count: outcome.missedDays, dot: Colors.textTertiary });
  }
  return items;
}

// ─── Props ───────────────────────────────────────────────

interface OutcomeMessage {
  tone: OutcomeTone;
  title: string;
  body: string;
}

interface CompletedCardProps {
  outcome: SwitchOutcome;
  outcomeMessage: OutcomeMessage;
  onBack: () => void;
}

// ─── Component ───────────────────────────────────────────

export default function CompletedCard({ outcome, outcomeMessage, onBack }: CompletedCardProps) {
  const outcomeStats = buildOutcomeStatItems(outcome);

  return (
    <View style={styles.completedCard}>
      <Ionicons
        name={outcomeToneIcon(outcomeMessage.tone)}
        size={48}
        color={outcomeToneColor(outcomeMessage.tone)}
      />
      <Text style={[styles.completedTitle, { color: outcomeToneColor(outcomeMessage.tone) }]}>
        {outcomeMessage.title}
      </Text>
      <Text style={styles.completedBody}>{outcomeMessage.body}</Text>

      {/* Stat strip — counts by category, zero counts skipped */}
      {outcomeStats.length > 0 && (
        <View style={styles.completedStats}>
          {outcomeStats.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <Text style={styles.completedStatSep}>·</Text>}
              <View style={styles.completedStatItem}>
                <View style={[styles.completedStatDot, { backgroundColor: stat.dot }]} />
                <Text style={styles.completedStatText}>{stat.count} {stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      <Text style={styles.restockNudge}>
        Open a new bag? Tap Restock in your Pantry to start tracking.
      </Text>

      <TouchableOpacity
        style={styles.completeButton}
        onPress={onBack}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.completeButtonText}>Back to Pantry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  completedCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: Spacing.lg,
  },
  completedTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.severityGreen },
  completedBody: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  completedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  completedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completedStatText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  completedStatSep: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    paddingHorizontal: 2,
  },
  restockNudge: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  completeButtonText: { fontSize: FontSizes.lg, fontWeight: '700', color: '#FFFFFF' },
});
