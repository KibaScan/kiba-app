// Kiba — M9 Community XPRibbon
// Subtle (NOT hero) XP/level/streak ribbon at the top of CommunityScreen.
// D-070: low-prominence — small/medium type scale, no ring, no progress bar.
// D-084: zero emoji — Ionicons "flame" only.
// Self-fetches via xpService and caches the last-seen summary in AsyncStorage
// to keep the ribbon populated on the next open before the network resolves.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { fetchXPSummary } from '../../services/xpService';
import type { XPSummary } from '../../types/xp';

const CACHE_KEY = '@kiba/xp-summary-cache';

interface Props {
  /** Optional override for tests / Storybook to skip the network fetch. */
  initialSummary?: XPSummary | null;
}

export function XPRibbon({ initialSummary = null }: Props) {
  const [summary, setSummary] = useState<XPSummary | null>(initialSummary);
  const [loading, setLoading] = useState<boolean>(initialSummary === null);

  useEffect(() => {
    let cancelled = false;
    if (initialSummary !== null) return;

    // Hydrate from cache first so the ribbon doesn't shimmer on every visit.
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const cached = JSON.parse(raw) as XPSummary;
          setSummary(cached);
          setLoading(false);
        } catch {
          // Ignore corrupt cache.
        }
      })
      .catch(() => { /* swallow — cache is best-effort */ });

    fetchXPSummary()
      .then((fresh) => {
        if (cancelled) return;
        setSummary(fresh);
        setLoading(false);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
      })
      .catch(() => {
        if (cancelled) return;
        // Failure with no cache: surface as loading-finished so we don't
        // shimmer forever. Render branch hides the ribbon entirely (graceful
        // degradation) — the zero-XP onboarding copy is reserved for users
        // we've confirmed have never scanned, not transient network failures.
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [initialSummary]);

  if (loading) return <RibbonShimmer />;

  // Fetch failed AND no cache available: hide the ribbon. Showing onboarding
  // copy here would mislead returning users hitting a transient network blip.
  if (!summary) return null;

  if (summary.total_xp === 0) {
    return (
      <View style={styles.card} accessibilityRole="text">
        <Text style={styles.emptyText}>
          Scan your first product to start earning XP.
        </Text>
      </View>
    );
  }

  const showStreak = summary.streak_current_days > 0;
  const a11yLabel = [
    `Level ${summary.level}`,
    `${summary.total_xp.toLocaleString()} XP`,
    showStreak ? `${summary.streak_current_days}-day streak` : null,
    `${summary.weekly_xp.toLocaleString()} XP this week`,
  ].filter(Boolean).join(', ');

  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.topRow}>
        <Text style={styles.lvl}>Lv. {summary.level}</Text>
        <Text style={styles.dot}> · </Text>
        <Text style={styles.xp}>{summary.total_xp.toLocaleString()} XP</Text>
        {showStreak && (
          <>
            <Text style={styles.dot}> · </Text>
            <Ionicons
              name="flame"
              size={14}
              color={Colors.severityAmber}
              style={styles.flame}
            />
            <Text style={styles.streak}>
              {summary.streak_current_days}-day streak
            </Text>
          </>
        )}
      </View>
      <Text style={styles.weekly}>
        +{summary.weekly_xp.toLocaleString()} XP this week
      </Text>
    </View>
  );
}

function RibbonShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.card} testID="xp-ribbon-shimmer">
      <Animated.View style={[styles.shimmerLineWide, { opacity }]} />
      <Animated.View style={[styles.shimmerLineNarrow, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lvl: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  xp: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  streak: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  flame: {
    marginRight: 4,
  },
  dot: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
  weekly: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  shimmerLineWide: {
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '70%',
  },
  shimmerLineNarrow: {
    marginTop: 6,
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.chipSurface,
    width: '40%',
  },
});
