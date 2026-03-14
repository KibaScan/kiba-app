/**
 * BenchmarkBar — shows where a product's score falls relative to the category average.
 * Horizontal gradient bar with a marker for the product score and a line for the category average.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBenchmarkStore, type CategoryAverage } from '../utils/benchmarkData';

// ─── Score Color Breakpoints (D-136 — supersedes D-113) ───

function scoreColor(score: number, isSupplemental: boolean): string {
  if (score >= 85) return isSupplemental ? '#14B8A6' : '#22C55E';
  if (score >= 70) return isSupplemental ? '#22D3EE' : '#86EFAC';
  if (score >= 65) return '#FACC15';
  if (score >= 51) return '#F59E0B';
  return '#EF4444';
}

// ─── Props ────────────────────────────────────────────────

interface BenchmarkBarProps {
  score: number;
  category: 'daily_food' | 'treat';
  targetSpecies: 'dog' | 'cat';
  isGrainFree: boolean;
  isSupplemental?: boolean;
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

export function BenchmarkBar({ score, category, targetSpecies, isGrainFree, isSupplemental = false }: BenchmarkBarProps) {
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
  const markerColor = scoreColor(score, isSupplemental);

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
        {/* Background gradient segments (D-136 five-tier) */}
        <View style={styles.barTrack}>
          <View style={[styles.segment, { flex: 51, backgroundColor: '#EF4444' }]} />
          <View style={[styles.segment, { flex: 14, backgroundColor: '#F59E0B' }]} />
          <View style={[styles.segment, { flex: 5, backgroundColor: '#FACC15' }]} />
          <View style={[styles.segment, { flex: 15, backgroundColor: isSupplemental ? '#22D3EE' : '#86EFAC' }]} />
          <View style={[styles.segment, { flex: 15, backgroundColor: isSupplemental ? '#14B8A6' : '#22C55E' }]} />
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
