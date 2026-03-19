// Loading Terminal — 6-step animated sequence masking scoring computation time.
// Pure presentational component. Does NOT run scoring — parent orchestrates.
// D-037: loading terminal messages. D-084: zero emoji, Ionicons only.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Props ───────────────────────────────────────────────

interface LoadingTerminalProps {
  ingredientCount: number;
  species: 'dog' | 'cat';
  petName: string | null;
  proteinPct: number | null;
  fatPct: number | null;
  onComplete: () => void;
}

// ─── Constants ───────────────────────────────────────────

const STEP_DELAY_MS = 250;
const HOLD_AFTER_LAST_MS = 200;
const ACCENT = '#00B4D8';
const COMPLETED_COLOR = '#A0A0A0';
const BG_COLOR = '#1A1A1A';

const MONOSPACE_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

// ─── Component ───────────────────────────────────────────

export function LoadingTerminal({
  ingredientCount,
  species,
  petName,
  proteinPct,
  fatPct,
  onComplete,
}: LoadingTerminalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fadeAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0)),
  ).current;

  // Build step messages
  const steps: string[] = [
    `Reading ${ingredientCount} ingredients...`,
    proteinPct !== null && fatPct !== null
      ? `Evaluating nutritional panel... ${proteinPct}% protein, ${fatPct}% fat`
      : 'Evaluating nutritional panel...',
    'Checking recall database...',
    `Applying ${species} safety rules...`,
    petName ? `Personalizing for ${petName}...` : 'Applying base score...',
    'Calculating suitability match...',
  ];

  const totalSteps = steps.length;

  useEffect(() => {
    // Step 0 is visible immediately — fade it in.
    Animated.timing(fadeAnims[0], {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    // Schedule steps 1-5 + onComplete.
    for (let i = 1; i < totalSteps; i++) {
      const timer = setTimeout(() => {
        setCurrentStep(i);
        Animated.timing(fadeAnims[i], {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }, STEP_DELAY_MS * i);
      timersRef.current.push(timer);
    }

    // Fire onComplete after last step + hold
    const completeTimer = setTimeout(() => {
      onComplete();
    }, STEP_DELAY_MS * (totalSteps - 1) + HOLD_AFTER_LAST_MS);
    timersRef.current.push(completeTimer);

    return () => {
      for (const t of timersRef.current) {
        clearTimeout(t);
      }
      timersRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      {steps.map((message, index) => {
        if (index > currentStep) return null;

        const isActive = index === currentStep;

        return (
          <Animated.View key={index} style={[styles.row, { opacity: fadeAnims[index] }]}>
            {isActive ? (
              <ActivityIndicator
                size={14}
                color={ACCENT}
                style={styles.icon}
              />
            ) : (
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={COMPLETED_COLOR}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.text,
                { color: isActive ? ACCENT : COMPLETED_COLOR },
              ]}
            >
              {message}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 20,
    marginRight: 10,
  },
  text: {
    fontFamily: MONOSPACE_FONT,
    fontSize: 14,
    flexShrink: 1,
  },
});
