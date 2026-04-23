// Kiba — Safe Switch Detail Screen (M7 → M9 Premium Polish)
// Daily command center: today's mix, tummy check logger, 7-day timeline, actions.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import {
  getAmountSplit,
  shouldShowUpsetAdvisory,
  shouldShowConsecutiveMissedWarning,
  computeSwitchOutcome,
  getOutcomeMessage,
} from '../utils/safeSwitchHelpers';
import {
  getActiveSwitchForPet,
  logTummyCheck,
  completeSafeSwitch,
  cancelSafeSwitch,
  pauseSafeSwitch,
  resumeSafeSwitch,
  restartSafeSwitch,
} from '../services/safeSwitchService';
import { rescheduleAllSafeSwitchNotifications, cancelAllSafeSwitchNotifications } from '../services/safeSwitchNotificationScheduler';
import { rescheduleAllFeeding } from '../services/feedingNotificationScheduler';
import { saveSuccess } from '../utils/haptics';
import { useActivePetStore } from '../stores/useActivePetStore';
import { supabase } from '../services/supabase';
import type { PantryStackParamList } from '../types/navigation';
import type { SafeSwitchCardData, TummyCheck } from '../types/safeSwitch';
import ComparisonCard from '../components/safeSwitch/ComparisonCard';
import CompletedCard from '../components/safeSwitch/CompletedCard';
import MissedWarningBanner from '../components/safeSwitch/MissedWarningBanner';
import TodayMixCard from '../components/safeSwitch/TodayMixCard';
import RetroLogSheet from '../components/safeSwitch/RetroLogSheet';

type Props = NativeStackScreenProps<PantryStackParamList, 'SafeSwitchDetail'>;

// ─── Tummy Check Config ─────────────────────────────────

const TUMMY_OPTIONS: { key: TummyCheck; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'perfect', label: 'Perfect', icon: 'checkmark-circle-outline', color: Colors.severityGreen },
  { key: 'soft_stool', label: 'Soft Stool', icon: 'remove-circle-outline', color: Colors.severityAmber },
  { key: 'upset', label: 'Upset', icon: 'alert-circle-outline', color: Colors.severityRed },
];

// Result indicator colors for completed timeline dots
const TUMMY_RESULT_COLORS: Record<string, string> = {
  perfect: Colors.severityGreen,
  soft_stool: Colors.severityAmber,
  upset: Colors.severityRed,
};

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
  const [retroDay, setRetroDay] = useState<number | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Animated dot for today's completion celebration
  const dotScale = useRef(new Animated.Value(1)).current;
  const prevTodayLogged = useRef(false);

  // ── Hide tab bar (CompareScreen pattern) ──
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

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

  // ── Celebration animation when today's tummy check is logged ──
  // Haptic now fires immediately in handleTummyCheck (optimistic); this effect
  // only drives the dot scale animation.
  useEffect(() => {
    if (data?.todayLogged && !prevTodayLogged.current) {
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    prevTodayLogged.current = data?.todayLogged ?? false;
  }, [data?.todayLogged, dotScale]);

  const pet = data ? pets.find(p => p.id === data.switch.pet_id) : null;
  const petName = pet?.name ?? 'Your pet';

  // ── Tummy check handler (optimistic) ──
  // Fires haptic + updates UI immediately, then upserts in the background.
  // Reverts on failure so the user sees the error state.
  const handleTummyCheck = useCallback(async (check: TummyCheck, dayNumber?: number) => {
    if (!data) return;
    const targetDay = dayNumber ?? data.currentDay;

    // 1. Immediate haptic feedback
    saveSuccess();

    // 2. Optimistic state update — show the pill as selected before the server responds
    const prevData = data;
    const updatedLogs = [...data.logs];
    const existingIdx = updatedLogs.findIndex(l => l.day_number === targetDay);
    const optimisticLog = {
      id: `optimistic-${targetDay}`,
      switch_id: data.switch.id,
      day_number: targetDay,
      tummy_check: check,
      logged_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      updatedLogs[existingIdx] = optimisticLog;
    } else {
      updatedLogs.push(optimisticLog);
    }
    setData({
      ...data,
      logs: updatedLogs,
      todayLogged: !dayNumber ? true : data.todayLogged,
    });

    // 3. Close retro sheet immediately (feels instant)
    if (dayNumber) setRetroDay(null);

    // 4. Background upsert — revert on failure
    try {
      await logTummyCheck(data.switch.id, targetDay, check);
    } catch (e) {
      setData(prevData); // Revert
      Alert.alert('Error', (e as Error).message || 'Failed to log tummy check.');
    }
  }, [data]);

  // ── Complete handler ──
  // Do NOT call loadData() after completion: getActiveSwitchForPet filters by
  // status IN ('active', 'paused'), so reloading would return null and flash
  // the empty state over the outcome card. The in-memory `data` snapshot
  // already has everything the completed card needs (logs, products, totals).
  //
  // M9 Phase B: completeSafeSwitch now atomically swaps the anchored pantry
  // item's product_id via the complete_safe_switch_with_pantry_swap RPC.
  // We call rescheduleAllFeeding() afterwards so the existing feeding reminder
  // scheduler picks up the new product (the pantry_item.id is unchanged, only
  // its product_id flipped, so feeding reminders auto-resync naturally).
  const handleComplete = useCallback(async () => {
    if (!data) return;
    try {
      await completeSafeSwitch(data.switch.id);
      await cancelAllSafeSwitchNotifications();
      await rescheduleAllFeeding();
      setIsCompleted(true);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, [data]);

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

  // ── Dev-only: backdate started_at by 1 day (rolls currentDay forward) ──
  // Stripped from production builds via __DEV__ global. See .agent/design.md for dev tooling guidance.
  const handleDevAdvanceDay = useCallback(async () => {
    if (!data) return;
    try {
      const current = new Date(data.switch.started_at + 'T00:00:00');
      const backdated = new Date(current);
      backdated.setDate(backdated.getDate() - 1);
      const newStartedAt = backdated.toISOString().slice(0, 10); // YYYY-MM-DD

      const { error } = await supabase
        .from('safe_switches')
        .update({ started_at: newStartedAt })
        .eq('id', data.switch.id);

      if (error) throw error;
      await loadData();
    } catch (e) {
      Alert.alert('Dev', (e as Error).message || 'Failed to advance day.');
    }
  }, [data, loadData]);

  // ── Restart handler (for missed days warning) ──
  const handleRestart = useCallback(async () => {
    if (!data) return;
    try {
      const newSw = await restartSafeSwitch(data.switch.id);
      await rescheduleAllSafeSwitchNotifications();
      // Navigate to the new switch detail
      navigation.replace('SafeSwitchDetail', { switchId: newSw.id });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }, [data, navigation]);

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
  const showMissedWarning = !warningDismissed && shouldShowConsecutiveMissedWarning(logs, currentDay);

  // Completion outcome (Phase A) — cheap pure computation, used only when isCompleted
  const outcome = computeSwitchOutcome(logs, data.switch.total_days);
  const outcomeMessage = getOutcomeMessage(outcome, petName, `${newProduct.brand} ${newName}`);

  const oldTotal = data.dailyServingAmount;
  const newTotal = data.switch.new_serving_size
    ? data.switch.new_serving_size * (data.switch.new_feedings_per_day ?? 1)
    : oldTotal;
  const { oldAmount, newAmount } = getAmountSplit(oldTotal, newTotal, todayMix.oldPct, todayMix.newPct);

  const formatUnit = (amount: number, unit: string) => {
    if (amount <= 1) {
      if (unit.endsWith('ches')) return unit.slice(0, -2);
      if (unit.endsWith('s')) return unit.slice(0, -1);
    }
    return unit;
  };
  const oldUnitStr = formatUnit(oldAmount, data.dailyServingUnit);
  const newUnitStr = formatUnit(newAmount, data.switch.new_serving_size_unit ?? data.dailyServingUnit);

  // Today's tummy check value
  const todayLog = logs.find(l => l.day_number === currentDay);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — Fix 5: "{petName}'s Safe Switch" */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{petName}'s Safe Switch</Text>
          <Text style={styles.headerSubtitle}>Day {currentDay} of {data.switch.total_days}</Text>
        </View>
        {__DEV__ ? (
          <TouchableOpacity
            onPress={handleDevAdvanceDay}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
          >
            <Text style={styles.devButton}>DEV +1D</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Completed state — outcome-aware (Phase A) */}
        {isCompleted && (
          <CompletedCard
            outcome={outcome}
            outcomeMessage={outcomeMessage}
            onBack={() => navigation.goBack()}
          />
        )}

        {!isCompleted && (
          <>
            {/* Product comparison header — Fix 3: Image staging, Fix 4: Old score deleted */}
            <ComparisonCard
              oldProduct={oldProduct}
              newProduct={newProduct}
              newScore={data.newScore}
            />

            {/* Paused banner */}
            {isPaused && (
              <View style={styles.pausedBanner}>
                <Ionicons name="pause-circle-outline" size={16} color={Colors.severityAmber} />
                <Text style={styles.pausedText}>Transition paused. Tap "Resume" when ready.</Text>
              </View>
            )}

            {/* Consecutive missed days warning — Fix 9 */}
            {showMissedWarning && (
              <MissedWarningBanner
                onRestart={handleRestart}
                onDismiss={() => setWarningDismissed(true)}
              />
            )}

            {/* Today's Mix — Fix 1: Vertical recipe layout */}
            <TodayMixCard
              currentDay={currentDay}
              todayMix={todayMix}
              oldProduct={oldProduct}
              newProduct={newProduct}
              oldName={oldName}
              newName={newName}
              oldAmount={oldAmount}
              newAmount={newAmount}
              oldUnitStr={oldUnitStr}
              newUnitStr={newUnitStr}
              petName={petName}
            />

            {/* Upset advisory (D-095 compliant) */}
            {showUpsetAdvisory && (
              <View style={styles.advisoryCard}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.severityAmber} />
                <Text style={styles.advisoryText}>
                  {petName} has shown signs of digestive upset recently. Some pets need more time adjusting to new foods. Consider pausing the transition and consulting your veterinarian.
                </Text>
              </View>
            )}

            {/* Tummy Check — Fix 2: Premium hardware buttons */}
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
                        isSelected && {
                          backgroundColor: `${opt.color}25`,
                          borderColor: opt.color,
                        },
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

            {/* Timeline — Fix 6: 4-state architecture, Fix 7: missed dimming + result indicators */}
            <Text style={[styles.todaySectionLabel, { marginHorizontal: 0, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
              {data.switch.total_days}-DAY TIMELINE
            </Text>

            <View style={styles.timeline}>
              {schedule.map((entry) => {
                const log = logs.find(l => l.day_number === entry.day);
                const isToday = entry.day === currentDay;
                const isPast = entry.day < currentDay;
                const isFuture = entry.day > currentDay;
                const isMissed = isPast && !log?.tummy_check;
                const isLogged = isPast && !!log?.tummy_check;

                return (
                  <TouchableOpacity
                    key={entry.day}
                    style={styles.timelineRow}
                    disabled={isFuture || isToday}
                    onPress={() => {
                      if (isMissed) setRetroDay(entry.day);
                      // Completed rows — show read-only view (uses same sheet)
                      if (isLogged) setRetroDay(entry.day);
                    }}
                    activeOpacity={isPast ? 0.7 : 1}
                  >
                    {/* Dot */}
                    <View style={styles.timelineDotCol}>
                      {isToday ? (
                        <Animated.View style={[
                          styles.timelineDot,
                          {
                            backgroundColor: todayLogged ? Colors.severityGreen : Colors.accent,
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            transform: [{ scale: dotScale }],
                          },
                        ]}>
                          {todayLogged && (
                            <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                          )}
                        </Animated.View>
                      ) : (
                        <View style={[
                          styles.timelineDot,
                          // Completed: green with checkmark
                          isLogged && { backgroundColor: Colors.severityGreen },
                          // Missed: hollow ring
                          isMissed && {
                            backgroundColor: 'transparent',
                            borderWidth: 1.5,
                            borderColor: Colors.textTertiary,
                          },
                          // Future: solid muted dot
                          isFuture && { backgroundColor: Colors.hairlineBorder },
                        ]}>
                          {isLogged && (
                            <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                          )}
                        </View>
                      )}
                      {entry.day < data.switch.total_days && (
                        <View style={[
                          styles.timelineLine,
                          isFuture && { backgroundColor: Colors.hairlineBorder },
                        ]} />
                      )}
                    </View>

                    {/* Content */}
                    <View style={[styles.timelineContent, isToday && styles.timelineContentActive]}>
                      <Text style={[
                        styles.timelineDay,
                        isToday && { color: Colors.accent, fontWeight: '700' },
                        isFuture && { color: Colors.textTertiary },
                        isMissed && { color: Colors.textTertiary },
                      ]}>
                        Day {entry.day}: {entry.phase}{isMissed ? ' (Missed)' : ''}
                      </Text>
                      {/* Result indicator for completed days */}
                      {isLogged && log?.tummy_check && (
                        <View style={[styles.resultIndicator, { backgroundColor: TUMMY_RESULT_COLORS[log.tummy_check] ?? Colors.textTertiary }]} />
                      )}
                      {isToday && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                      {/* Chevron for tappable past rows */}
                      {isPast && (
                        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginLeft: 'auto' }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom actions: primary CTA + text links */}
            <View style={styles.bottomActions}>
              {isFinalDay && todayLogged ? (
                /* Final day + logged → "Complete Switch" is the primary action */
                <TouchableOpacity style={styles.completeButton} onPress={handleComplete} activeOpacity={0.7}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.completeButtonText}>Complete Switch</Text>
                </TouchableOpacity>
              ) : (
                /* Non-final day (or final day not yet logged) → "Done" exit button.
                   Accent when tummy check is logged (positive reinforcement),
                   muted when not yet logged (user can still leave freely). */
                <TouchableOpacity
                  style={[styles.doneButton, todayLogged && styles.doneButtonActive]}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  {todayLogged && (
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  )}
                  <Text style={[styles.doneButtonText, todayLogged && styles.doneButtonTextActive]}>
                    {todayLogged ? 'Done for today' : 'Done'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.textActionsRow}>
                <TouchableOpacity onPress={handlePauseResume} activeOpacity={0.7}>
                  <Text style={styles.textAction}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.textActionSep}>·</Text>
                <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
                  <Text style={[styles.textAction, { color: Colors.severityRed }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Retroactive logging / history bottom sheet — Fix 8 */}
      <RetroLogSheet
        retroDay={retroDay}
        logs={logs}
        schedule={schedule}
        petName={petName}
        tummyLoading={tummyLoading}
        onLog={handleTummyCheck}
        onClose={() => setRetroDay(null)}
      />
    </View>
  );
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
  devButton: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.severityAmber,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.severityAmber,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },

  // Completed state

  // Comparison — Fix 3: image staging, Fix 4: centered score, Fix 14: token migration

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

  // Missed days warning — Fix 9

  // Today's mix — featured card with full cyan frame (thicker than standard hairline)
  todaySectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5,
  },

  // Proportion gauge — fully saturated, taller, inline labels

  // Fix 1: Vertical recipe layout

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

  // Tummy Check — Fix 2, Fix 14
  tummyCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',  // B1: nested-card lift precedent
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tummyPillText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },

  // Timeline — Fix 6, Fix 14
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
  // Fix 7: Result indicator dot for completed timeline rows
  resultIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeBadge: {
    backgroundColor: `${Colors.accent}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.accent, letterSpacing: 0.5 },

  // Fix 11: Bottom actions — text links
  bottomActions: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  completeButtonText: { fontSize: FontSizes.lg, fontWeight: '700', color: '#FFFFFF' },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    backgroundColor: Colors.cardSurface,
  },
  doneButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  doneButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  doneButtonTextActive: {
    color: '#FFFFFF',
  },
  textActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: Spacing.sm,
  },
  textAction: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  textActionSep: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },

  // Fix 8: Bottom sheet — canonical spec from .agent/design.md:307-365
});
