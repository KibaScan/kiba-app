/**
 * BenchmarkBar — shows where a product's score falls relative to the category average.
 * Horizontal gradient bar with a marker for the product score and a line for the category average.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBenchmarkStore, type CategoryAverage } from '../utils/benchmarkData';

// ─── Score Color Breakpoints (D-113) ──────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#34C759';
  if (score >= 70) return '#00B4D8';
  if (score >= 50) return '#FF9500';
  return '#FF3B30';
}

// ─── Props ────────────────────────────────────────────────

interface BenchmarkBarProps {
  score: number;
  category: 'daily_food' | 'treat';
  targetSpecies: 'dog' | 'cat';
  isGrainFree: boolean;
}

// ─── Skeleton ─────────────────────────────────────────────

const FIXED_HEIGHT = 80;

function BenchmarkSkeleton() {
  return (
    <View style={[styles.container, { height: FIXED_HEIGHT, justifyContent: 'center' }]}>
      <View style={styles.skeletonLabel} />
      <View style={styles.skeletonBar} />
      <View style={styles.skeletonFooter} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────

export function BenchmarkBar({ score, category, targetSpecies, isGrainFree }: BenchmarkBarProps) {
  const [avg, setAvg] = useState<CategoryAverage | null>(null);
  const [loading, setLoading] = useState(true);
  const getCategoryAverage = useBenchmarkStore((s) => s.getCategoryAverage);

  useEffect(() => {
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
  }, [category, targetSpecies, isGrainFree, getCategoryAverage]);

  if (loading) return <BenchmarkSkeleton />;
  if (!avg || avg.product_count === 0) return null;

  const markerPosition = Math.max(0, Math.min(100, score));
  const avgPosition = Math.max(0, Math.min(100, avg.avg_score));
  const markerColor = scoreColor(score);

  const categoryLabel = category === 'treat' ? 'treats' : 'foods';
  const grainLabel = isGrainFree ? 'grain-free' : 'grain-inclusive';
  const speciesLabel = targetSpecies === 'dog' ? 'dog' : 'cat';
  const diffFromAvg = Math.round(score - avg.avg_score);
  const diffLabel = diffFromAvg > 0
    ? `+${diffFromAvg} above avg`
    : diffFromAvg < 0
      ? `${diffFromAvg} below avg`
      : 'at avg';

  return (
    <View style={[styles.container, { height: FIXED_HEIGHT }]}>
      <Text style={styles.label}>
        vs. {avg.product_count.toLocaleString()} {speciesLabel} {grainLabel} {categoryLabel}
      </Text>

      <View style={styles.barContainer}>
        {/* Background gradient segments */}
        <View style={styles.barTrack}>
          <View style={[styles.segment, styles.segmentRed, { flex: 50 }]} />
          <View style={[styles.segment, styles.segmentAmber, { flex: 20 }]} />
          <View style={[styles.segment, styles.segmentCyan, { flex: 10 }]} />
          <View style={[styles.segment, styles.segmentGreen, { flex: 20 }]} />
        </View>

        {/* Category average line */}
        <View style={[styles.avgLine, { left: `${avgPosition}%` }]} />

        {/* Product score marker */}
        <View style={[styles.marker, { left: `${markerPosition}%`, backgroundColor: markerColor }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>0</Text>
        <Text style={[styles.diffLabel, { color: markerColor }]}>{diffLabel}</Text>
        <Text style={styles.footerRight}>100</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  barContainer: {
    height: 24,
    position: 'relative',
    justifyContent: 'center',
  },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  segmentRed: {
    backgroundColor: '#FF3B30',
    opacity: 0.3,
  },
  segmentAmber: {
    backgroundColor: '#FF9500',
    opacity: 0.3,
  },
  segmentCyan: {
    backgroundColor: '#00B4D8',
    opacity: 0.3,
  },
  segmentGreen: {
    backgroundColor: '#34C759',
    opacity: 0.3,
  },
  avgLine: {
    position: 'absolute',
    width: 2,
    height: 18,
    backgroundColor: '#8E8E93',
    top: 3,
    marginLeft: -1,
  },
  marker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    top: 6,
    marginLeft: -6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerLeft: {
    fontSize: 11,
    color: '#C7C7CC',
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerRight: {
    fontSize: 11,
    color: '#C7C7CC',
  },
  // Skeleton styles
  skeletonLabel: {
    width: 180,
    height: 13,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 8,
  },
  skeletonBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
  skeletonFooter: {
    width: 80,
    height: 12,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 8,
  },
});
