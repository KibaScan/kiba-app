// Kiba — M9 Community KibaIndexHighlightsTile (Task 30)
// One of four tiles in the DiscoveryGrid 2x2. Self-fetches a mini preview
// for the active pet's species ("Top for {species}: {brand}"). When no
// active pet is set, renders an "Add a pet" affordance instead.
//
// MVP DECISION: tap is intentionally a no-op — there is no
// `KibaIndexHighlights` route on `CommunityStackParamList`. Render as a
// plain View (not TouchableOpacity) so users don't see false-affordance.
// Add navigation when a dedicated KibaIndexHighlights screen lands.
//
// D-084: Ionicons only. D-095: clinical copy, no medical claims.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../../utils/constants';
import {
  fetchKibaIndexHighlights,
  type KibaIndexHighlight,
} from '../../../services/communityService';
import { useActivePetStore } from '../../../stores/useActivePetStore';

const SPECIES_LABEL: Record<'dog' | 'cat', string> = {
  dog: 'dogs',
  cat: 'cats',
};

interface Props {
  /** Optional override for tests / Storybook to skip the network fetch. */
  initialHighlights?: KibaIndexHighlight[] | null;
}

export function KibaIndexHighlightsTile({ initialHighlights = null }: Props) {
  const pets = useActivePetStore((s) => s.pets);
  const activePetId = useActivePetStore((s) => s.activePetId);
  const activePet = pets.find((p) => p.id === activePetId) ?? null;
  const species = activePet?.species ?? null;

  const [highlights, setHighlights] = useState<KibaIndexHighlight[]>(
    initialHighlights ?? [],
  );
  const [resolved, setResolved] = useState<boolean>(initialHighlights !== null);

  useEffect(() => {
    if (initialHighlights !== null) return;
    if (!species) {
      setHighlights([]);
      setResolved(true);
      return;
    }

    let cancelled = false;
    setResolved(false);
    fetchKibaIndexHighlights(species)
      .then((rows) => {
        if (cancelled) return;
        setHighlights(rows);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHighlights([]);
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [species, initialHighlights]);

  // No active pet — invite to add one (still renders the tile so the grid
  // stays balanced).
  if (!species) {
    return (
      <View
        style={styles.tile}
        accessibilityRole="text"
        accessibilityLabel="Kiba Index Highlights. Add a pet to see top picks."
      >
        <View style={styles.iconWrap}>
          <Ionicons name="trophy-outline" size={20} color={Colors.accent} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          Kiba Index Highlights
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          Add a pet to see top picks
        </Text>
      </View>
    );
  }

  const speciesLabel = SPECIES_LABEL[species];
  const topPick = highlights[0] ?? null;

  // Service returns picky_eaters first; fall back to a generic prompt when
  // the index is sparse for this species.
  const previewLine = topPick
    ? `Top for ${speciesLabel}: ${topPick.brand}`
    : resolved
      ? `No picks yet for ${speciesLabel}`
      : `Loading top picks for ${speciesLabel}…`;

  return (
    <View
      style={styles.tile}
      accessibilityRole="text"
      accessibilityLabel={`Kiba Index Highlights. ${previewLine}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="trophy-outline" size={20} color={Colors.accent} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        Kiba Index Highlights
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        {previewLine}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
});
