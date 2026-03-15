// Kiba — DCM Advisory Card
// Educational card for D-137 DCM pulse load advisory (Layer 2).
// Shows which rules fired with mechanism-cited explanations.
// D-095: Factual language only. "May," "associated with," "different profile."
// D-084: No emoji. Ionicons only. D-094: Pet name in score impact line.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { DcmResult } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface DcmAdvisoryCardProps {
  dcmResult: DcmResult;
  dcmPenalty: number;
  petName: string;
}

// ─── Helpers ────────────────────────────────────────────

/** Convert canonical_name to display form: "dried_peas" → "Dried Peas" */
function formatName(canonical: string): string {
  return canonical
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Component ──────────────────────────────────────────

export function DcmAdvisoryCard({
  dcmResult,
  dcmPenalty,
  petName,
}: DcmAdvisoryCardProps) {
  if (!dcmResult.fires) return null;

  const { triggeredRules, hasMitigation, pulseIngredients } = dcmResult;

  // Gather data for each rule section
  const heavyweightPulses = pulseIngredients.filter(p => p.position <= 3);
  const pulsesInTop10 = pulseIngredients.filter(p => p.position <= 10);
  const pulseProteins = pulseIngredients.filter(
    p => p.position <= 10 && p.isPulseProtein,
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name="heart-outline"
          size={20}
          color={Colors.severityRed}
        />
        <Text style={styles.title}>Heart Health Advisory</Text>
      </View>

      {/* Rule 1 — Heavyweight */}
      {triggeredRules.includes('heavyweight') && heavyweightPulses.length > 0 && (
        <View style={styles.ruleSection}>
          {heavyweightPulses.map(p => (
            <Text key={`hw-${p.name}`} style={styles.body}>
              {formatName(p.name)} appears at position {p.position} in the
              ingredient list. Dried pulses listed near the top often outweigh
              meat in the cooked product, as fresh meat contains ~70% water that
              evaporates during processing.
            </Text>
          ))}
        </View>
      )}

      {/* Rule 2 — Density */}
      {triggeredRules.includes('density') && (
        <View style={styles.ruleSection}>
          <Text style={styles.body}>
            This product contains {pulsesInTop10.length} pulse-based ingredients
            in the top 10:{' '}
            {pulsesInTop10
              .map(p => `${formatName(p.name)} (position ${p.position})`)
              .join(', ')}
            . Combined, these pulses may represent a significant portion of the
            total formula.
          </Text>
        </View>
      )}

      {/* Rule 3 — Substitution */}
      {triggeredRules.includes('substitution') && pulseProteins.length > 0 && (
        <View style={styles.ruleSection}>
          {pulseProteins.map(p => (
            <Text key={`sub-${p.name}`} style={styles.body}>
              {formatName(p.name)} is a pulse protein isolate used to increase
              the protein percentage on the label. Plant protein isolates have a
              different amino acid profile than animal proteins.
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.citation}>
        FDA Center for Veterinary Medicine, DCM Investigation (2019, updated
        2024). Research is ongoing and no causal link has been established.
      </Text>

      {/* Mitigation */}
      {hasMitigation ? (
        <View style={styles.mitigationSection}>
          <Text style={styles.mitigationText}>
            This product supplements both taurine and L-carnitine, which support
            the amino acid pathways associated with cardiac function.
          </Text>
        </View>
      ) : (
        <Text style={styles.body}>
          This product does not include both taurine and L-carnitine
          supplementation.
        </Text>
      )}

      <Text style={styles.scoreImpact}>
        Score impact: {'\u2212'}{Math.abs(dcmPenalty)} points for {petName}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.severityRed,
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
  ruleSection: {
    marginBottom: Spacing.xs,
  },
  body: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  citation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  mitigationSection: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityGreen,
    paddingLeft: 10,
    marginBottom: Spacing.sm,
  },
  mitigationText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  scoreImpact: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
