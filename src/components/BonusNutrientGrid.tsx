// Kiba — Bonus Nutrient Grid
// Small indicator cards for supplemental nutrients that differentiate products.
// Positive differentiation only — no penalty for absent nutrients.
// Zero emoji (D-084). Factual language (D-095).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, FontSizes, Spacing } from '../utils/constants';

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
}

// ─── Card Data ──────────────────────────────────────────

interface CardData {
  key: string;
  label: string;
  present: boolean;
  displayValue: string;
  note: string | null;
}

function buildCards(
  nutrients: BonusNutrientGridProps['nutrients'],
  species: 'dog' | 'cat',
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
      note: null,
    },
    {
      key: 'omega3',
      label: 'Omega-3',
      present: nutrients.omega3_pct != null && nutrients.omega3_pct > 0,
      displayValue: nutrients.omega3_pct != null && nutrients.omega3_pct > 0
        ? `${fmt(nutrients.omega3_pct)}%`
        : 'Not listed',
      note: null,
    },
    {
      key: 'omega6',
      label: 'Omega-6',
      present: nutrients.omega6_pct != null && nutrients.omega6_pct > 0,
      displayValue: nutrients.omega6_pct != null && nutrients.omega6_pct > 0
        ? `${fmt(nutrients.omega6_pct)}%`
        : 'Not listed',
      note: null,
    },
    {
      key: 'taurine',
      label: 'Taurine',
      present: nutrients.taurine_pct != null && nutrients.taurine_pct > 0,
      displayValue: nutrients.taurine_pct != null && nutrients.taurine_pct > 0
        ? `${fmt(nutrients.taurine_pct)}%`
        : 'Not listed',
      note: species === 'cat' ? 'Essential for cats' : null,
    },
    {
      key: 'lcarnitine',
      label: 'L-Carnitine',
      present: nutrients.lcarnitine,
      displayValue: nutrients.lcarnitine ? 'Present' : 'Not listed',
      note: species === 'dog' && nutrients.lcarnitine
        ? 'Associated with heart health in veterinary research'
        : null,
    },
    {
      key: 'zinc',
      label: 'Zinc',
      present: nutrients.zinc,
      displayValue: nutrients.zinc ? 'Present' : 'Not listed',
      note: null,
    },
    {
      key: 'probiotics',
      label: 'Probiotics',
      present: nutrients.probiotics,
      displayValue: nutrients.probiotics ? 'Present' : 'Not listed',
      note: null,
    },
    {
      key: 'glucosamine',
      label: 'Glucosamine',
      present: nutrients.glucosamine,
      displayValue: nutrients.glucosamine ? 'Present' : 'Not listed',
      note: null,
    },
  ];
}

// ─── Card Component ─────────────────────────────────────

function NutrientCard({ card }: { card: CardData }) {
  return (
    <View style={cardStyles.container}>
      <Text style={cardStyles.label} numberOfLines={1}>{card.label}</Text>
      <View style={cardStyles.statusRow}>
        <View
          style={[
            cardStyles.dot,
            { backgroundColor: card.present ? Colors.severityGreen : Colors.textTertiary },
          ]}
        />
        <Text
          style={[
            cardStyles.value,
            { color: card.present ? Colors.textPrimary : Colors.textTertiary },
          ]}
          numberOfLines={1}
        >
          {card.displayValue}
        </Text>
      </View>
      {card.note && (
        <Text style={cardStyles.note} numberOfLines={2}>{card.note}</Text>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
  },
  label: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  value: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    flex: 1,
  },
  note: {
    fontSize: 10,
    color: Colors.accent,
    marginTop: 3,
    lineHeight: 13,
  },
});

// ─── Main Component ─────────────────────────────────────

export function BonusNutrientGrid({ nutrients, species }: BonusNutrientGridProps) {
  // Don't render if nothing to show
  const hasAny =
    (nutrients.dha_pct != null && nutrients.dha_pct > 0) ||
    (nutrients.omega3_pct != null && nutrients.omega3_pct > 0) ||
    (nutrients.omega6_pct != null && nutrients.omega6_pct > 0) ||
    (nutrients.taurine_pct != null && nutrients.taurine_pct > 0) ||
    nutrients.lcarnitine ||
    nutrients.zinc ||
    nutrients.probiotics ||
    nutrients.glucosamine;

  if (!hasAny) return null;

  const cards = buildCards(nutrients, species);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Bonus Nutrients</Text>
      <View style={styles.grid}>
        {cards.map((card) => (
          <NutrientCard key={card.key} card={card} />
        ))}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
