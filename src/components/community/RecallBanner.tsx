// Kiba — M9 Community RecallBanner
// GLOBAL-scoped recall banner for CommunityScreen (distinct from
// src/components/home/RecallBanner.tsx, which is pantry-scoped per pet).
// Self-fetches via communityService.fetchRecentRecalls. Hidden when no
// recent recalls. Tapping navigates to RecallDetail for the most-recent.
// D-084: Ionicons only. D-125: recall info is always free, no paywall.

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';
import { fetchRecentRecalls, type RecentRecall } from '../../services/communityService';
import type { CommunityStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

interface Props {
  /** Optional override for tests / Storybook to skip the network fetch. */
  initialRecalls?: RecentRecall[] | null;
}

export function RecallBanner({ initialRecalls = null }: Props) {
  const navigation = useNavigation<Nav>();
  const [recalls, setRecalls] = useState<RecentRecall[]>(initialRecalls ?? []);
  const [resolved, setResolved] = useState<boolean>(initialRecalls !== null);

  useEffect(() => {
    if (initialRecalls !== null) return;
    let cancelled = false;
    fetchRecentRecalls()
      .then((data) => {
        if (cancelled) return;
        setRecalls(data);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Treat failure as "no recalls" — never block the screen with a
        // partial-state banner. Service already returns [] on offline.
        setResolved(true);
      });
    return () => { cancelled = true; };
  }, [initialRecalls]);

  // Don't render anything until we know — and don't render when 0 recalls.
  if (!resolved || recalls.length === 0) return null;

  const count = recalls.length;
  const headRecall = recalls[0];
  const label = `${count} recent recall${count > 1 ? 's' : ''} — tap to review`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('RecallDetail', { productId: headRecall.product_id })}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name="warning"
        size={18}
        color={SEVERITY_COLORS.danger}
      />
      <Text style={styles.text} numberOfLines={2}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={SEVERITY_COLORS.danger}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${SEVERITY_COLORS.danger}15`,
    borderLeftWidth: 3,
    borderLeftColor: SEVERITY_COLORS.danger,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  text: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    lineHeight: 18,
  },
});
