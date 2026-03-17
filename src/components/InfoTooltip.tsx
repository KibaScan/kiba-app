// InfoTooltip — Reusable press-to-reveal floating tooltip.
// Positions above icon by default, flips below if near top of screen.
// Dismisses on tap outside via full-screen overlay.

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Props ──────────────────────────────────────────────

interface InfoTooltipProps {
  text: string;
  size?: number;      // icon size in px, default 16
  opacity?: number;   // icon opacity, default 0.5
  maxWidth?: number;  // tooltip max width, default 260
}

// ─── Constants ──────────────────────────────────────────

const ICON_COLOR = '#737373';
const TOOLTIP_BG = '#1F1F1F';
const CARET_SIZE = 6;
const TOOLTIP_PADDING = 12;
const BORDER_RADIUS = 8;
const SCREEN_MARGIN = 12;
const CARET_GAP = 4;

// ─── Component ──────────────────────────────────────────

export function InfoTooltip({
  text,
  size = 16,
  opacity = 0.5,
  maxWidth = 260,
}: InfoTooltipProps) {
  const iconRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<{
    x: number;
    iconTopY: number;
    iconBottomY: number;
    flipBelow: boolean;
  } | null>(null);
  // Track measured tooltip height for above-positioning
  const [tooltipHeight, setTooltipHeight] = useState(0);

  const handlePress = useCallback(() => {
    iconRef.current?.measureInWindow((x, y, width, height) => {
      const screenHeight = Dimensions.get('window').height;
      const screenWidth = Dimensions.get('window').width;
      const iconCenterX = x + width / 2;

      // Flip below if icon is in the top 20% of screen
      const flipBelow = y < screenHeight * 0.2;

      // Clamp horizontal center so tooltip doesn't overflow screen edges
      const halfMax = maxWidth / 2;
      const clampedX = Math.max(
        SCREEN_MARGIN + halfMax,
        Math.min(screenWidth - SCREEN_MARGIN - halfMax, iconCenterX),
      );

      setLayout({
        x: clampedX,
        iconTopY: y,
        iconBottomY: y + height,
        flipBelow,
      });
      setVisible(true);
    });
  }, [maxWidth]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const onTooltipLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setTooltipHeight(e.nativeEvent.layout.height);
  }, []);

  // Compute tooltip top position
  let tooltipTop = 0;
  if (layout) {
    if (layout.flipBelow) {
      tooltipTop = layout.iconBottomY + CARET_GAP;
    } else {
      // Position above: bottom of tooltip aligns above icon top
      tooltipTop = layout.iconTopY - CARET_GAP - tooltipHeight;
    }
  }

  return (
    <>
      <Pressable
        ref={iconRef}
        onPress={handlePress}
        hitSlop={8}
      >
        <Ionicons
          name="information-circle-outline"
          size={size}
          color={ICON_COLOR}
          style={{ opacity }}
        />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={dismiss}
      >
        {/* Full-screen dismiss overlay */}
        <Pressable style={styles.overlay} onPress={dismiss}>
          {layout && (
            <View
              onLayout={onTooltipLayout}
              style={[
                styles.tooltipContainer,
                {
                  left: layout.x,
                  top: tooltipTop,
                  maxWidth,
                  transform: [{ translateX: -maxWidth / 2 }],
                  // Hide until measured for above-positioning (avoids flicker)
                  opacity: !layout.flipBelow && tooltipHeight === 0 ? 0 : 1,
                },
              ]}
            >
              {/* Caret pointing toward icon */}
              {layout.flipBelow && (
                <View style={[styles.caretUp, { alignSelf: 'center' }]} />
              )}

              <View style={[styles.bubble, { maxWidth }]}>
                <Text style={styles.text}>{text}</Text>
              </View>

              {!layout.flipBelow && (
                <View style={[styles.caretDown, { alignSelf: 'center' }]} />
              )}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  tooltipContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: TOOLTIP_BG,
    paddingHorizontal: TOOLTIP_PADDING,
    paddingVertical: TOOLTIP_PADDING,
    borderRadius: BORDER_RADIUS,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  caretDown: {
    width: 0,
    height: 0,
    borderLeftWidth: CARET_SIZE,
    borderRightWidth: CARET_SIZE,
    borderTopWidth: CARET_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: TOOLTIP_BG,
  },
  caretUp: {
    width: 0,
    height: 0,
    borderLeftWidth: CARET_SIZE,
    borderRightWidth: CARET_SIZE,
    borderBottomWidth: CARET_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: TOOLTIP_BG,
  },
});
