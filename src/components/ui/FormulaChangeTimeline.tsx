// Kiba — Formula Change Timeline
// Surfaces formula_change_log (append-only JSONB) as product history.
// D-084: No emoji. Ionicons only. Collapsed by default.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface FormulaChange {
  detected_at: string;
  old_ingredients_preview: string;
  new_ingredients_preview: string;
}

interface FormulaChangeTimelineProps {
  changes: FormulaChange[];
  currentScore: number;
}

// ─── Helpers ────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────

export function FormulaChangeTimeline({
  changes,
}: FormulaChangeTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  if (!changes || changes.length === 0) return null;

  // Newest first
  const sorted = [...changes].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
  );

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="time-outline"
          size={20}
          color={Colors.textSecondary}
        />
        <Text style={styles.title}>Formula History</Text>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={16}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>

      {!expanded && (
        <Text style={styles.collapsedSummary}>
          Reformulated {sorted.length} time{sorted.length !== 1 ? 's' : ''}
        </Text>
      )}

      {expanded && (
        <View style={styles.timeline}>
          <Text style={styles.summaryText}>
            This product has been reformulated {sorted.length} time
            {sorted.length !== 1 ? 's' : ''}.
          </Text>

          {sorted.map((change, index) => (
            <View key={change.detected_at} style={styles.entryRow}>
              {/* Timeline dot + connector */}
              <View style={styles.dotColumn}>
                <View style={styles.dot} />
                {index < sorted.length - 1 && <View style={styles.connector} />}
              </View>

              {/* Change detail */}
              <View style={styles.entryContent}>
                <Text style={styles.entryDate}>
                  {formatDate(change.detected_at)} — Ingredients changed
                </Text>
                <Text style={styles.previewLabel}>
                  Previous:{' '}
                  <Text style={styles.previewText}>
                    &ldquo;{change.old_ingredients_preview}&rdquo;
                  </Text>
                </Text>
                <Text style={styles.previewLabel}>
                  Current:{' '}
                  <Text style={styles.previewText}>
                    &ldquo;{change.new_ingredients_preview}&rdquo;
                  </Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  collapsedSummary: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: 6,
    marginLeft: 28,
  },
  timeline: {
    marginTop: Spacing.sm,
  },
  summaryText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  dotColumn: {
    width: 20,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.hairlineBorder,
    marginTop: 4,
  },
  entryContent: {
    flex: 1,
    paddingLeft: 8,
  },
  entryDate: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: 2,
  },
  previewText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
