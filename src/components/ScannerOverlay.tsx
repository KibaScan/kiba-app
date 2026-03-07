// Kiba — Scanner Frame Overlay
// Animated viewfinder with corner brackets + scan line.
// Renders on top of CameraView. Lightweight Animated API only.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const FRAME_SIZE = 260;
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 3;
const SCAN_LINE_HEIGHT = 2;
const CORNER_COLOR = '#4ADE80';
const SCAN_LINE_COLOR = '#4ADE80';

interface ScannerOverlayProps {
  /** Trigger the "locked on" snap animation */
  locked: boolean;
}

export default function ScannerOverlay({ locked }: ScannerOverlayProps) {
  const scanLineY = useRef(new Animated.Value(0)).current;
  const cornerScale = useRef(new Animated.Value(1)).current;
  const cornerOpacity = useRef(new Animated.Value(0.8)).current;

  // Looping scan line
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scanLineY, {
        toValue: FRAME_SIZE - SCAN_LINE_HEIGHT,
        duration: 1800,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineY]);

  // "Locked on" snap animation
  useEffect(() => {
    if (!locked) {
      cornerScale.setValue(1);
      cornerOpacity.setValue(0.8);
      return;
    }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(cornerScale, {
          toValue: 0.92,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(cornerScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(cornerOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(cornerOpacity, {
          toValue: 0.8,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [locked, cornerScale, cornerOpacity]);

  return (
    <Animated.View
      style={[
        styles.frame,
        {
          transform: [{ scale: cornerScale }],
          opacity: cornerOpacity,
        },
      ]}
      pointerEvents="none"
    >
      {/* Four corners */}
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />

      {/* Animated scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: scanLineY }] },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 4,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 4,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 4,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 4,
  },
  scanLine: {
    position: 'absolute',
    left: CORNER_THICKNESS,
    right: CORNER_THICKNESS,
    height: SCAN_LINE_HEIGHT,
    backgroundColor: SCAN_LINE_COLOR,
    opacity: 0.6,
    shadowColor: SCAN_LINE_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
