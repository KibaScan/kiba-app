// Kiba — Bonus Nutrient Grid
// Present-first layout for supplemental nutrients that differentiate products.
// Positive differentiation only — no penalty for absent nutrients.
// Zero emoji (D-084). Factual language (D-095).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface BonusNutrientGridProps {
  nutrients: {
    dha_pct: number | null;
    omega3_pct: number | null;
    omega6_pct: number | null;
    taurine_pct: number | null;
    lcarnitine: boolean;
    zinc: boolean;
    probiotics: boolean;
    glucosamine: boolean;
  };
  species: 'dog' | 'cat';
  petName: string;
  /** Keys of nutrients to exclude from display */
  excludeKeys?: Set<string>;
}

// ─── Card Data ──────────────────────────────────────────

interface CardData {
  key: string;
  label: string;
  present: boolean;
  displayValue: string;
}

function buildCards(
  nutrients: BonusNutrientGridProps['nutrients'],
): CardData[] {
  const fmt = (v: number) => (v < 0.01 ? v.toFixed(3) : v.toFixed(2));

  return [
    {
      key: 'dha',
      label: 'DHA',
      present: nutrients.dha_pct != null && nutrients.dha_pct > 0,
      displayValue: nutrients.dha_pct != null && nutrients.dha_pct > 0
        ? `${fmt(nutrients.dha_pct)}%`
        : 'Not listed',
    },
    {
      key: 'omega3',
      label: 'Omega-3',
      present: nutrients.omega3_pct != null && nutrients.omega3_pct > 0,
      displayValue: nutrients.omega3_pct != null && nutrients.omega3_pct > 0
        ? `${fmt(nutrients.omega3_pct)}%`
        : 'Not listed',
    },
    {
      key: 'omega6',
      label: 'Omega-6',
      present: nutrients.omega6_pct != null && nutrients.omega6_pct > 0,
      displayValue: nutrients.omega6_pct != null && nutrients.omega6_pct > 0
        ? `${fmt(nutrients.omega6_pct)}%`
        : 'Not listed',
    },
    {
      key: 'taurine',
      label: 'Taurine',
      present: nutrients.taurine_pct != null && nutrients.taurine_pct > 0,
      displayValue: nutrients.taurine_pct != null && nutrients.taurine_pct > 0
        ? `${fmt(nutrients.taurine_pct)}%`
        : 'Not listed',
    },
    {
      key: 'lcarnitine',
      label: 'L-Carnitine',
      present: nutrients.lcarnitine,
      displayValue: nutrients.lcarnitine ? 'Present' : 'Not listed',
    },
    {
      key: 'zinc',
      label: 'Zinc',
      present: nutrients.zinc,
      displayValue: nutrients.zinc ? 'Present' : 'Not listed',
    },
    {
      key: 'probiotics',
      label: 'Probiotics',
      present: nutrients.probiotics,
      displayValue: nutrients.probiotics ? 'Present' : 'Not listed',
    },
    {
      key: 'glucosamine',
      label: 'Glucosamine',
      present: nutrients.glucosamine,
      displayValue: nutrients.glucosamine ? 'Present' : 'Not listed',
    },
  ];
}

// ─── Main Component ─────────────────────────────────────

export function BonusNutrientGrid({ nutrients, excludeKeys }: BonusNutrientGridProps) {
  const allCards = buildCards(nutrients);
  const cards = excludeKeys
    ? allCards.filter((c) => !excludeKeys.has(c.key))
    : allCards;

  if (cards.length === 0) return null;

  const present = cards.filter(c => c.present);
  const absent = cards.filter(c => !c.present);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Bonus Nutrients</Text>

      {present.length === 0 ? (
        <Text style={styles.absentText}>No bonus nutrients listed</Text>
      ) : (
        <>
          {present.map(card => (
            <View key={card.key} style={styles.presentRow}>
              <View style={styles.presentDot} />
              <Text style={styles.presentName}>{card.label}</Text>
              <Text style={styles.presentValue}> {'\u00B7'} {card.displayValue}</Text>
            </View>
          ))}
          {absent.length > 0 && (
            <Text style={styles.absentText}>
              {absent.map(c => c.label).join(', ')} not listed.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  presentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  presentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SEVERITY_COLORS.good,
    marginRight: 8,
  },
  presentName: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  presentValue: {
    fontSize: 14,
    color: SEVERITY_COLORS.good,
  },
  absentText: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
    marginTop: 8,
  },
});
