// ScoreRing — SVG-based circular score gauge (D-094, D-136).
// 360° full circle for daily food/treats. 270° open arc for supplementals.
// D-084: zero emoji. D-094: score always shown with pet context.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontSizes,
  getScoreColor as _getScoreColor,
  getVerdictLabel as _getVerdictLabel,
} from '../utils/constants';

// Re-export from canonical source (constants.ts)
export const getScoreColor = _getScoreColor;
export const getVerdictLabel = _getVerdictLabel;

// ─── Props ───────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  petName: string;
  petPhotoUri: string | null;
  species: 'dog' | 'cat';
  isPartialScore: boolean;
  isSupplemental?: boolean;
}

// ─── Constants ───────────────────────────────────────────

const RING_SIZE = 180;
const RING_BORDER = 8;
const CENTER = RING_SIZE / 2;
const RADIUS = (RING_SIZE - RING_BORDER) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_270 = CIRCUMFERENCE * 0.75;
const TRACK_COLOR = '#333333';
const ANIMATION_DURATION = 800;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────

export function ScoreRing({
  score,
  petName,
  petPhotoUri,
  species,
  isPartialScore,
  isSupplemental = false,
}: ScoreRingProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const displayName = petName || (species === 'dog' ? 'your dog' : 'your cat');
  const ringColor = getScoreColor(score, isSupplemental);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: score,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  const showDisclaimer = () => {
    Alert.alert(
      'About this score',
      `Suitability is an algorithmic estimate for ${displayName}'s specific profile based on published research. It is not a universal product rating or a substitute for veterinary medical advice.`,
    );
  };

  // ─── SVG arc calculations ────────────────────────────
  const totalArc = isSupplemental ? ARC_270 : CIRCUMFERENCE;
  // 360°: start at 12 o'clock (-90° from SVG default 3 o'clock)
  // 270°: start at 7:30 position (135° from SVG default) — gap at bottom
  const rotation = isSupplemental ? 135 : -90;

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [totalArc, 0],
    extrapolate: 'clamp',
  });

  const trackDasharray = isSupplemental
    ? [ARC_270, CIRCUMFERENCE]
    : [CIRCUMFERENCE];

  return (
    <View style={styles.wrapper}>
      {/* Score Ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Background track */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={TRACK_COLOR}
            strokeWidth={RING_BORDER}
            fill="none"
            strokeDasharray={trackDasharray}
            rotation={rotation}
            origin={`${CENTER}, ${CENTER}`}
            strokeLinecap="round"
          />
          {/* Animated fill */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={RING_BORDER}
            fill="none"
            strokeDasharray={trackDasharray}
            strokeDashoffset={strokeDashoffset}
            rotation={rotation}
            origin={`${CENTER}, ${CENTER}`}
            strokeLinecap="round"
          />
        </Svg>

        {/* Center content */}
        <View style={styles.centerContent}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: ringColor }]}>
              {score}
            </Text>
            <Text style={[styles.scorePercent, { color: ringColor }]}>%</Text>
            <TouchableOpacity
              onPress={showDisclaimer}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.infoButton}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.matchLabel}>match for {displayName}</Text>
        </View>

        {/* Pet photo */}
        <View style={styles.petPhotoContainer}>
          {petPhotoUri ? (
            <Image source={{ uri: petPhotoUri }} style={styles.petPhoto} />
          ) : (
            <View style={styles.petPhotoPlaceholder}>
              <Ionicons name="paw-outline" size={18} color={Colors.textSecondary} />
            </View>
          )}
        </View>
      </View>

      {/* Partial score badge */}
      {isPartialScore && (
        <View style={styles.partialBadge}>
          <Text style={styles.partialLabel}>Partial</Text>
          <Text style={styles.partialSubtext}>
            Nutritional data unavailable
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '800',
  },
  scorePercent: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 1,
  },
  infoButton: {
    marginLeft: 4,
    marginBottom: 6,
  },
  matchLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  petPhotoContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  petPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  petPhotoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partialBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  partialLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.severityAmber,
  },
  partialSubtext: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
