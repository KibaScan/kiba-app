/**
 * BenchmarkBar — shows where a product's score falls relative to the category average.
 * Horizontal gradient bar with a marker for the product score and a line for the category average.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBenchmarkStore, type CategoryAverage } from '../../utils/benchmarkData';
import { Colors, SCORE_COLORS, SEVERITY_COLORS, getScoreColor } from '../../utils/constants';

// ─── Props ────────────────────────────────────────────────

interface BenchmarkBarProps {
  score: number;
  category: 'daily_food' | 'treat';
  targetSpecies: 'dog' | 'cat';
  isGrainFree: boolean;
  isSupplemental?: boolean;
}

// ─── Skeleton ─────────────────────────────────────────────

const SKELETON_HEIGHT = 96;

function BenchmarkSkeleton() {
  return (
    <View style={[styles.container, { height: SKELETON_HEIGHT, justifyContent: 'center' }]}>
      <View style={styles.skeletonLabel} />
      <View style={styles.skeletonBar} />
      <View style={styles.skeletonFooter} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────

/** Minimum peer count to show a meaningful benchmark comparison. */
const MIN_BENCHMARK_PEERS = 30;

/** Which five-tier segment the score falls in (0=poor … 4=excellent). */
function getActiveTier(score: number): number {
  if (score >= 85) return 4;
  if (score >= 70) return 3;
  if (score >= 65) return 2;
  if (score >= 51) return 1;
  return 0;
}

const ACTIVE_SEG = 1.0;
const INACTIVE_SEG = 0.2;
const ACTIVE_TRANS = 0.8;
const INACTIVE_TRANS = 0.15;

export function BenchmarkBar({ score, category, targetSpecies, isGrainFree, isSupplemental = false }: BenchmarkBarProps) {
  const [avg, setAvg] = useState<CategoryAverage | null>(null);
  const [loading, setLoading] = useState(true);
  const getCategoryAverage = useBenchmarkStore((s) => s.getCategoryAverage);

  useEffect(() => {
    // Supplementals have no meaningful benchmark segment — hide immediately
    if (isSupplemental) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const result = await getCategoryAverage(category, targetSpecies, isGrainFree);
      if (!cancelled) {
        setAvg(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [category, targetSpecies, isGrainFree, isSupplemental, getCategoryAverage]);

  if (loading) return <BenchmarkSkeleton />;
  if (!avg || avg.product_count < MIN_BENCHMARK_PEERS) return null;

  const markerPosition = Math.max(0, Math.min(100, score));
  const avgPosition = Math.max(0, Math.min(100, avg.avg_score));
  const markerColor = getScoreColor(score, isSupplemental);
  const tier = getActiveTier(score);
  const so = (t: number) => (tier === t ? ACTIVE_SEG : INACTIVE_SEG);       // segment opacity
  const to = (t: number) => (tier === t ? ACTIVE_TRANS : INACTIVE_TRANS);    // transition opacity (keyed to the higher tier)

  const categoryLabel = category === 'treat' ? 'treats' : 'foods';
  const grainLabel = isGrainFree ? 'grain-free' : 'grain-inclusive';
  const speciesLabel = targetSpecies === 'dog' ? 'dog' : 'cat';
  const diffFromAvg = Math.round(score - avg.avg_score);
  const diffNumber = diffFromAvg > 0
    ? `+${diffFromAvg}`
    : diffFromAvg < 0
      ? `${diffFromAvg}`
      : null;
  const diffColor = diffFromAvg > 0
    ? SEVERITY_COLORS.good
    : diffFromAvg < 0
      ? SEVERITY_COLORS.danger
      : Colors.textTertiary;
  const diffSuffix = diffFromAvg > 0
    ? ' above avg match'
    : diffFromAvg < 0
      ? ' below avg match'
      : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        vs. {avg.product_count.toLocaleString()} {speciesLabel} {grainLabel} {categoryLabel}
      </Text>

      <View style={styles.barContainer}>
        {/* Background gradient segments (D-136 five-tier) — active tier boosted */}
        <View style={styles.barTrack}>
          <View style={[styles.segment, { flex: 51, opacity: so(0), backgroundColor: SCORE_COLORS.daily.poor }]} />
          <View style={[styles.segmentTransition, { flex: 2, opacity: to(1), backgroundColor: '#F27328' }]} />
          <View style={[styles.segment, { flex: 12, opacity: so(1), backgroundColor: SCORE_COLORS.daily.low }]} />
          <View style={[styles.segmentTransition, { flex: 2, opacity: to(2), backgroundColor: '#F8B510' }]} />
          <View style={[styles.segment, { flex: 3, opacity: so(2), backgroundColor: SCORE_COLORS.daily.fair }]} />
          <View style={[styles.segmentTransition, { flex: 2, opacity: to(3), backgroundColor: isSupplemental ? '#70CBDA' : '#B0E8C0' }]} />
          <View style={[styles.segment, { flex: 13, opacity: so(3), backgroundColor: isSupplemental ? SCORE_COLORS.supplemental.good : SCORE_COLORS.daily.good }]} />
          <View style={[styles.segmentTransition, { flex: 2, opacity: to(4), backgroundColor: isSupplemental ? '#1BC6D5' : '#54DA89' }]} />
          <View style={[styles.segment, { flex: 13, opacity: so(4), backgroundColor: isSupplemental ? SCORE_COLORS.supplemental.excellent : SCORE_COLORS.daily.excellent }]} />
        </View>
        {/* Inner highlight for glass effect */}
        <View style={styles.barHighlight} />

        {/* Category average line with glow */}
        <View style={[styles.avgLineGlow, { left: `${avgPosition}%` }]} />
        <View style={[styles.avgLine, { left: `${avgPosition}%` }]} />

        {/* Product score marker with glow */}
        <View style={[styles.markerGlow, { left: `${markerPosition}%`, backgroundColor: markerColor }]} />
        <View style={[styles.marker, { left: `${markerPosition}%`, backgroundColor: markerColor }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>0</Text>
        {diffNumber ? (
          <Text style={styles.diffLabel}>
            <Text style={{ color: diffColor }}>{diffNumber}</Text>
            <Text style={styles.diffSuffix}>{diffSuffix}</Text>
          </Text>
        ) : (
          <Text style={[styles.diffLabel, { color: Colors.textTertiary }]}>At category average</Text>
        )}
        <Text style={styles.footerRight}>100</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  barContainer: {
    height: 28,
    position: 'relative',
    justifyContent: 'center',
  },
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  segmentTransition: {
    height: '100%',
  },
  barHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 5,
    borderRadius: 6,
    backgroundColor: Colors.chipSurface,
  },
  avgLineGlow: {
    position: 'absolute',
    width: 6,
    height: 20,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 3,
    top: 4,
    marginLeft: -3,
  },
  avgLine: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: Colors.textSecondary,
    top: 4,
    marginLeft: -1,
    borderRadius: 1,
  },
  markerGlow: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.3,
    top: 4,
    marginLeft: -10,
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: Colors.textPrimary,
    top: 7,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  footerLeft: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffSuffix: {
    fontWeight: '400',
    color: Colors.textTertiary,
  },
  footerRight: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  // Skeleton styles
  skeletonLabel: {
    width: 180,
    height: 13,
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 8,
  },
  skeletonBar: {
    height: 8,
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
  },
  skeletonFooter: {
    width: 80,
    height: 12,
    backgroundColor: Colors.chipSurface,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 8,
  },
});
