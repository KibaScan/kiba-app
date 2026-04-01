// Kiba — Safe Switch Detail Screen (M7)
// Daily command center: today's mix, tummy check logger, 7-day timeline, actions.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, getScoreColor } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import { getCupSplit, shouldShowUpsetAdvisory } from '../utils/safeSwitchHelpers';
import {
  getActiveSwitchForPet,
  logTummyCheck,
  completeSafeSwitch,
  cancelSafeSwitch,
  pauseSafeSwitch,
  resumeSafeSwitch,
} from '../services/safeSwitchService';
import { rescheduleAllSafeSwitchNotifications, cancelAllSafeSwitchNotifications } from '../services/safeSwitchNotificationScheduler';
import { useActivePetStore } from '../stores/useActivePetStore';
import { supabase } from '../services/supabase';
import type { PantryStackParamList } from '../types/navigation';
import type { SafeSwitchCardData, TummyCheck } from '../types/safeSwitch';

type Props = NativeStackScreenProps<PantryStackParamList, 'SafeSwitchDetail'>;

// ─── Tummy Check Config ─────────────────────────────────

const TUMMY_OPTIONS: { key: TummyCheck; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'perfect', label: 'Perfect', icon: 'checkmark-circle-outline', color: Colors.severityGreen },
  { key: 'soft_stool', label: 'Soft Stool', icon: 'remove-circle-outline', color: Colors.severityAmber },
  { key: 'upset', label: 'Upset', icon: 'alert-circle-outline', color: Colors.severityRed },
];

// ─── Component ──────────────────────────────────────────

export default function SafeSwitchDetailScreen({ navigation, route }: Props) {
  const { switchId } = route.params;
  const insets = useSafeAreaInsets();

  const pets = useActivePetStore(s => s.pets);

  // ── State ──
  const [data, setData] = useState<SafeSwitchCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tummyLoading, setTummyLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // ── Load data ──
  const loadData = useCallback(async () => {
    // Find pet from switch — we need to query the switch to get pet_id
    const { data: sw } = await supabase
      .from('safe_switches')
      .select('pet_id')
      .eq('id', switchId)
      .single();

    if (!sw) {
      setLoading(false);
      return;
    }

    const result = await getActiveSwitchForPet((sw as { pet_id: string }).pet_id);
    setData(result);
    if (result?.switch.status === 'completed') setIsCompleted(true);
    setLoading(false);
  }, [switchId]);

  useEffect(() => { loadData(); }, [loadData]);

  const pet = data ? pets.find(p => p.id === data.switch.pet_id) : null;
  const petName = pet?.name ?? 'Your pet';

  // ── Tummy check handler ──
  const handleTummyCheck = useCallback(async (check: TummyCheck) => {
    if (!data) return;
    setTummyLoading(true);
    try {
      await logTummyCheck(data.switch.id, data.currentDay, check);
      await loadData(); // Refresh to show updated state
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to log tummy check.');
    } finally {
      setTummyLoading(false);
    }
  }, [data, loadData]);

  // ── Complete handler ──
  const handleComplete = useCallback(async () => {
    if (!data) return;
    try {
      await completeSafeSwitch(data.switch.id);
      await cancelAllSafeSwitchNotifications();
      setIsCompleted(true);
      await loadData();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, [data, loadData]);

  // ── Cancel handler ──
  const handleCancel = useCallback(() => {
    if (!data) return;
    Alert.alert(
      'Cancel Safe Switch',
      `Stop the food transition for ${petName}?`,
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Switch', style: 'destructive', onPress: async () => {
            await cancelSafeSwitch(data.switch.id);
            await cancelAllSafeSwitchNotifications();
            navigation.goBack();
          },
        },
      ],
    );
  }, [data, petName, navigation]);

  // ── Pause / Resume handler ──
  const handlePauseResume = useCallback(async () => {
    if (!data) return;
    try {
      if (data.switch.status === 'paused') {
        await resumeSafeSwitch(data.switch.id);
        await rescheduleAllSafeSwitchNotifications();
      } else {
        await pauseSafeSwitch(data.switch.id);
        await cancelAllSafeSwitchNotifications();
      }
      await loadData();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, [data, loadData]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safe Switch</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active food transition found.</Text>
        </View>
      </View>
    );
  }

  const { oldProduct, newProduct, currentDay, todayMix, todayLogged, schedule, logs } = data;
  const oldName = stripBrandFromName(oldProduct.brand, oldProduct.name);
  const newName = stripBrandFromName(newProduct.brand, newProduct.name);
  const isPaused = data.switch.status === 'paused';
  const isFinalDay = currentDay >= data.switch.total_days;
  const showUpsetAdvisory = shouldShowUpsetAdvisory(logs, currentDay);

  const { oldCups, newCups } = getCupSplit(data.dailyCups, todayMix.oldPct, todayMix.newPct);

  // Today's tummy check value
  const todayLog = logs.find(l => l.day_number === currentDay);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Safe Switch</Text>
          <Text style={styles.headerSubtitle}>Day {currentDay} of {data.switch.total_days}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Completed state */}
        {isCompleted && (
          <View style={styles.completedCard}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.severityGreen} />
            <Text style={styles.completedTitle}>Switch Complete</Text>
            <Text style={styles.completedBody}>
              {petName} has fully transitioned to {newProduct.brand} {newName}.
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isCompleted && (
          <>
            {/* Product comparison header */}
            <View style={styles.comparisonCard}>
              <View style={styles.comparisonProduct}>
                {oldProduct.image_url ? (
                  <Image source={{ uri: oldProduct.image_url }} style={styles.comparisonImage} />
                ) : (
                  <View style={[styles.comparisonImage, styles.comparisonImagePlaceholder]}>
                    <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
                  </View>
                )}
                <Text style={styles.comparisonName} numberOfLines={2}>{oldProduct.brand}</Text>
                {data.oldScore != null && (
                  <View style={[styles.miniScoreBadge, { backgroundColor: `${getScoreColor(data.oldScore)}33` }]}>
                    <Text style={[styles.miniScoreText, { color: getScoreColor(data.oldScore) }]}>
                      {data.oldScore}%
                    </Text>
                  </View>
                )}
              </View>

              <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} />

              <View style={styles.comparisonProduct}>
                {newProduct.image_url ? (
                  <Image source={{ uri: newProduct.image_url }} style={styles.comparisonImage} />
                ) : (
                  <View style={[styles.comparisonImage, styles.comparisonImagePlaceholder]}>
                    <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
                  </View>
                )}
                <Text style={styles.comparisonName} numberOfLines={2}>{newProduct.brand}</Text>
                {data.newScore != null && (
                  <View style={[styles.miniScoreBadge, { backgroundColor: `${getScoreColor(data.newScore)}33` }]}>
                    <Text style={[styles.miniScoreText, { color: getScoreColor(data.newScore) }]}>
                      {data.newScore}%
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.switchingForText}>Switching for {petName}</Text>

            {/* Paused banner */}
            {isPaused && (
              <View style={styles.pausedBanner}>
                <Ionicons name="pause-circle-outline" size={16} color={Colors.severityAmber} />
                <Text style={styles.pausedText}>Transition paused. Tap "Resume" when ready.</Text>
              </View>
            )}

            {/* Today's Mix */}
            <View style={styles.todayCard}>
              <Text style={styles.todaySectionLabel}>TODAY'S MIX</Text>
              <Text style={styles.todayDayText}>Day {currentDay}</Text>

              {/* Proportion bar */}
              <View style={styles.proportionBar}>
                {todayMix.oldPct > 0 && (
                  <View style={[styles.proportionSegment, {
                    flex: todayMix.oldPct,
                    backgroundColor: `${Colors.severityAmber}80`,
                    borderTopLeftRadius: 6,
                    borderBottomLeftRadius: 6,
                  }]} />
                )}
                <View style={[styles.proportionSegment, {
                  flex: todayMix.newPct,
                  backgroundColor: `${Colors.severityGreen}80`,
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                  ...(todayMix.oldPct === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }),
                }]} />
              </View>

              <View style={styles.proportionLabels}>
                {todayMix.oldPct > 0 && (
                  <Text style={styles.proportionLabel}>{oldCups} cups {truncate(oldName, 15)}</Text>
                )}
                <Text style={styles.proportionRatio}>
                  {todayMix.newPct === 100 ? '100%' : `${todayMix.oldPct}% / ${todayMix.newPct}%`}
                </Text>
                <Text style={styles.proportionLabel}>{newCups} cups {truncate(newName, 15)}</Text>
              </View>

              <Text style={styles.mixInstruction}>
                {todayMix.newPct === 100
                  ? `Serve 100% ${truncate(newName, 25)} in ${petName}'s bowl`
                  : `Mix both foods together in ${petName}'s bowl`}
              </Text>
            </View>

            {/* Upset advisory (D-095 compliant) */}
            {showUpsetAdvisory && (
              <View style={styles.advisoryCard}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.severityAmber} />
                <Text style={styles.advisoryText}>
                  {petName} has shown signs of digestive upset recently. Some pets need more time adjusting to new foods. Consider pausing the transition and consulting your veterinarian.
                </Text>
              </View>
            )}

            {/* Tummy Check */}
            <View style={styles.tummyCard}>
              <Text style={styles.tummySectionLabel}>TUMMY CHECK</Text>
              <Text style={styles.tummyTitle}>How was {petName}'s digestion today?</Text>

              <View style={styles.tummyOptions}>
                {TUMMY_OPTIONS.map(opt => {
                  const isSelected = todayLog?.tummy_check === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.tummyPill,
                        isSelected && { backgroundColor: `${opt.color}25`, borderColor: opt.color },
                      ]}
                      onPress={() => handleTummyCheck(opt.key)}
                      disabled={tummyLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={opt.icon} size={18} color={isSelected ? opt.color : Colors.textSecondary} />
                      <Text style={[styles.tummyPillText, isSelected && { color: opt.color }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Timeline */}
            <Text style={[styles.todaySectionLabel, { marginHorizontal: 0, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
              {data.switch.total_days}-DAY TIMELINE
            </Text>

            <View style={styles.timeline}>
              {schedule.map((entry) => {
                const log = logs.find(l => l.day_number === entry.day);
                const isToday = entry.day === currentDay;
                const isPast = entry.day < currentDay;
                const isFuture = entry.day > currentDay;

                return (
                  <View key={entry.day} style={styles.timelineRow}>
                    {/* Dot */}
                    <View style={styles.timelineDotCol}>
                      <View style={[
                        styles.timelineDot,
                        isPast && log?.tummy_check && { backgroundColor: Colors.severityGreen },
                        isToday && { backgroundColor: Colors.accent, width: 12, height: 12, borderRadius: 6 },
                        isFuture && { backgroundColor: Colors.cardBorder },
                      ]}>
                        {isPast && log?.tummy_check && (
                          <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                        )}
                      </View>
                      {entry.day < data.switch.total_days && (
                        <View style={[styles.timelineLine, isFuture && { backgroundColor: Colors.cardBorder }]} />
                      )}
                    </View>

                    {/* Content */}
                    <View style={[styles.timelineContent, isToday && styles.timelineContentActive]}>
                      <Text style={[
                        styles.timelineDay,
                        isToday && { color: Colors.accent, fontWeight: '700' },
                        isFuture && { color: Colors.textTertiary },
                      ]}>
                        Day {entry.day}: {entry.phase}
                      </Text>
                      {isToday && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              {isFinalDay && todayLogged && (
                <TouchableOpacity style={styles.completeButton} onPress={handleComplete} activeOpacity={0.7}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.completeButtonText}>Complete Switch</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={handlePauseResume} activeOpacity={0.7}>
                <Ionicons
                  name={isPaused ? 'play-outline' : 'pause-outline'}
                  size={16}
                  color={Colors.textSecondary}
                />
                <Text style={styles.actionButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleCancel} activeOpacity={0.7}>
                <Ionicons name="close-outline" size={16} color={Colors.severityRed} />
                <Text style={[styles.actionButtonText, { color: Colors.severityRed }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },

  // Completed state
  completedCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: Spacing.lg,
  },
  completedTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.severityGreen },
  completedBody: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  doneButton: {
    marginTop: 16,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  doneButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: '#FFFFFF' },

  // Comparison
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: Spacing.sm,
  },
  comparisonProduct: { flex: 1, alignItems: 'center', gap: 6, minHeight: 100 },
  comparisonImage: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.cardBorder },
  comparisonImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  comparisonName: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', minHeight: 28 },
  miniScoreBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniScoreText: { fontSize: 10, fontWeight: '700' },
  switchingForText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // Paused
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.severityAmber}15`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  pausedText: { flex: 1, fontSize: FontSizes.sm, color: Colors.severityAmber, lineHeight: 18 },

  // Today's mix
  todayCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.accent}25`,
    gap: 8,
  },
  todaySectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  todayDayText: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },
  proportionBar: { flexDirection: 'row', height: 10, borderRadius: 5 },
  proportionSegment: { height: 10 },
  proportionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proportionLabel: { fontSize: 11, color: Colors.textSecondary },
  proportionRatio: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  mixInstruction: { fontSize: FontSizes.sm, color: Colors.textTertiary, lineHeight: 18 },

  // Advisory
  advisoryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.severityAmber}10`,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.severityAmber}30`,
  },
  advisoryText: { flex: 1, fontSize: FontSizes.sm, color: Colors.severityAmber, lineHeight: 20 },

  // Tummy Check
  tummyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  tummySectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  tummyTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textPrimary },
  tummyOptions: { flexDirection: 'row', gap: 8 },
  tummyPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.cardBorder,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tummyPillText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },

  // Timeline
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', minHeight: 36 },
  timelineDotCol: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.textTertiary,
    opacity: 0.3,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  timelineContentActive: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: `${Colors.accent}10`,
    borderRadius: 8,
    marginLeft: 4,
  },
  timelineDay: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  activeBadge: {
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.accent, letterSpacing: 0.5 },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.xl,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  completeButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: '#FFFFFF' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionButtonText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },
});
