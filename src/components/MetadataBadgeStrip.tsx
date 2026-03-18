// MetadataBadgeStrip — Compact metadata pill badges for TL;DR zone.
// AAFCO status + category + product form + preservative type + life stage.
// Default: centered flex-wrap grid. Fallback: horizontal scroll via centered={false}.
// Zero emoji (D-084).

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SEVERITY_COLORS } from '../utils/constants';
import { resolveLifeStageLabel } from '../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface MetadataBadgeStripProps {
  aafcoStatement: string | null;
  category: 'daily_food' | 'treat';
  isSupplemental: boolean;
  productForm: string | null;
  preservativeType: string | null;
  lifeStageClaim: string | null;
  targetSpecies: 'dog' | 'cat';
  /** When true (default), badges wrap in a centered grid. When false, horizontal scroll. */
  centered?: boolean;
}

// ─── Badge Data ─────────────────────────────────────────

interface Badge {
  label: string;
  textColor: string;
  bgColor: string;
}

// 12% opacity suffix for badge backgrounds
const OPACITY_12 = '1F'; // hex ~12%

const TEAL = '#14B8A6';

function getAafcoBadge(aafcoStatement: string | null): Badge {
  // Two states only: present (green) or missing (amber).
  // The three-state distinction (recognized vs unrecognized) remains in
  // constants.ts for detailed views, but the badge strip only cares present/absent.
  if (!aafcoStatement || !aafcoStatement.trim()) {
    return {
      label: 'No AAFCO',
      textColor: '#F59E0B',
      bgColor: '#F59E0B20',
    };
  }

  return {
    label: 'AAFCO \u2713',
    textColor: '#4ADE80',
    bgColor: '#4ADE8020',
  };
}

function getCategoryBadge(category: 'daily_food' | 'treat', isSupplemental: boolean): Badge {
  if (isSupplemental) {
    return {
      label: 'Supplemental',
      textColor: TEAL,
      bgColor: TEAL + OPACITY_12,
    };
  }
  if (category === 'treat') {
    return {
      label: 'Treat',
      textColor: SEVERITY_COLORS.neutral,
      bgColor: SEVERITY_COLORS.neutral + OPACITY_12,
    };
  }
  return {
    label: 'Daily Food',
    textColor: SEVERITY_COLORS.neutral,
    bgColor: SEVERITY_COLORS.neutral + OPACITY_12,
  };
}

const FORM_LABELS: Record<string, string> = {
  dry: 'Dry',
  wet: 'Wet',
  freeze_dried: 'Freeze-Dried',
  raw: 'Raw',
  dehydrated: 'Dehydrated',
  topper: 'Topper',
};

function getFormBadge(productForm: string | null): Badge | null {
  if (!productForm) return null;
  const label = FORM_LABELS[productForm];
  if (!label) return null;
  return {
    label,
    textColor: SEVERITY_COLORS.neutral,
    bgColor: SEVERITY_COLORS.neutral + OPACITY_12,
  };
}

function getPreservativeBadge(preservativeType: string | null): Badge | null {
  if (!preservativeType || preservativeType === 'unknown') return null;

  if (preservativeType === 'natural') {
    return {
      label: 'Natural Preservatives',
      textColor: SEVERITY_COLORS.good,
      bgColor: SEVERITY_COLORS.good + OPACITY_12,
    };
  }
  if (preservativeType === 'synthetic') {
    return {
      label: 'Synthetic Preservatives',
      textColor: SEVERITY_COLORS.caution,
      bgColor: SEVERITY_COLORS.caution + OPACITY_12,
    };
  }
  if (preservativeType === 'mixed') {
    return {
      label: 'Mixed Preservatives',
      textColor: SEVERITY_COLORS.neutral,
      bgColor: SEVERITY_COLORS.neutral + OPACITY_12,
    };
  }
  return null;
}

function getLifeStageBadge(
  lifeStageClaim: string | null,
  targetSpecies: 'dog' | 'cat',
): Badge | null {
  if (!lifeStageClaim || !lifeStageClaim.trim()) return null;
  const label = resolveLifeStageLabel(lifeStageClaim, targetSpecies);
  return {
    label,
    textColor: SEVERITY_COLORS.neutral,
    bgColor: SEVERITY_COLORS.neutral + OPACITY_12,
  };
}

// ─── Component ──────────────────────────────────────────

export function MetadataBadgeStrip({
  aafcoStatement,
  category,
  isSupplemental,
  productForm,
  preservativeType,
  lifeStageClaim,
  targetSpecies,
  centered = true,
}: MetadataBadgeStripProps) {
  const badges: Badge[] = [];

  // 1. AAFCO (always shown)
  badges.push(getAafcoBadge(aafcoStatement));

  // 2. Category (always shown)
  badges.push(getCategoryBadge(category, isSupplemental));

  // 3. Product form (if known)
  const formBadge = getFormBadge(productForm);
  if (formBadge) badges.push(formBadge);

  // 4. Preservative type (if known and not 'unknown')
  const preservativeBadge = getPreservativeBadge(preservativeType);
  if (preservativeBadge) badges.push(preservativeBadge);

  // 5. Life stage (if available)
  const lifeStageBadge = getLifeStageBadge(lifeStageClaim, targetSpecies);
  if (lifeStageBadge) badges.push(lifeStageBadge);

  const badgeElements = badges.map((badge, idx) => (
    <View
      key={idx}
      style={[styles.pill, { backgroundColor: badge.bgColor }]}
    >
      <Text style={[styles.pillText, { color: badge.textColor }]}>
        {badge.label}
      </Text>
    </View>
  ));

  if (centered) {
    return (
      <View style={styles.centeredContainer}>
        {badgeElements}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {badgeElements}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  centeredContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  pill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
