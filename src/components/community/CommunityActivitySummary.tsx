// Kiba — M9 Community CommunityActivitySummary (Task 28)
// Renders the "Community Activity" tab body on SafetyFlagsScreen:
//   - total reports submitted in the past 7 days
//   - per-reason horizontal bars (no chart library — bar widths via View %)
//   - "last 7 days" footnote
//
// Pure presentation. Empty data is delegated to the parent screen so the
// header copy can stay consistent.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import {
  REASON_LABELS,
  DEFAULT_REASON_ORDER,
} from '../../utils/safetyFlagLabels';
import type { CommunityActivityCount, ScoreFlagReason } from '../../types/scoreFlag';

// ─── Helpers ────────────────────────────────────────────

interface BarRow {
  reason: ScoreFlagReason;
  count: number;
}

/**
 * Merge server counts with the canonical reason order so missing reasons drop
 * to 0 and the bar list always renders in the same order.
 */
export function buildBars(counts: CommunityActivityCount[]): BarRow[] {
  const map = new Map<ScoreFlagReason, number>();
  for (const c of counts) {
    map.set(c.reason, (map.get(c.reason) ?? 0) + c.count);
  }
  return DEFAULT_REASON_ORDER.map((reason) => ({
    reason,
    count: map.get(reason) ?? 0,
  }));
}

// ─── Props ──────────────────────────────────────────────

interface CommunityActivitySummaryProps {
  counts: CommunityActivityCount[];
}

// ─── Component ──────────────────────────────────────────

export function CommunityActivitySummary({ counts }: CommunityActivitySummaryProps) {
  const bars = useMemo(() => buildBars(counts), [counts]);
  const total = useMemo(() => bars.reduce((sum, b) => sum + b.count, 0), [bars]);
  const max = useMemo(
    () => bars.reduce((m, b) => (b.count > m ? b.count : m), 0),
    [bars],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Community Activity Summary</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalNumber}>{total}</Text>
        <Text style={styles.totalLabel}>
          {total === 1 ? 'report submitted this week' : 'reports submitted this week'}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, styles.breakdownLabel]}>
        Breakdown by reason
      </Text>

      <View style={styles.barList}>
        {bars.map((bar) => {
          // 0 counts get a hairline indicator so the row reads as "tracked but
          // empty" rather than "missing." Cap at 100% width.
          const widthPct = max === 0 ? 0 : Math.max(2, (bar.count / max) * 100);
          return (
            <View
              key={bar.reason}
              style={styles.barRow}
              accessibilityRole="text"
              accessibilityLabel={`${REASON_LABELS[bar.reason]}: ${bar.count}`}
            >
              <View style={styles.barTextRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {REASON_LABELS[bar.reason]}
                </Text>
                <Text style={styles.barCount}>{bar.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: bar.count > 0 ? Colors.accent : Colors.chipSurface,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.footnote}>Submitted today, last 7 days</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  breakdownLabel: {
    marginTop: Spacing.lg,
  },
  totalCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    alignItems: 'center',
  },
  totalNumber: {
    fontSize: FontSizes.title,
    fontWeight: '800',
    color: Colors.accent,
  },
  totalLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  barList: {
    gap: Spacing.md,
  },
  barRow: {
    gap: 6,
  },
  barTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  barLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  barCount: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },
  barTrack: {
    height: 8,
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  footnote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
