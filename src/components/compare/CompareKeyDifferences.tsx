// CompareKeyDifferences — Rendered list of key differences between two products.
// Pure presentational component. Props provided by CompareScreen (state stays in parent).

import React, { type ComponentProps } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { KeyDifference } from '../../utils/keyDifferences';

// ─── Constants ────────────────────────────────────────────

const KEY_DIFF_ICONS: Record<KeyDifference['icon'], ComponentProps<typeof Ionicons>['name']> = {
  warning: 'warning',
  checkmark: 'checkmark-circle',
  'arrow-up': 'arrow-up-circle',
  'arrow-down': 'arrow-down-circle',
};

const KEY_DIFF_COLORS: Record<KeyDifference['severity'], string> = {
  negative: Colors.severityRed,
  positive: Colors.severityGreen,
  neutral: Colors.textSecondary,
};

// ─── Component ────────────────────────────────────────────

type Props = {
  differences: KeyDifference[];
};

export function CompareKeyDifferences({ differences }: Props) {
  if (differences.length === 0) return null;

  return (
    <View style={ss.section}>
      <Text style={ss.sectionTitle}>Key Differences</Text>
      {differences.map((diff) => (
        <View key={diff.id} style={ss.diffCard}>
          <Ionicons
            name={KEY_DIFF_ICONS[diff.icon]}
            size={20}
            color={KEY_DIFF_COLORS[diff.severity]}
            style={ss.diffIcon}
          />
          <Text style={ss.diffText}>
            <Text style={ss.diffSubject}>{diff.subject}</Text>
            {' '}{diff.verb}{' '}
            <Text style={ss.diffClaim}>{diff.claim}</Text>
            {diff.trailing ? ` ${diff.trailing}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  // Key differences — sit inside the section card, so lift slightly against cardSurface
  diffCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  diffIcon: {
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  diffText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  diffSubject: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  diffClaim: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});
