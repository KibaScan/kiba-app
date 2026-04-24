// CompareOtherPets — Expandable section showing scores for the user's other same-species pets.
// Pure presentational component. Props provided by CompareScreen (state stays in parent).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getScoreColor } from '../scoring/ScoreRing';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { Pet } from '../../types/pet';

// ─── Component ────────────────────────────────────────────

type Props = {
  otherPets: Pet[];
  scoresMap: Map<string, { scoreA: number; scoreB: number }>;
  expanded: boolean;
  loading: boolean;
  onToggle: () => void;
};

export function CompareOtherPets({ otherPets, scoresMap, expanded, loading, onToggle }: Props) {
  if (otherPets.length === 0) return null;

  return (
    <View style={ss.section}>
      <TouchableOpacity
        style={ss.sectionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={ss.sectionTitle}>Your Other Pets</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        loading ? (
          <View style={ss.otherPetsLoading}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={ss.otherPetsLoadingText}>Scoring for your other pets…</Text>
          </View>
        ) : (
          otherPets.map(op => {
            const scores = scoresMap.get(op.id);
            if (!scores) return null;
            const highlightA = scores.scoreA > scores.scoreB;
            const highlightB = scores.scoreB > scores.scoreA;
            return (
              <View key={op.id} style={ss.otherPetRow}>
                <View style={ss.otherPetScoreCell}>
                  <View style={[ss.otherPetDot, { backgroundColor: getScoreColor(scores.scoreA, false) }]} />
                  <Text
                    style={[ss.otherPetScore, highlightA && { color: Colors.accent }]}
                    accessibilityLabel={`${Math.round(scores.scoreA)}% match for ${op.name}`}
                  >
                    {Math.round(scores.scoreA)}%
                  </Text>
                </View>
                <Text style={ss.otherPetName} numberOfLines={1}>{op.name}</Text>
                <View style={ss.otherPetScoreCell}>
                  <View style={[ss.otherPetDot, { backgroundColor: getScoreColor(scores.scoreB, false) }]} />
                  <Text
                    style={[ss.otherPetScore, highlightB && { color: Colors.accent }]}
                    accessibilityLabel={`${Math.round(scores.scoreB)}% match for ${op.name}`}
                  >
                    {Math.round(scores.scoreB)}%
                  </Text>
                </View>
              </View>
            );
          })
        )
      )}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  otherPetsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  otherPetsLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  otherPetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  otherPetScoreCell: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  otherPetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  otherPetScore: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otherPetName: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
