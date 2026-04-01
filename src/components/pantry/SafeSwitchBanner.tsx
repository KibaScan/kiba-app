// Kiba — Safe Switch Banner (M7)
// Tappable card showing active food transition progress.
// Renders on PantryScreen (between pet carousel and filter chips) and HomeScreen.
// D-084: Zero emoji — Ionicons only. D-094: Score framing.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { stripBrandFromName } from '../../utils/formatters';
import type { SafeSwitchCardData } from '../../types/safeSwitch';

interface Props {
  data: SafeSwitchCardData;
  onPress: () => void;
  /** Compact mode for HomeScreen (single line, no ring) */
  compact?: boolean;
}

// ─── Day Progress Ring ──────────────────────────────────

function DayRing({ current, total }: { current: number; total: number }) {
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / total, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={ringStyles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={Colors.cardBorder}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={Colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={ringStyles.labelContainer}>
        <Text style={ringStyles.dayText}>Day {current}</Text>
        <Text style={ringStyles.totalText}>{current}/{total}</Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  labelContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  totalText: { fontSize: 9, color: Colors.textSecondary },
});

// ─── Component ──────────────────────────────────────────

export function SafeSwitchBanner({ data, onPress, compact = false }: Props) {
  const { oldProduct, newProduct, currentDay, todayMix, todayLogged } = data;
  const isComplete = data.switch.status === 'completed';
  const isPaused = data.switch.status === 'paused';

  const oldName = stripBrandFromName(oldProduct.brand, oldProduct.name);
  const newName = stripBrandFromName(newProduct.brand, newProduct.name);

  // ── Compact mode (HomeScreen) ──
  if (compact) {
    return (
      <TouchableOpacity
        style={compactStyles.row}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={compactStyles.iconWrap}>
          <Ionicons name="swap-horizontal-outline" size={20} color={Colors.accent} />
        </View>
        <Text style={compactStyles.text} numberOfLines={1}>
          Safe Switch — Day {currentDay} of {data.switch.total_days}
        </Text>
        <Text style={compactStyles.mixText}>
          {todayMix.oldPct}/{todayMix.newPct}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  // ── Full mode (PantryScreen) ──
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <DayRing current={currentDay} total={data.switch.total_days} />

      <View style={styles.content}>
        <Text style={styles.title}>
          {isPaused ? 'Safe Switch Paused' : 'Safe Switch in Progress'}
        </Text>
        <Text style={styles.mixLine}>
          <Text style={{ color: Colors.severityAmber }}>{todayMix.oldPct}% {truncate(oldName, 18)}</Text>
          {' → '}
          <Text style={{ color: Colors.severityGreen }}>{todayMix.newPct}% {truncate(newName, 18)}</Text>
        </Text>
        <Text style={styles.promptText}>
          {todayLogged
            ? 'Today\u2019s tummy check logged'
            : 'Tap to log today\u2019s Tummy Check'}
        </Text>
      </View>

      <View style={styles.chevronWrap}>
        {todayLogged ? (
          <Ionicons name="checkmark-circle" size={18} color={Colors.severityGreen} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: `${Colors.accent}20`,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  mixLine: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  promptText: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  chevronWrap: {
    paddingLeft: 4,
  },
});

const compactStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.accent}20`,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  mixText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
});
