// Kiba — Scroll wheel picker for date-of-birth and approximate age selection.
// Used by CreatePetScreen and EditPetScreen.

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Colors, FontSizes } from '../../utils/constants';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

export const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_ITEMS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - 30 + i));
export const APPROX_YEARS = Array.from({ length: 31 }, (_, i) => String(i));
export const APPROX_MONTHS_ITEMS = Array.from({ length: 12 }, (_, i) => String(i));

export default function WheelPicker({
  items,
  selectedIndex,
  onSelect,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
      scrollingRef.current = false;
    },
    [items.length, selectedIndex, onSelect],
  );

  return (
    <View style={styles.container}>
      <View style={styles.highlight} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        style={{ height: WHEEL_HEIGHT }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          setTimeout(() => {
            if (!scrollingRef.current) {
              const index = Math.round(offsetY / ITEM_HEIGHT);
              const clamped = Math.max(0, Math.min(items.length - 1, index));
              if (clamped !== selectedIndex) {
                onSelect(clamped);
              }
              scrollingRef.current = false;
            }
          }, 150);
        }}
        onScrollBeginDrag={() => {
          scrollingRef.current = true;
        }}
      >
        {items.map((item, index) => (
          <View key={index} style={[styles.item, index === selectedIndex && styles.itemSelected]}>
            <Text
              style={[
                styles.itemText,
                index === selectedIndex && styles.itemTextSelected,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#00B4D815',
    borderRadius: 8,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemSelected: {},
  itemText: {
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },
  itemTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
