// Kiba — M9 Community SafetyFlagRow (Task 28)
// One row per submission inside SafetyFlagsScreen "My Flags" tab.
// Renders reason label (large), color-coded status chip, relative submission
// date, optional truncated detail, and an admin_note callout when admins have
// added one. Pure presentation — parent owns data fetching.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import {
  REASON_LABELS,
  STATUS_LABELS,
  STATUS_CHIP_COLORS,
} from '../../utils/safetyFlagLabels';
import type { ScoreFlag } from '../../types/scoreFlag';

// ─── Helpers ────────────────────────────────────────────

/**
 * Compact relative date — "2h ago", "3d ago", "Apr 5". Pure so it can be unit
 * tested via component render assertions if needed; no allocation/perf concern
 * for at most ~hundreds of rows in My Flags.
 */
export function formatFlagRelativeDate(isoStr: string, now: Date = new Date()): string {
  const created = new Date(isoStr);
  const deltaMs = now.getTime() - created.getTime();
  const seconds = Math.floor(deltaMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[created.getMonth()];
  return `${m} ${created.getDate()}`;
}

// ─── Props ──────────────────────────────────────────────

interface SafetyFlagRowProps {
  flag: ScoreFlag;
}

// ─── Component ──────────────────────────────────────────

export function SafetyFlagRow({ flag }: SafetyFlagRowProps) {
  const reasonLabel = REASON_LABELS[flag.reason];
  const statusLabel = STATUS_LABELS[flag.status];
  const statusColors = STATUS_CHIP_COLORS[flag.status];
  const dateLabel = formatFlagRelativeDate(flag.created_at);

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`${reasonLabel}, ${statusLabel}, submitted ${dateLabel}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.reason} numberOfLines={2}>
          {reasonLabel}
        </Text>
        <View
          style={[styles.statusChip, { backgroundColor: statusColors.background }]}
        >
          <Text
            style={[styles.statusChipText, { color: statusColors.foreground }]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.dateLabel}>{dateLabel}</Text>

      {flag.detail && (
        <Text style={styles.detail} numberOfLines={2}>
          {flag.detail}
        </Text>
      )}

      {flag.admin_note && (
        <View style={styles.adminNote}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={Colors.accent}
            style={styles.adminNoteIcon}
          />
          <View style={styles.adminNoteBody}>
            <Text style={styles.adminNoteLabel}>Note from Kiba</Text>
            <Text style={styles.adminNoteText}>{flag.admin_note}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  reason: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  detail: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 19,
  },
  adminNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.accentTint,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  adminNoteIcon: {
    marginTop: 2,
  },
  adminNoteBody: {
    flex: 1,
  },
  adminNoteLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  adminNoteText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    lineHeight: 19,
  },
});
