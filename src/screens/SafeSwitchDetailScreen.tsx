// Kiba — Safe Switch Detail Screen (M7 → M9 Premium Polish)
// Daily command center: today's mix, tummy check logger, 7-day timeline, actions.
// D-084: Zero emoji — Ionicons only. D-094: Score framing. D-095: UPVM compliant.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, FontSizes, Spacing, getScoreColor } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import {
  getCupSplit,
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
import { saveSuccess } from '../utils/haptics';
import { useActivePetStore } from '../stores/useActivePetStore';
import { supabase } from '../services/supabase';
import type { PantryStackParamList } from '../types/navigation';
import type { SafeSwitchCardData, SwitchOutcome, TummyCheck } from '../types/safeSwitch';

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

// ─── Completion outcome helpers (Phase A) ───────────────

type OutcomeTone = 'good' | 'neutral' | 'caution';

function outcomeToneColor(tone: OutcomeTone): string {
  if (tone === 'good') return Colors.severityGreen;
  if (tone === 'caution') return Colors.severityAmber;
  return Colors.textPrimary;
}

function outcomeToneIcon(tone: OutcomeTone): keyof typeof Ionicons.glyphMap {
  return tone === 'caution' ? 'alert-circle' : 'checkmark-circle';
}

interface OutcomeStatItem {
  label: string;
  count: number;
  dot: string;
}

function buildOutcomeStatItems(outcome: SwitchOutcome): OutcomeStatItem[] {
  const items: OutcomeStatItem[] = [];
  if (outcome.perfectCount > 0) {
    items.push({ label: 'Perfect', count: outcome.perfectCount, dot: Colors.severityGreen });
  }
  if (outcome.softStoolCount > 0) {
    items.push({ label: 'Soft Stool', count: outcome.softStoolCount, dot: Colors.severityAmber });
  }
  if (outcome.upsetCount > 0) {
    items.push({ label: 'Upset', count: outcome.upsetCount, dot: Colors.severityRed });
  }
  if (outcome.missedDays > 0) {
    items.push({ label: 'Missed', count: outcome.missedDays, dot: Colors.textTertiary });
  }
  return items;
}

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
  useEffect(() => {
    if (data?.todayLogged && !prevTodayLogged.current) {
      saveSuccess();
      Animated.sequence([
        Animated.timing(dotScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    prevTodayLogged.current = data?.todayLogged ?? false;
  }, [data?.todayLogged, dotScale]);

  const pet = data ? pets.find(p => p.id === data.switch.pet_id) : null;
  const petName = pet?.name ?? 'Your pet';

  // ── Tummy check handler ──
  const handleTummyCheck = useCallback(async (check: TummyCheck, dayNumber?: number) => {
    if (!data) return;
    setTummyLoading(true);
    try {
      // Retro log uses the supplied dayNumber; current day uses data.currentDay
      await logTummyCheck(data.switch.id, dayNumber ?? data.currentDay, check);
      await loadData(); // Refresh to show updated state
      if (dayNumber) setRetroDay(null); // Close retro sheet
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to log tummy check.');
    } finally {
      setTummyLoading(false);
    }
  }, [data, loadData]);

  // ── Complete handler ──
  // Do NOT call loadData() after completion: getActiveSwitchForPet filters by
  // status IN ('active', 'paused'), so reloading would return null and flash
  // the empty state over the outcome card. The in-memory `data` snapshot
  // already has everything the completed card needs (logs, products, totals).
  const handleComplete = useCallback(async () => {
    if (!data) return;
    try {
      await completeSafeSwitch(data.switch.id);
      await cancelAllSafeSwitchNotifications();
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
  const outcomeStats = buildOutcomeStatItems(outcome);

  const { oldCups, newCups } = getCupSplit(data.dailyCups, todayMix.oldPct, todayMix.newPct);

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
          <View style={styles.completedCard}>
            <Ionicons
              name={outcomeToneIcon(outcomeMessage.tone)}
              size={48}
              color={outcomeToneColor(outcomeMessage.tone)}
            />
            <Text style={[styles.completedTitle, { color: outcomeToneColor(outcomeMessage.tone) }]}>
              {outcomeMessage.title}
            </Text>
            <Text style={styles.completedBody}>{outcomeMessage.body}</Text>

            {/* Stat strip — counts by category, zero counts skipped */}
            {outcomeStats.length > 0 && (
              <View style={styles.completedStats}>
                {outcomeStats.map((stat, i) => (
                  <React.Fragment key={stat.label}>
                    {i > 0 && <Text style={styles.completedStatSep}>·</Text>}
                    <View style={styles.completedStatItem}>
                      <View style={[styles.completedStatDot, { backgroundColor: stat.dot }]} />
                      <Text style={styles.completedStatText}>{stat.count} {stat.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

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
            {/* Product comparison header — Fix 3: Image staging, Fix 4: Old score deleted */}
            <View style={styles.comparisonCard}>
              <View style={styles.comparisonProduct}>
                <View style={styles.imageStage}>
                  {oldProduct.image_url ? (
                    <Image source={{ uri: oldProduct.image_url }} style={styles.comparisonImage} />
                  ) : (
                    <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
                  )}
                </View>
                <Text style={styles.comparisonName} numberOfLines={2}>{oldProduct.brand}</Text>
              </View>

              <View style={styles.comparisonArrowCol}>
                <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} />
                {/* Score badge centered between products — only new product score */}
                {data.newScore != null && (
                  <View style={[styles.miniScoreBadge, { backgroundColor: `${getScoreColor(data.newScore)}33` }]}>
                    <Text style={[styles.miniScoreText, { color: getScoreColor(data.newScore) }]}>
                      {data.newScore}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.comparisonProduct}>
                <View style={styles.imageStage}>
                  {newProduct.image_url ? (
                    <Image source={{ uri: newProduct.image_url }} style={styles.comparisonImage} />
                  ) : (
                    <Ionicons name="cube-outline" size={20} color={Colors.textTertiary} />
                  )}
                </View>
                <Text style={styles.comparisonName} numberOfLines={2}>{newProduct.brand}</Text>
              </View>
            </View>

            {/* Paused banner */}
            {isPaused && (
              <View style={styles.pausedBanner}>
                <Ionicons name="pause-circle-outline" size={16} color={Colors.severityAmber} />
                <Text style={styles.pausedText}>Transition paused. Tap "Resume" when ready.</Text>
              </View>
            )}

            {/* Consecutive missed days warning — Fix 9 */}
            {showMissedWarning && (
              <View style={styles.missedWarningBanner}>
                <Ionicons name="warning-outline" size={18} color={Colors.severityAmber} />
                <View style={styles.missedWarningContent}>
                  <Text style={styles.missedWarningText}>
                    You missed several days of logging. If you haven't been mixing the food as planned, consider restarting the schedule to reduce the risk of digestive discomfort.
                  </Text>
                  <View style={styles.missedWarningActions}>
                    <TouchableOpacity onPress={handleRestart} activeOpacity={0.7}>
                      <Text style={styles.missedWarningActionRestart}>Restart</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setWarningDismissed(true)} activeOpacity={0.7}>
                      <Text style={styles.missedWarningActionDismiss}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Today's Mix — Fix 1: Vertical recipe layout */}
            <View style={styles.todayCard}>
              <Text style={styles.todaySectionLabel}>TODAY'S MIX</Text>
              <Text style={styles.todayDayText}>Day {currentDay}</Text>

              {/* Proportion gauge — fully saturated segments with inline labels */}
              <View style={styles.proportionBar}>
                {todayMix.oldPct > 0 && (
                  <View style={[styles.proportionSegment, {
                    flex: todayMix.oldPct,
                    backgroundColor: Colors.severityAmber,
                  }]}>
                    {todayMix.oldPct >= 18 && (
                      <Text style={styles.proportionLabel}>{todayMix.oldPct}%</Text>
                    )}
                  </View>
                )}
                <View style={[styles.proportionSegment, {
                  flex: todayMix.newPct,
                  backgroundColor: Colors.severityGreen,
                }]}>
                  {todayMix.newPct >= 18 && (
                    <Text style={styles.proportionLabel}>{todayMix.newPct}%</Text>
                  )}
                </View>
              </View>

              {/* Recipe layout — vertical, color-coded to match proportion bar */}
              <View style={styles.recipeLayout}>
                {todayMix.oldPct > 0 && (
                  <View style={styles.recipeLine}>
                    <View style={[styles.recipeDot, { backgroundColor: Colors.severityAmber }]} />
                    <Text style={styles.recipeAmount}>{oldCups} cups ({todayMix.oldPct}%)</Text>
                    <Text style={styles.recipeSep}>·</Text>
                    <Text style={styles.recipeBrand} numberOfLines={1}>{oldProduct.brand}</Text>
                  </View>
                )}
                <View style={styles.recipeLine}>
                  <View style={[styles.recipeDot, { backgroundColor: Colors.severityGreen }]} />
                  <Text style={styles.recipeAmount}>{newCups} cups ({todayMix.newPct}%)</Text>
                  <Text style={styles.recipeSep}>·</Text>
                  <Text style={styles.recipeBrand} numberOfLines={1}>{newProduct.brand}</Text>
                </View>
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

            {/* Fix 11: CTA — "Complete Switch" only on final day, text link actions */}
            <View style={styles.bottomActions}>
              {isFinalDay && todayLogged && (
                <TouchableOpacity style={styles.completeButton} onPress={handleComplete} activeOpacity={0.7}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.completeButtonText}>Complete Switch</Text>
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
      <Modal
        visible={retroDay != null}
        transparent
        animationType="slide"
        onRequestClose={() => setRetroDay(null)}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setRetroDay(null)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.sheetContainer}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {retroDay != null && (() => {
              const retroLog = logs.find(l => l.day_number === retroDay);
              const isReadOnly = !!retroLog?.tummy_check;
              const retroEntry = schedule.find(s => s.day === retroDay);

              return (
                <>
                  <Text style={styles.sheetTitle}>
                    {isReadOnly ? `Day ${retroDay} — Logged` : `Log Day ${retroDay}`}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {retroEntry ? `${retroEntry.phase}` : ''}
                  </Text>
                  <Text style={styles.sheetQuestion}>
                    {isReadOnly
                      ? `${petName}'s digestion on Day ${retroDay}:`
                      : `How was ${petName}'s digestion on Day ${retroDay}?`}
                  </Text>

                  <View style={styles.sheetPills}>
                    {TUMMY_OPTIONS.map(opt => {
                      const isSelected = retroLog?.tummy_check === opt.key;
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
                          onPress={() => {
                            if (!isReadOnly) handleTummyCheck(opt.key, retroDay);
                          }}
                          disabled={isReadOnly || tummyLoading}
                          activeOpacity={isReadOnly ? 1 : 0.7}
                        >
                          <Ionicons name={opt.icon} size={18} color={isSelected ? opt.color : Colors.textSecondary} />
                          <Text style={[styles.tummyPillText, isSelected && { color: opt.color }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {isReadOnly && (
                    <Text style={styles.sheetReadOnlyHint}>
                      Tap a missed day to log retroactively
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
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
  completedCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: Spacing.lg,
  },
  completedTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.severityGreen },
  completedBody: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  completedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  completedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completedStatText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  completedStatSep: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    paddingHorizontal: 2,
  },
  doneButton: {
    marginTop: 16,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  doneButtonText: { fontSize: FontSizes.md, fontWeight: '700', color: '#FFFFFF' },

  // Comparison — Fix 3: image staging, Fix 4: centered score, Fix 14: token migration
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  comparisonProduct: { flex: 1, alignItems: 'center', gap: 6, minHeight: 90 },
  imageStage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonImage: { width: 48, height: 48, borderRadius: 8, resizeMode: 'contain' as const },
  comparisonArrowCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 18,
  },
  comparisonName: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', minHeight: 28 },
  miniScoreBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniScoreText: { fontSize: 10, fontWeight: '700' },

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
  missedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.severityAmber}10`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityAmber,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.severityAmber}30`,
  },
  missedWarningContent: { flex: 1, gap: 10 },
  missedWarningText: { fontSize: FontSizes.sm, color: Colors.severityAmber, lineHeight: 20 },
  missedWarningActions: { flexDirection: 'row', gap: 16 },
  missedWarningActionRestart: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.accent },
  missedWarningActionDismiss: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary },

  // Today's mix — featured card with full cyan frame (thicker than standard hairline)
  todayCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.accent,
    gap: 10,
  },
  todaySectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  todayDayText: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },

  // Proportion gauge — fully saturated, taller, inline labels
  proportionBar: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 2,
  },
  proportionSegment: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  proportionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Fix 1: Vertical recipe layout
  recipeLayout: { gap: 8, marginTop: 2 },
  recipeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recipeDot: { width: 8, height: 8, borderRadius: 4 },
  recipeAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  recipeSep: { fontSize: FontSizes.sm, color: Colors.textTertiary },
  recipeBrand: { fontSize: FontSizes.sm, color: Colors.textSecondary, flex: 1 },

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
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  sheetQuestion: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  sheetPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sheetReadOnlyHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
