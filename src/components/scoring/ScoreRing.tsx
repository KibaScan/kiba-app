// ScoreRing — SVG-based circular score gauge (D-094, D-136).
// 360° full circle for daily food/treats. 270° open arc for supplementals.
// Gaussian blur glow via feGaussianBlur filter — smooth Apple Health halo.
// Ring radius preserved at original size; SVG canvas enlarged for blur headroom.
// Pet photo on arc (44px) with glass frame.
// D-084: zero emoji. D-094: score always shown with pet context.

import React, { useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontSizes,
  getScoreColor as _getScoreColor,
  getVerdictLabel as _getVerdictLabel,
} from '../../utils/constants';

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
  size?: 'large' | 'small';
}

// ─── Ring Geometry ───────────────────────────────────────
// Ring radius PRESERVED at original size. SVG canvas enlarged for blur.

const RING_SIZE = 200;
const RING_BORDER = 8;
const CENTER = RING_SIZE / 2;                           // 100
const RADIUS = (RING_SIZE - RING_BORDER) / 2;            // 96
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_270 = CIRCUMFERENCE * 0.75;
const TRACK_COLOR = Colors.cardBorder;
const ANIMATION_DURATION = 900;

// Enlarged SVG canvas for blur headroom
const SVG_SIZE = RING_SIZE + 52;                        // 252
const SVG_CENTER = SVG_SIZE / 2;                        // 126
const SVG_OFFSET = -(SVG_SIZE - RING_SIZE) / 2;         // -26

// Glow arc parameters (pre-blur)
const GLOW_STROKE = 14;
const GLOW_OPACITY = 0.55;
const GLOW_BLUR_STD = 7;

// Ring outline — thin dark strokes flanking the arc
const OUTLINE_WIDTH = 1;
const OUTLINE_COLOR = '#0D0D0D';
const OUTLINE_INNER_R = RADIUS - RING_BORDER / 2 - OUTLINE_WIDTH / 2;  // just inside track
const OUTLINE_OUTER_R = RADIUS + RING_BORDER / 2 + OUTLINE_WIDTH / 2;  // just outside track

// ─── Small Ring Geometry ────────────────────────────────

const SM_RING_SIZE = 80;
const SM_RING_BORDER = 5;
const SM_RADIUS = (SM_RING_SIZE - SM_RING_BORDER) / 2;     // 37.5
const SM_CIRCUMFERENCE = 2 * Math.PI * SM_RADIUS;
const SM_SVG_SIZE = SM_RING_SIZE + 20;                      // 100
const SM_SVG_CENTER = SM_SVG_SIZE / 2;                      // 50
const SM_SVG_OFFSET = -(SM_SVG_SIZE - SM_RING_SIZE) / 2;    // -10

// ─── Pet Photo (bottom-right corner) ────────────────────

const PHOTO_SIZE = 40;
const PHOTO_BORDER = 3;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────

export function ScoreRing({
  score,
  petName,
  petPhotoUri,
  species,
  isPartialScore,
  isSupplemental = false,
  size = 'large',
}: ScoreRingProps) {
  const isSmall = size === 'small';
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const fullName = petName || (species === 'dog' ? 'your dog' : 'your cat');
  // Inside the ring: first name only — full name shown in verdict below
  const displayName = fullName.split(' ')[0];
  const ringColor = getScoreColor(score, isSupplemental);

  useEffect(() => {
    animatedValue.setValue(0);
    setDisplayScore(0);

    const listenerId = animatedValue.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.timing(animatedValue, {
      toValue: score,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setDisplayScore(score); // ensure exact final value
    });

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  const showDisclaimer = () => {
    Alert.alert(
      'About this score',
      `Suitability is an algorithmic estimate for ${displayName}'s specific profile based on published research. It is not a universal product rating or a substitute for veterinary medical advice.`,
    );
  };

  // ─── Small variant (early return) ─────────────────────
  if (isSmall) {
    const smTotalArc = isSupplemental ? SM_CIRCUMFERENCE * 0.75 : SM_CIRCUMFERENCE;
    const smRotation = isSupplemental ? 135 : -90;
    const smTrackDash = isSupplemental
      ? [SM_CIRCUMFERENCE * 0.75, SM_CIRCUMFERENCE]
      : [SM_CIRCUMFERENCE];
    const smDashoffset = animatedValue.interpolate({
      inputRange: [0, 100],
      outputRange: [smTotalArc, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={smStyles.wrapper}>
        <View style={smStyles.ringContainer}>
          <Svg
            width={SM_SVG_SIZE}
            height={SM_SVG_SIZE}
            style={{ position: 'absolute', left: SM_SVG_OFFSET, top: SM_SVG_OFFSET }}
          >
            <Circle
              cx={SM_SVG_CENTER}
              cy={SM_SVG_CENTER}
              r={SM_RADIUS}
              stroke={TRACK_COLOR}
              strokeWidth={SM_RING_BORDER}
              fill="none"
              strokeDasharray={smTrackDash}
              rotation={smRotation}
              origin={`${SM_SVG_CENTER}, ${SM_SVG_CENTER}`}
              strokeLinecap="round"
            />
            <AnimatedCircle
              cx={SM_SVG_CENTER}
              cy={SM_SVG_CENTER}
              r={SM_RADIUS}
              stroke={ringColor}
              strokeWidth={SM_RING_BORDER}
              fill="none"
              strokeDasharray={smTrackDash}
              strokeDashoffset={smDashoffset}
              rotation={smRotation}
              origin={`${SM_SVG_CENTER}, ${SM_SVG_CENTER}`}
              strokeLinecap="round"
            />
          </Svg>
          <View style={smStyles.centerContent}>
            <Text style={[smStyles.scoreValue, { color: ringColor }]}>
              {displayScore}
            </Text>
          </View>
        </View>
      </View>
    );
  }

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
        {/* SVG canvas enlarged for blur headroom, offset to stay centered */}
        <Svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          style={{ position: 'absolute', left: SVG_OFFSET, top: SVG_OFFSET }}
        >
          {/* Gaussian blur filter definition */}
          <Defs>
            <Filter
              id="glow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <FeGaussianBlur stdDeviation={GLOW_BLUR_STD} />
            </Filter>
          </Defs>

          {/* 1a. Outer outline — thin dark stroke outside track */}
          <Circle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={OUTLINE_OUTER_R}
            stroke={OUTLINE_COLOR}
            strokeWidth={OUTLINE_WIDTH}
            fill="none"
            strokeDasharray={trackDasharray}
            rotation={rotation}
            origin={`${SVG_CENTER}, ${SVG_CENTER}`}
            strokeLinecap="round"
          />
          {/* 1b. Background track */}
          <Circle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={RADIUS}
            stroke={TRACK_COLOR}
            strokeWidth={RING_BORDER}
            fill="none"
            strokeDasharray={trackDasharray}
            rotation={rotation}
            origin={`${SVG_CENTER}, ${SVG_CENTER}`}
            strokeLinecap="round"
          />
          {/* 1c. Inner outline — thin dark stroke inside track */}
          <Circle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={OUTLINE_INNER_R}
            stroke={OUTLINE_COLOR}
            strokeWidth={OUTLINE_WIDTH}
            fill="none"
            strokeDasharray={trackDasharray}
            rotation={rotation}
            origin={`${SVG_CENTER}, ${SVG_CENTER}`}
            strokeLinecap="round"
          />

          {/* 2. Blurred glow arc — smooth Gaussian halo, follows filled portion */}
          <AnimatedCircle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={GLOW_STROKE}
            strokeOpacity={GLOW_OPACITY}
            fill="none"
            strokeDasharray={trackDasharray}
            strokeDashoffset={strokeDashoffset}
            rotation={rotation}
            origin={`${SVG_CENTER}, ${SVG_CENTER}`}
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* 3. Main arc — crisp, full opacity, on top */}
          <AnimatedCircle
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={RING_BORDER}
            fill="none"
            strokeDasharray={trackDasharray}
            strokeDashoffset={strokeDashoffset}
            rotation={rotation}
            origin={`${SVG_CENTER}, ${SVG_CENTER}`}
            strokeLinecap="round"
          />
        </Svg>

        {/* Center content — positioned relative to layout container */}
        <View style={styles.centerContent}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: ringColor }]}>
              {displayScore}
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
          <Text style={styles.matchLabel} numberOfLines={1}>
            match for {displayName}
          </Text>
        </View>

        {/* Pet photo — bottom-right corner with glow + glass backing */}
        <View style={styles.petPhotoOuter}>
          {/* Photo glow — same feGaussianBlur technique as ring */}
          <Svg
            width={PHOTO_SIZE + PHOTO_BORDER * 2 + 24}
            height={PHOTO_SIZE + PHOTO_BORDER * 2 + 24}
            style={styles.petGlowSvg}
          >
            <Defs>
              <Filter id="photoGlow" x="-50%" y="-50%" width="200%" height="200%">
                <FeGaussianBlur stdDeviation={5} />
              </Filter>
            </Defs>
            <Circle
              cx={(PHOTO_SIZE + PHOTO_BORDER * 2 + 24) / 2}
              cy={(PHOTO_SIZE + PHOTO_BORDER * 2 + 24) / 2}
              r={PHOTO_SIZE / 2}
              fill={ringColor}
              fillOpacity={0.45}
              filter="url(#photoGlow)"
            />
          </Svg>
          <View style={styles.petPhotoContainer}>
            <BlurView intensity={30} tint="dark" style={styles.petGlassBg}>
              {petPhotoUri ? (
                <Image source={{ uri: petPhotoUri }} style={styles.petPhoto} />
              ) : (
                <View style={styles.petPhotoPlaceholder}>
                  <Ionicons name="paw-outline" size={18} color={Colors.textSecondary} />
                </View>
              )}
            </BlurView>
          </View>
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
    overflow: 'visible',
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
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  scorePercent: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1.5,
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
  petPhotoOuter: {
    position: 'absolute',
    bottom: -6 - 12,
    right: -8 - 12,
    width: PHOTO_SIZE + PHOTO_BORDER * 2 + 24,
    height: PHOTO_SIZE + PHOTO_BORDER * 2 + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petGlowSvg: {
    position: 'absolute',
  },
  petPhotoContainer: {
    width: PHOTO_SIZE + PHOTO_BORDER * 2,
    height: PHOTO_SIZE + PHOTO_BORDER * 2,
    borderRadius: (PHOTO_SIZE + PHOTO_BORDER * 2) / 2,
    borderWidth: PHOTO_BORDER,
    borderColor: Colors.background,
    overflow: 'hidden',
  },
  petGlassBg: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  petPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  },
  petPhotoPlaceholder: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partialBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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

// ─── Small Variant Styles ────────────────────────────────

const smStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  ringContainer: {
    width: SM_RING_SIZE,
    height: SM_RING_SIZE,
    position: 'relative',
    overflow: 'visible',
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
  scoreValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
