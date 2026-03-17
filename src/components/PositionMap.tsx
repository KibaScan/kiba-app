// Kiba — Position Map
// Horizontal strip of colored segments representing ingredient composition.
// First ingredient = widest segment, tapering right. Color = severity.
// Swipe/drag to scrub across segments; tap to toggle. Zero emoji (D-084).

import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../utils/constants';
import { toDisplayName } from '../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface PositionMapProps {
  ingredients: Array<{
    canonical_name: string;
    position: number;
    severity: 'good' | 'neutral' | 'caution' | 'danger';
    allergenOverride?: boolean;
  }>;
  onSegmentPress?: (position: number) => void;
}

// ─── Severity → Color ──────────────────────────────────

// SEVERITY_COLORS imported from constants.ts — single source of truth

const UNRATED_COLOR = '#C7C7CC'; // unrated — no severity assigned
const ALLERGEN_BORDER_COLOR = Colors.severityAmber;

// ─── Position Weight ────────────────────────────────────

function getPositionWeight(pos: number): number {
  if (pos === 1) return 15;
  if (pos === 2) return 12;
  if (pos >= 3 && pos <= 5) return 10;
  if (pos >= 6 && pos <= 10) return 5;
  return 2;
}

// ─── Component ──────────────────────────────────────────

export function PositionMap({ ingredients, onSegmentPress }: PositionMapProps) {
  if (ingredients.length === 0) return null;

  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const barWidthRef = useRef(0);
  const [barWidth, setBarWidth] = useState(0);
  const isDraggingRef = useRef(false);

  const sorted = [...ingredients].sort((a, b) => a.position - b.position);

  // Compute raw weights and normalize to 100%
  const rawWeights = sorted.map((ing) => getPositionWeight(ing.position));
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  // Cumulative widths for label positioning and hit testing
  const cumulativeWidths: number[] = [];
  let cumWidth = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulativeWidths.push(cumWidth);
    cumWidth += rawWeights[i];
  }

  // Find the cumulative weight% where position 10 ends (for Top 10 marker)
  let top10CumulativePct = 0;
  let top10Found = false;
  let cumulativeWeight = 0;
  for (let idx = 0; idx < sorted.length; idx++) {
    cumulativeWeight += rawWeights[idx];
    if (sorted[idx].position >= 10 && !top10Found) {
      top10CumulativePct = (cumulativeWeight / totalWeight) * 100;
      top10Found = true;
    }
  }

  // ─── Hit testing: X pixel → segment index ──────────
  function segmentIndexFromX(x: number): number {
    const bw = barWidthRef.current;
    if (bw <= 0 || totalWeight <= 0) return -1;
    const clampedX = Math.max(0, Math.min(x, bw));
    const fraction = clampedX / bw;
    const weightAtX = fraction * totalWeight;

    // Linear scan — segments are typically <60, no need for binary search
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += rawWeights[i];
      if (weightAtX < cum) return i;
    }
    return sorted.length - 1;
  }

  function selectSegment(x: number) {
    const idx = segmentIndexFromX(x);
    if (idx >= 0 && idx < sorted.length) {
      const pos = sorted[idx].position;
      setSelectedPosition(pos);
      setLabelWidth(0); // re-measure for new label
      onSegmentPress?.(pos);
    }
  }

  // ─── PanResponder: scrub + tap ────────────────────
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = false;
        selectSegment(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only treat as drag if moved more than 5px (prevents jitter on tap)
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDraggingRef.current = true;
        }
        if (isDraggingRef.current) {
          selectSegment(evt.nativeEvent.locationX);
        }
      },
      onPanResponderRelease: (evt) => {
        if (!isDraggingRef.current) {
          // Tap: toggle — if same segment tapped again, dismiss
          const idx = segmentIndexFromX(evt.nativeEvent.locationX);
          if (idx >= 0 && idx < sorted.length) {
            const pos = sorted[idx].position;
            setSelectedPosition(prev => prev === pos ? null : pos);
            setLabelWidth(0);
          }
        }
        isDraggingRef.current = false;
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [sorted.length, totalWeight],
  );

  // Selected segment label data
  const selectedIdx = selectedPosition != null
    ? sorted.findIndex(s => s.position === selectedPosition)
    : -1;
  const labelCenterPct = selectedIdx >= 0
    ? ((cumulativeWidths[selectedIdx] + rawWeights[selectedIdx] / 2) / totalWeight) * 100
    : 0;
  const selectedDisplayName = selectedIdx >= 0
    ? `${toDisplayName(sorted[selectedIdx].canonical_name)} #${selectedIdx + 1}`
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ingredient Composition</Text>
      <View
        style={styles.barWrapper}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          barWidthRef.current = w;
          setBarWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        {/* Floating label above selected segment — clamped to bar edges */}
        {selectedIdx >= 0 && (
          <View
            key={selectedPosition}
            style={[
              styles.floatingLabel,
              {
                left: (() => {
                  if (barWidth === 0 || labelWidth === 0) return `${labelCenterPct}%`;
                  const LABEL_MARGIN = 4;
                  const centerPx = (labelCenterPct / 100) * barWidth;
                  const idealLeft = centerPx - labelWidth / 2;
                  return Math.max(LABEL_MARGIN, Math.min(idealLeft, barWidth - labelWidth - LABEL_MARGIN));
                })(),
                opacity: labelWidth === 0 ? 0 : 1,
              },
            ]}
            onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
          >
            <Text style={styles.floatingLabelText}>{selectedDisplayName}</Text>
          </View>
        )}

        <View style={styles.bar}>
          {sorted.map((ing, idx) => {
            const widthPct = (rawWeights[idx] / totalWeight) * 100;
            const color = SEVERITY_COLORS[ing.severity] ?? UNRATED_COLOR;
            const hasAllergenBorder = ing.allergenOverride === true;
            const isDimmed = selectedPosition != null && selectedPosition !== ing.position;

            return (
              <View
                key={`${ing.position}-${ing.canonical_name}`}
                style={[
                  styles.segment,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    opacity: isDimmed ? 0.4 : 1,
                  },
                  hasAllergenBorder && styles.allergenBorder,
                  idx === 0 && styles.firstSegment,
                  idx === sorted.length - 1 && styles.lastSegment,
                ]}
              />
            );
          })}
        </View>
        {/* Inner highlight for depth */}
        <View style={styles.barHighlight} pointerEvents="none" />
        {/* Top 10 divider */}
        {top10Found && top10CumulativePct < 98 && (
          <View style={[styles.top10Line, { left: `${top10CumulativePct}%` }]} />
        )}
      </View>
      {top10Found && top10CumulativePct < 98 && (
        <Text style={styles.top10Label}>Top 10</Text>
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
  barWrapper: {
    position: 'relative',
    height: 20,
  },
  bar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  barHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  segment: {
    height: '100%',
  },
  firstSegment: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastSegment: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  allergenBorder: {
    borderWidth: 2,
    borderColor: ALLERGEN_BORDER_COLOR,
  },
  top10Line: {
    position: 'absolute',
    width: 2,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    top: -3,
    marginLeft: -1,
    borderRadius: 1,
  },
  top10Label: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  floatingLabel: {
    position: 'absolute',
    bottom: 26,
    backgroundColor: '#1F1F1F',
    padding: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  floatingLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
});
