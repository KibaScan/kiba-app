// Kiba — Flavor Deception Card (D-133)
// Educational card when product name protein differs from primary ingredient.
// D-095: Factual language only. No "misleading," "deceptive," "dishonest."
// D-084: No emoji. Ionicons only.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface FlavorDeceptionCardProps {
  namedProtein: string;
  actualPrimaryProtein: string;
  actualPrimaryPosition: number;
  namedProteinPosition: number | null;
  variant: 'buried' | 'absent';
}

// ─── Component ──────────────────────────────────────────

export function FlavorDeceptionCard({
  namedProtein,
  actualPrimaryProtein,
  actualPrimaryPosition,
  namedProteinPosition,
  variant,
}: FlavorDeceptionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name="alert-circle-outline"
          size={20}
          color={Colors.severityAmber}
        />
        <Text style={styles.title}>Label vs. Ingredients</Text>
      </View>

      {variant === 'buried' ? (
        <>
          <Text style={styles.body}>
            This product highlights {namedProtein} in its name, but the
            ingredient list tells a different story:
          </Text>
          <View style={styles.bulletList}>
            <BulletRow
              text={`${actualPrimaryProtein} — position ${actualPrimaryPosition} (primary ingredient)`}
            />
            {namedProteinPosition != null && (
              <BulletRow
                text={`${namedProtein} — position ${namedProteinPosition}`}
              />
            )}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            This product highlights {namedProtein} in its name, but{' '}
            {namedProtein.toLowerCase()} does not appear in the ingredient list.
          </Text>
          <Text style={styles.body}>
            The primary protein source is {actualPrimaryProtein} at position{' '}
            {actualPrimaryPosition}.
          </Text>
        </>
      )}

      <Text style={styles.footnote}>
        AAFCO naming rules allow this when "flavor" is implied. The name
        reflects taste, not composition.
      </Text>
    </View>
  );
}

// ─── Bullet Row ─────────────────────────────────────────

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons
        name="chevron-forward-outline"
        size={12}
        color={Colors.textTertiary}
        style={styles.bulletIcon}
      />
      <Text style={styles.bulletText}>{text}</Text>
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
    borderLeftWidth: 4,
    borderLeftColor: Colors.severityAmber,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  body: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  bulletList: {
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletIcon: {
    marginTop: 3,
    marginRight: 6,
  },
  bulletText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  footnote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
});
