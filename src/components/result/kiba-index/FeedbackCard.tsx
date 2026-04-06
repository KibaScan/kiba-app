import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import { VoteBarChart } from './VoteBarChart';

export type FeedbackOption = {
  id: string; // The db value e.g., 'loved', 'picky', 'refused'
  label: string; // The display string e.g., 'Cleared the Bowl'
};

interface FeedbackCardProps {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  totalVotes: number;
  options: FeedbackOption[];
  stats: Record<string, number>;
  userSelectedOptionId: string | null;
  onVote: (optionId: string) => void;
  isLoading?: boolean;
  petName: string;       // e.g. "Buster" or "your dog"
  speciesLabel: string;  // e.g. "dogs" or "cats"
  promptLabel: string;   // e.g. "How did Buster like it?" or "How's digestion been?"
}

const STATS_THRESHOLD = 5;

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  title,
  iconName,
  color,
  totalVotes,
  options,
  stats,
  userSelectedOptionId,
  onVote,
  isLoading = false,
  petName,
  speciesLabel,
  promptLabel,
}) => {
  const isVoted = userSelectedOptionId !== null;
  const showStats = totalVotes >= STATS_THRESHOLD;

  const handleSelect = (id: string) => {
    if (isVoted || isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote(id);
  };

  const votedLabel = isVoted
    ? options.find((o) => o.id === userSelectedOptionId)?.label ?? ''
    : '';

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <Ionicons name={iconName} size={20} color={color} style={styles.icon} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* ── Bar chart (always visible when threshold met) ── */}
      {showStats && (
        <View style={styles.statsBlock}>
          <VoteBarChart
            totalVotes={totalVotes}
            options={options.map((o) => ({
              label: o.label,
              count: stats[o.id] || 0,
              color,
            }))}
          />
          <Text style={styles.footerText}>
            Based on {totalVotes} {speciesLabel}
            {isVoted ? ` (incl. ${petName})` : ''}
          </Text>
        </View>
      )}

      {/* ── Below-threshold teaser ── */}
      {!showStats && totalVotes > 0 && (
        <Text style={styles.thresholdText}>
          {totalVotes} {speciesLabel} shared so far. Community stats unlock at {STATS_THRESHOLD} reviews.
        </Text>
      )}

      {/* ── Voted confirmation ── */}
      {isVoted && (
        <View style={styles.votedRow}>
          <Ionicons name="checkmark-circle" size={16} color={color} />
          <Text style={[styles.votedText, { color }]}>
            You said: {votedLabel}
          </Text>
        </View>
      )}

      {/* ── Voting radios (only if not yet voted) ── */}
      {!isVoted && (
        <>
          {showStats && <View style={styles.divider} />}
          <Text style={styles.promptText}>
            {promptLabel}
          </Text>
          {options.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={styles.radioRow}
              onPress={() => handleSelect(o.id)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, { borderColor: color }]} />
              <Text style={styles.radioLabel}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* ── Cold-start nudge ── */}
      {totalVotes === 0 && !isVoted && (
        <Text style={styles.coldStartText}>
          No {speciesLabel} have reviewed this product yet. Be the first to share {petName}'s experience!
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontFamily: 'Inter-Medium',
  },

  // ── Stats block ──
  statsBlock: {
    marginBottom: Spacing.sm,
  },
  footerText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontFamily: 'Inter-Regular',
    marginTop: Spacing.sm,
  },
  thresholdText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontFamily: 'Inter-Regular',
    marginBottom: Spacing.md,
  },

  // ── Divider between stats and voting ──
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.md,
  },

  // ── Voting rows ──
  promptText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontFamily: 'Inter-Regular',
    marginBottom: Spacing.md,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  radioLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontFamily: 'Inter-Regular',
  },

  // ── Voted confirmation ──
  votedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  votedText: {
    fontSize: FontSizes.sm,
    fontFamily: 'Inter-Medium',
  },

  // ── Cold start ──
  coldStartText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontFamily: 'Inter-Regular',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
