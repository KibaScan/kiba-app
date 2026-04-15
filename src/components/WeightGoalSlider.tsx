// WeightGoalSlider — D-160 discrete 7-position weight goal slider.
// Swipeable with haptic detent feedback. Tap fallback on dots.
// Cats: 6 positions (-2 to +3), -3 physically absent (D-062 hepatic lipidosis).
// Blocked positions: skipped during drag, grayed out visually.
// Premium gate via canUseGoalWeight(). D-095: "estimated daily intake target".

import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { Pet } from '../types/pet';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canUseGoalWeight } from '../utils/permissions';
import { sliderDetent } from '../utils/haptics';
import {
  ALL_LEVELS,
  WEIGHT_GOAL_LABELS,
  getAvailableLevels,
  getCalorieContext,
  estimateWeeklyChange,
  getAdjustedDER,
} from '../utils/weightGoal';

const KNOB_SIZE = 40;
const DOT_SIZE = 28;
const SPRING_CONFIG = { damping: 18, stiffness: 180, mass: 0.5 };

interface WeightGoalSliderProps {
  pet: Pet;
  baseDER: number;
  conditions: string[];
  onLevelChange: (level: number) => void;
}

export default function WeightGoalSlider({ pet, baseDER, conditions, onLevelChange }: WeightGoalSliderProps) {
  const currentLevel = (pet.weight_goal_level ?? 0) as typeof ALL_LEVELS[number];
  const premium = canUseGoalWeight();

  const availableLevels = useMemo(
    () => getAvailableLevels(pet.species, conditions),
    [pet.species, conditions],
  );

  const visibleLevels = useMemo(
    () => (pet.species === 'cat' ? ALL_LEVELS.filter((l) => l !== -3) : [...ALL_LEVELS]),
    [pet.species],
  );

  const calorieCtx = useMemo(
    () => getCalorieContext(baseDER, currentLevel),
    [baseDER, currentLevel],
  );

  const weeklyChange = useMemo(() => {
    const adjustedDER = getAdjustedDER(baseDER, currentLevel);
    return estimateWeeklyChange(baseDER, adjustedDER, pet.species);
  }, [baseDER, currentLevel, pet.species]);

  // ─── Gesture state ──────────────────────────────────────
  const trackWidth = useSharedValue(0);
  const knobX = useSharedValue(0);
  const lastDetentIndex = useSharedValue(-1);
  const startX = useSharedValue(0);

  // Convert level to detent index within visibleLevels
  const levelToIndex = useCallback(
    (level: number) => visibleLevels.indexOf(level as typeof ALL_LEVELS[number]),
    [visibleLevels],
  );

  const indexToX = useCallback(
    (index: number) => {
      const count = visibleLevels.length;
      if (count <= 1) return 0;
      return (index / (count - 1)) * trackWidth.value;
    },
    [visibleLevels.length, trackWidth],
  );

  // Sync knob to current level on mount and external changes
  useEffect(() => {
    const idx = levelToIndex(currentLevel);
    if (idx >= 0 && trackWidth.value > 0) {
      knobX.value = withSpring(indexToX(idx), SPRING_CONFIG);
      lastDetentIndex.value = idx;
    }
  }, [currentLevel, trackWidth.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidth.value = w;
    const idx = levelToIndex(currentLevel);
    if (idx >= 0) {
      const count = visibleLevels.length;
      knobX.value = count <= 1 ? 0 : (idx / (count - 1)) * w;
      lastDetentIndex.value = idx;
    }
  }, [currentLevel, visibleLevels.length, levelToIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared value for detent count (used inside worklets)
  const detentCount = useSharedValue(visibleLevels.length);
  useEffect(() => {
    detentCount.value = visibleLevels.length;
  }, [visibleLevels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snap to nearest available detent + commit (runs on JS thread via runOnJS)
  const snapAndCommit = useCallback(
    (rawX: number) => {
      const count = visibleLevels.length;
      if (count <= 1 || trackWidth.value <= 0) return;
      const ratio = Math.max(0, Math.min(1, rawX / trackWidth.value));
      const rawIdx = Math.round(ratio * (count - 1));

      // Find nearest available index
      let snapIdx = rawIdx;
      const level = visibleLevels[rawIdx];
      if (level === undefined || !availableLevels.includes(level) || (!premium && level !== 0)) {
        // Search outward for nearest available
        snapIdx = levelToIndex(0); // fallback: maintain
        for (let d = 1; d < count; d++) {
          for (const dir of [-d, d]) {
            const i = rawIdx + dir;
            if (i >= 0 && i < count) {
              const l = visibleLevels[i];
              if (availableLevels.includes(l) && (premium || l === 0)) {
                snapIdx = i;
                d = count; // break outer
                break;
              }
            }
          }
        }
      }

      const targetX = count <= 1 ? 0 : (snapIdx / (count - 1)) * trackWidth.value;
      knobX.value = withSpring(targetX, SPRING_CONFIG);
      lastDetentIndex.value = snapIdx;

      const snappedLevel = visibleLevels[snapIdx];
      if (snappedLevel !== undefined && snappedLevel !== currentLevel) {
        onLevelChange(snappedLevel);
      }
    },
    [visibleLevels, availableLevels, premium, levelToIndex, currentLevel, onLevelChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Pan gesture ────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startX.value = knobX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const rawX = Math.max(0, Math.min(startX.value + e.translationX, trackWidth.value));
      knobX.value = rawX;

      // Inline nearest detent calc (pure math on shared values)
      const count = detentCount.value;
      if (count > 1 && trackWidth.value > 0) {
        const ratio = Math.max(0, Math.min(1, rawX / trackWidth.value));
        const idx = Math.round(ratio * (count - 1));
        if (idx !== lastDetentIndex.value) {
          lastDetentIndex.value = idx;
          runOnJS(sliderDetent)();
        }
      }
    })
    .onEnd(() => {
      'worklet';
      // Snap logic runs on JS thread (needs access to availableLevels array)
      runOnJS(snapAndCommit)(knobX.value);
    })
    .minDistance(0)
    .activeOffsetX([-5, 5]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value - KNOB_SIZE / 2 }],
  }));

  // ─── Tap handler (fallback) ─────────────────────────────
  const handleTap = (level: number) => {
    if (!premium && level !== 0) {
      Alert.alert('Premium Feature', 'Weight goal adjustment is available with Kiba Premium.');
      return;
    }
    if (!availableLevels.includes(level)) {
      const reason = conditions.includes('obesity')
        ? 'overweight'
        : conditions.includes('underweight')
          ? 'underweight'
          : '';
      Alert.alert(
        'Not Available',
        `Not available \u2014 ${pet.name} is marked as ${reason} in their health profile.`,
      );
      return;
    }
    sliderDetent();
    const idx = levelToIndex(level);
    if (idx >= 0) {
      knobX.value = withSpring(indexToX(idx), SPRING_CONFIG);
      lastDetentIndex.value = idx;
    }
    onLevelChange(level);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Weight Goal</Text>
        {!premium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="lock-closed" size={10} color={Colors.accent} />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        )}
      </View>

      {/* Slider track */}
      <View style={styles.trackContainer}>
        <View style={styles.track} onLayout={handleLayout}>
          {/* Rail */}
          <View style={styles.rail} />

          {/* Detent dots */}
          {visibleLevels.map((level, i) => {
            const isAvailable = availableLevels.includes(level);
            const isBlocked = !isAvailable;
            const isLocked = !premium && level !== 0;
            const pct = visibleLevels.length <= 1 ? 0 : (i / (visibleLevels.length - 1)) * 100;

            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.dotTouchable,
                  { left: `${pct}%` },
                ]}
                onPress={() => handleTap(level)}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.dot,
                    (isBlocked || isLocked) && styles.dotBlocked,
                  ]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Animated knob */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.knob, knobStyle]}>
              <Text style={styles.knobLabel}>
                {currentLevel > 0 ? `+${currentLevel}` : String(currentLevel)}
              </Text>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Detent labels below track */}
        <View style={styles.labelRow}>
          {visibleLevels.map((level, i) => {
            const pct = visibleLevels.length <= 1 ? 0 : (i / (visibleLevels.length - 1)) * 100;
            return (
              <Text
                key={level}
                style={[
                  styles.detentLabel,
                  { left: `${pct}%` },
                ]}
              >
                {level > 0 ? `+${level}` : String(level)}
              </Text>
            );
          })}
        </View>
      </View>

      {/* Active position label */}
      <Text style={styles.levelLabel}>{WEIGHT_GOAL_LABELS[currentLevel]}</Text>

      {/* Live calorie context */}
      <Text style={styles.calorieContext}>{calorieCtx.label}</Text>

      {/* Weekly change estimate */}
      {weeklyChange.direction !== 'maintain' && (
        <Text style={styles.weeklyChange}>
          {weeklyChange.direction === 'loss'
            ? `Estimated loss rate: ~${weeklyChange.lbs} lbs/week`
            : `Estimated gain rate: ~${weeklyChange.lbs} lbs/week`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accent,
  },
  trackContainer: {
    paddingVertical: Spacing.sm,
  },
  track: {
    height: KNOB_SIZE,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.chipSurface,
    borderRadius: 1.5,
  },
  dotTouchable: {
    position: 'absolute',
    width: DOT_SIZE + 12,
    height: KNOB_SIZE,
    marginLeft: -(DOT_SIZE + 12) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  dot: {
    width: DOT_SIZE / 3,
    height: DOT_SIZE / 3,
    borderRadius: DOT_SIZE / 6,
    backgroundColor: Colors.textTertiary,
  },
  dotBlocked: {
    opacity: 0.25,
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  knobLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  labelRow: {
    height: 18,
    marginTop: 4,
  },
  detentLabel: {
    position: 'absolute',
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
    textAlign: 'center',
    width: 24,
    marginLeft: -12,
  },
  levelLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  calorieContext: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  weeklyChange: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
