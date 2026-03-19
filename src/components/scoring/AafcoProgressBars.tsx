// Kiba — AAFCO Progress Bars
// Visual comparison of GA values vs AAFCO min/max thresholds.
// Makes the 30% nutritional bucket transparent. Zero emoji (D-084).
// Factual language only (D-095). Pet name in section label (D-094).

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { InfoTooltip } from '../ui/InfoTooltip';
import type { LifeStage } from '../../types/pet';
import type { CarbEstimate } from '../../types/scoring';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getCarbColor(label: string | null): string {
  if (label === 'Low') return Colors.severityGreen;
  if (label === 'Moderate') return Colors.severityAmber;
  return Colors.severityRed;
}

// ─── Props ──────────────────────────────────────────────

interface AafcoProgressBarsProps {
  gaValues: {
    protein_pct: number | null;
    fat_pct: number | null;
    fiber_pct: number | null;
    moisture_pct: number | null;
  };
  dmbValues?: {
    protein_pct: number;
    fat_pct: number;
    fiber_pct: number;
  };
  species: 'dog' | 'cat';
  lifeStage: LifeStage | null;
  category: 'daily_food' | 'treat';
  petName: string;
  nutritionalDataSource?: 'manual' | 'llm_extracted' | null;
  isSupplemental?: boolean;
  carbEstimate?: CarbEstimate | null;
}

// ─── AAFCO Thresholds (from NUTRITIONAL_PROFILE_BUCKET_SPEC.md §2a/§2b) ───

interface NutrientThreshold {
  min: number | null; // DMB %
  max: number | null; // DMB %
}

interface ThresholdSet {
  protein: NutrientThreshold;
  fat: NutrientThreshold;
  fiber: NutrientThreshold;
}

function getThresholds(species: 'dog' | 'cat', isGrowth: boolean): ThresholdSet {
  if (species === 'dog') {
    return isGrowth
      ? {
          protein: { min: 22.5, max: null },
          fat: { min: 8.5, max: null },
          fiber: { min: null, max: 5 },
        }
      : {
          protein: { min: 18.0, max: null },
          fat: { min: 5.5, max: null },
          fiber: { min: null, max: 5 },
        };
  }
  // Cat
  return isGrowth
    ? {
        protein: { min: 30.0, max: null },
        fat: { min: 9.0, max: null },
        fiber: { min: null, max: 5 },
      }
    : {
        protein: { min: 26.0, max: null },
        fat: { min: 9.0, max: null },
        fiber: { min: null, max: 5 },
      };
}

function isGrowthStage(lifeStage: LifeStage | null): boolean {
  if (!lifeStage) return false;
  return lifeStage === 'puppy' || lifeStage === 'kitten';
}

// ─── Bar Zone Colors ────────────────────────────────────

type Zone = 'green' | 'amber' | 'red';

function getZoneForMin(value: number, min: number): Zone {
  if (value >= min) return 'green';
  if (value >= min * 0.9) return 'amber';
  return 'red';
}

function getZoneForMax(value: number, max: number): Zone {
  if (value <= max) return 'green';
  if (value <= max * 1.1) return 'amber';
  return 'red';
}

const ZONE_COLORS: Record<Zone, string> = {
  green: Colors.severityGreen,
  amber: Colors.severityAmber,
  red: Colors.severityRed,
};

// ─── Individual Progress Bar ────────────────────────────

interface NutrientBarProps {
  label: string;
  value: number;
  threshold: NutrientThreshold;
  barMax: number; // right edge of the bar scale
}

function NutrientBar({ label, value, threshold, barMax }: NutrientBarProps) {
  const fillFraction = Math.min(value / barMax, 1);

  // Determine zone
  let zone: Zone = 'green';
  if (threshold.min != null) {
    zone = getZoneForMin(value, threshold.min);
  } else if (threshold.max != null) {
    zone = getZoneForMax(value, threshold.max);
  }

  const barColor = ZONE_COLORS[zone];

  // Threshold marker position
  const thresholdValue = threshold.min ?? threshold.max;
  const markerFraction = thresholdValue != null ? Math.min(thresholdValue / barMax, 1) : null;
  const isMin = threshold.min != null;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={barStyles.valueLabel}>{value.toFixed(1)}%</Text>
      </View>
      <View style={barStyles.track}>
        <View
          style={[
            barStyles.fill,
            {
              width: `${fillFraction * 100}%`,
              backgroundColor: barColor,
            },
          ]}
        />
        {markerFraction != null && (
          <>
            <View
              style={[
                barStyles.marker,
                { left: `${markerFraction * 100}%` },
              ]}
            />
            <Text
              style={[
                barStyles.markerLabel,
                { left: `${markerFraction * 100}%` },
              ]}
            >
              {isMin ? 'min' : 'max'}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  valueLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cardBorder,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 1,
    marginLeft: -1,
  },
  markerLabel: {
    position: 'absolute',
    top: 10,
    fontSize: 9,
    color: '#9CA3AF',
    marginLeft: -6,
  },
});

// ─── Main Component ─────────────────────────────────────

export function AafcoProgressBars({
  gaValues,
  dmbValues,
  species,
  lifeStage,
  category,
  petName,
  nutritionalDataSource,
  isSupplemental = false,
  carbEstimate,
}: AafcoProgressBarsProps) {
  const [showDmb, setShowDmb] = useState(false);
  const [gaExpanded, setGaExpanded] = useState(false);

  const { protein_pct, fat_pct, fiber_pct, moisture_pct } = gaValues;
  const isTreat = category === 'treat';

  // Treats: show only carb estimate (NP bucket is 0% weight — GA bars imply scoring relevance)
  if (isTreat) {
    if (!carbEstimate || carbEstimate.valueDmb == null) return null;
    return (
      <View style={styles.container}>
        <View style={styles.carbRow}>
          <Text style={styles.carbLabel}>Carbohydrate</Text>
          <View style={styles.carbRight}>
            <Text
              style={[
                styles.carbValue,
                carbEstimate.qualitativeLabel != null && {
                  color: getCarbColor(carbEstimate.qualitativeLabel),
                },
              ]}
            >
              Est. {Math.round(carbEstimate.valueDmb)}%
              {carbEstimate.qualitativeLabel ? ` \u00B7 ${carbEstimate.qualitativeLabel}` : ''}
            </Text>
            <InfoTooltip
              maxWidth={300}
              text={`Estimated using the nitrogen-free extract method:\n100 \u2212 ${protein_pct ?? '?'}% protein \u2212 ${fat_pct ?? '?'}% fat \u2212 ${fiber_pct ?? '?'}% fiber \u2212 ${moisture_pct ?? '?'}% moisture \u2212 ${carbEstimate.ashUsedPct ?? '?'}% ash${carbEstimate.confidence === 'estimated' ? ' (est.)' : ''} = ${Math.round(carbEstimate.valueDmb)}%\nThis value is not stated on the label.`}
            />
          </View>
        </View>
      </View>
    );
  }

  // Don't render if all GA values are null
  if (protein_pct == null && fat_pct == null && fiber_pct == null) return null;

  const isGrowth = isGrowthStage(lifeStage);
  const thresholds = getThresholds(species, isGrowth);
  const hasDmb = dmbValues != null;

  // Supplementals: no AAFCO comparison — show as-label macro profile
  const noThreshold: NutrientThreshold = { min: null, max: null };
  const displayThresholds = isSupplemental
    ? { protein: noThreshold, fat: noThreshold, fiber: noThreshold }
    : thresholds;
  const standardLabel = isSupplemental ? null : (isGrowth ? 'Growth standard' : 'Adult standard');

  // Select which values to display
  const displayProtein = showDmb && dmbValues ? dmbValues.protein_pct : protein_pct;
  const displayFat = showDmb && dmbValues ? dmbValues.fat_pct : fat_pct;
  const displayFiber = showDmb && dmbValues ? dmbValues.fiber_pct : fiber_pct;

  // Bar max — sensible ceiling for visual scaling
  const BAR_MAX = 60;

  const speciesLabel = species === 'dog' ? 'canine' : 'feline';
  const lifeStageLabel = isGrowth
    ? (species === 'dog' ? 'growth' : 'growth')
    : (lifeStage ?? 'adult');

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text style={styles.sectionTitle}>
        {isSupplemental ? 'Macro Profile' : `${petName}'s Nutritional Fit`}
      </Text>
      <Text style={styles.subtitle}>
        {isSupplemental
          ? 'As listed on label'
          : `vs. AAFCO ${speciesLabel} ${lifeStageLabel} standards`}
      </Text>

      {/* AI extraction note */}
      {nutritionalDataSource === 'llm_extracted' && (
        <Text style={styles.aiNote}>
          Nutritional values extracted from label text by AI. Minor inaccuracies possible.
        </Text>
      )}

      {/* DMB Toggle (wet food only) */}
      {hasDmb && (
        <TouchableOpacity
          style={styles.dmbToggle}
          onPress={() => setShowDmb((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showDmb ? 'checkbox' : 'square-outline'}
            size={18}
            color={Colors.accent}
          />
          <Text style={styles.dmbToggleText}>
            {showDmb ? 'Showing Dry Matter Basis' : 'Show Dry Matter Basis'}
          </Text>
          <TouchableOpacity
            hitSlop={12}
            onPress={() => {/* Info handled by toggle */}}
          >
            <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {hasDmb && showDmb && moisture_pct != null && (
        <Text style={styles.dmbExplainer}>
          Dry Matter Basis removes water content for accurate comparison.
          This food contains {moisture_pct.toFixed(0)}% moisture.
        </Text>
      )}

      {/* Ultra-high-moisture context note (broths, lickables >80% water) */}
      {hasDmb && showDmb && moisture_pct != null && moisture_pct > 80 && (
        <Text style={styles.dmbExplainer}>
          This product is {moisture_pct.toFixed(0)}% water. DMB values appear high because the dry portion is very concentrated. This is normal for broths and lickable treats.
        </Text>
      )}

      {/* Standard label (hidden for supplementals — no AAFCO comparison) */}
      {standardLabel && (
        <Text style={styles.standardLabel}>{standardLabel}</Text>
      )}

      {/* Nutrient Bars */}
      {displayProtein != null && (
        <NutrientBar
          label="Protein"
          value={displayProtein}
          threshold={displayThresholds.protein}
          barMax={BAR_MAX}
        />
      )}
      {displayFat != null && (
        <NutrientBar
          label="Fat"
          value={displayFat}
          threshold={displayThresholds.fat}
          barMax={BAR_MAX}
        />
      )}
      {displayFiber != null && (
        <NutrientBar
          label="Fiber"
          value={displayFiber}
          threshold={displayThresholds.fiber}
          barMax={BAR_MAX}
        />
      )}
      {moisture_pct != null && !showDmb && (
        <NutrientBar
          label="Moisture"
          value={moisture_pct}
          threshold={{ min: null, max: null }}
          barMax={BAR_MAX}
        />
      )}

      {/* Carb estimate (D-104 — display only, not on label) */}
      {carbEstimate && carbEstimate.valueDmb != null && (
        <View style={styles.carbRow}>
          <Text style={styles.carbLabel}>Carbohydrate</Text>
          <View style={styles.carbRight}>
            <Text
              style={[
                styles.carbValue,
                carbEstimate.qualitativeLabel != null && {
                  color: getCarbColor(carbEstimate.qualitativeLabel),
                },
              ]}
            >
              Est. {Math.round(carbEstimate.valueDmb)}%
              {carbEstimate.qualitativeLabel ? ` \u00B7 ${carbEstimate.qualitativeLabel}` : ''}
            </Text>
            <InfoTooltip
              maxWidth={300}
              text={`Estimated using the nitrogen-free extract method:\n100 \u2212 ${protein_pct ?? '?'}% protein \u2212 ${fat_pct ?? '?'}% fat \u2212 ${fiber_pct ?? '?'}% fiber \u2212 ${moisture_pct ?? '?'}% moisture \u2212 ${carbEstimate.ashUsedPct ?? '?'}% ash${carbEstimate.confidence === 'estimated' ? ' (est.)' : ''} = ${Math.round(carbEstimate.valueDmb)}%\nThis value is not stated on the label.`}
            />
          </View>
        </View>
      )}

      {/* D-136: Supplemental products — macro profile only note */}
      {isSupplemental && (
        <Text style={styles.supplementalNote}>
          Showing macro profile only — supplemental products are not designed to meet full AAFCO nutritional standards
        </Text>
      )}

      {/* Expand/collapse raw GA values */}
      <TouchableOpacity
        style={styles.gaToggle}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setGaExpanded(v => !v);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.gaToggleText}>
          {gaExpanded ? 'Hide guaranteed analysis \u25B4' : 'View guaranteed analysis \u25BE'}
        </Text>
      </TouchableOpacity>

      {gaExpanded && (
        <View style={styles.gaCompact}>
          {protein_pct != null && (
            <View style={styles.gaCompactRow}>
              <Text style={styles.gaCompactLabel}>Crude Protein (min)</Text>
              <Text style={styles.gaCompactValue}>{protein_pct}%</Text>
            </View>
          )}
          {fat_pct != null && (
            <View style={styles.gaCompactRow}>
              <Text style={styles.gaCompactLabel}>Crude Fat (min)</Text>
              <Text style={styles.gaCompactValue}>{fat_pct}%</Text>
            </View>
          )}
          {fiber_pct != null && (
            <View style={styles.gaCompactRow}>
              <Text style={styles.gaCompactLabel}>Crude Fiber (max)</Text>
              <Text style={styles.gaCompactValue}>{fiber_pct}%</Text>
            </View>
          )}
          {moisture_pct != null && (
            <View style={styles.gaCompactRow}>
              <Text style={styles.gaCompactLabel}>Moisture (max)</Text>
              <Text style={styles.gaCompactValue}>{moisture_pct}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  aiNote: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  dmbToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  dmbToggleText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '500',
    flex: 1,
  },
  dmbExplainer: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  standardLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  supplementalNote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: Spacing.xs,
  },
  carbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  carbLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  carbRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carbValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  gaToggle: {
    marginTop: Spacing.sm,
    paddingVertical: 4,
  },
  gaToggleText: {
    fontSize: FontSizes.sm,
    color: '#9CA3AF',
  },
  gaCompact: {
    marginTop: Spacing.sm,
  },
  gaCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  gaCompactLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  gaCompactValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
