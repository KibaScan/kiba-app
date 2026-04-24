// Kiba — M9 Community SafetyFlagsScreen (Task 28, D-072)
// Behind the Discovery Grid "Safety Flags" tile (wired by Task 30).
// Two tabs:
//   - My Flags          → user's own submissions (status + admin notes)
//   - Community Activity → aggregate counts last 7d via SECURITY DEFINER RPC
//
// Both tabs fetch on mount; the active tab refetches on screen focus so a
// fresh submission shows up when the user returns from SafetyFlagSheet.
//
// CommunityStack has headerShown: false → render our own header (matches
// BlogListScreen / KibaKitchenFeedScreen).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import {
  fetchMyFlags,
  fetchCommunityActivityCounts,
} from '../services/scoreFlagService';
import { SafetyFlagRow } from '../components/community/SafetyFlagRow';
import { CommunityActivitySummary } from '../components/community/CommunityActivitySummary';
import type {
  ScoreFlag,
  CommunityActivityCount,
} from '../types/scoreFlag';
import type { CommunityStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<CommunityStackParamList, 'SafetyFlags'>;

type Tab = 'my' | 'community';

// ─── Component ──────────────────────────────────────────

export default function SafetyFlagsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('my');

  const [myFlags, setMyFlags] = useState<ScoreFlag[]>([]);
  const [myFlagsLoading, setMyFlagsLoading] = useState<boolean>(true);

  const [activityCounts, setActivityCounts] = useState<CommunityActivityCount[]>([]);
  const [activityLoading, setActivityLoading] = useState<boolean>(true);

  const loadMyFlags = useCallback(async () => {
    setMyFlagsLoading(true);
    try {
      const rows = await fetchMyFlags();
      setMyFlags(rows);
    } finally {
      setMyFlagsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const rows = await fetchCommunityActivityCounts();
      setActivityCounts(rows);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Mount fetch — both tabs in parallel so a tab switch doesn't kick off a
  // first request after the user already tapped. Focus refetch skips the
  // first invocation (handled here) to avoid a duplicate round-trip when
  // the screen first comes into focus.
  const initialMountRef = useRef<boolean>(true);
  useEffect(() => {
    void loadMyFlags();
    void loadActivity();
  }, [loadMyFlags, loadActivity]);

  // On subsequent focus (return from a fresh submission), refetch the active
  // tab so a just-submitted flag shows up. Skip the first focus to avoid the
  // mount-fetch overlap.
  useFocusEffect(
    useCallback(() => {
      if (initialMountRef.current) {
        initialMountRef.current = false;
        return;
      }
      if (tab === 'my') void loadMyFlags();
      else void loadActivity();
    }, [tab, loadMyFlags, loadActivity]),
  );

  const renderFlag: ListRenderItem<ScoreFlag> = useCallback(
    ({ item }) => <SafetyFlagRow flag={item} />,
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Reports</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Segmented Control */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segTab, tab === 'my' && styles.segTabActive]}
          onPress={() => setTab('my')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'my' }}
        >
          <Text style={[styles.segTabText, tab === 'my' && styles.segTabTextActive]}>
            My Flags
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segTab, tab === 'community' && styles.segTabActive]}
          onPress={() => setTab('community')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'community' }}
        >
          <Text
            style={[styles.segTabText, tab === 'community' && styles.segTabTextActive]}
          >
            Community Activity
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab body */}
      {tab === 'my' ? (
        <MyFlagsBody
          flags={myFlags}
          loading={myFlagsLoading}
          renderItem={renderFlag}
        />
      ) : (
        <CommunityBody
          counts={activityCounts}
          loading={activityLoading}
        />
      )}
    </View>
  );
}

// ─── My Flags body ──────────────────────────────────────

interface MyFlagsBodyProps {
  flags: ScoreFlag[];
  loading: boolean;
  renderItem: ListRenderItem<ScoreFlag>;
}

function MyFlagsBody({ flags, loading, renderItem }: MyFlagsBodyProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (flags.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No reports yet</Text>
        <Text style={styles.emptyBody}>
          Tap “Flag this score” on any product to submit one.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={flags}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
    />
  );
}

// ─── Community body ─────────────────────────────────────

interface CommunityBodyProps {
  counts: CommunityActivityCount[];
  loading: boolean;
}

function CommunityBody({ counts, loading }: CommunityBodyProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No community reports this week</Text>
        <Text style={styles.emptyBody}>Check back as more pet parents submit flags.</Text>
      </View>
    );
  }

  return <CommunityActivitySummary counts={counts} />;
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 24 },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.cardSurface,
    padding: 3,
  },
  segTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  segTabActive: {
    backgroundColor: Colors.accent,
  },
  segTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segTabTextActive: {
    color: Colors.textPrimary,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
