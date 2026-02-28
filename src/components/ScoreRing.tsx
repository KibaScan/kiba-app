// ScoreRing — Animated circular score gauge (D-094 suitability framing).
// View-based ring (no react-native-svg). Two half-circle rotation technique.
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
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes } from '../utils/constants';

// ─── Props ───────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  petName: string;
  petPhotoUri: string | null;
  species: 'dog' | 'cat';
  isPartialScore: boolean;
}

// ─── Constants ───────────────────────────────────────────

const RING_SIZE = 180;
const RING_BORDER = 8;
const TRACK_COLOR = '#333333';
const ANIMATION_DURATION = 800;

function getScoreColor(score: number): string {
  if (score < 40) return Colors.severityRed;
  if (score < 60) return Colors.severityAmber;
  if (score < 80) return Colors.accent;
  return Colors.severityGreen;
}

// ─── Component ───────────────────────────────────────────

export function ScoreRing({
  score,
  petName,
  petPhotoUri,
  species,
  isPartialScore,
}: ScoreRingProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const displayName = petName || (species === 'dog' ? 'your dog' : 'your cat');
  const ringColor = getScoreColor(score);

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

  // ─── Ring rotation calculations ────────────────────────
  // 0-50% score fills right half, 50-100% fills left half

  const rightRotation = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['0deg', '180deg', '180deg'],
    extrapolate: 'clamp',
  });

  const leftRotation = animatedValue.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ['0deg', '0deg', '180deg'],
    extrapolate: 'clamp',
  });

  // Hide right overlay once past 50%
  const rightOverlayOpacity = animatedValue.interpolate({
    inputRange: [0, 49.9, 50],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      {/* Score Ring */}
      <View style={styles.ringContainer}>
        {/* Background track */}
        <View style={[styles.ring, { borderColor: TRACK_COLOR }]} />

        {/* Right half (0-50%) */}
        <View style={styles.halfClipRight}>
          <Animated.View
            style={[
              styles.halfCircle,
              {
                borderColor: ringColor,
                transform: [{ rotate: rightRotation }],
              },
            ]}
          />
        </View>

        {/* Right half cover (hides unfilled portion when < 50%) */}
        <Animated.View
          style={[styles.halfClipRight, { opacity: rightOverlayOpacity }]}
        >
          <View style={[styles.halfCircle, { borderColor: TRACK_COLOR }]} />
        </Animated.View>

        {/* Left half (50-100%) */}
        <View style={styles.halfClipLeft}>
          <Animated.View
            style={[
              styles.halfCircle,
              {
                borderColor: ringColor,
                transform: [{ rotate: leftRotation }],
              },
            ]}
          />
        </View>

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

const HALF = RING_SIZE / 2;

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
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: HALF,
    borderWidth: RING_BORDER,
    position: 'absolute',
  },
  halfClipRight: {
    position: 'absolute',
    width: HALF,
    height: RING_SIZE,
    right: 0,
    overflow: 'hidden',
  },
  halfClipLeft: {
    position: 'absolute',
    width: HALF,
    height: RING_SIZE,
    left: 0,
    overflow: 'hidden',
  },
  halfCircle: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: HALF,
    borderWidth: RING_BORDER,
    borderColor: 'transparent',
    position: 'absolute',
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
