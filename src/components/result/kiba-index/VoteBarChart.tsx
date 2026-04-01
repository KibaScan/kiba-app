import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';

interface VoteOption {
  label: string;
  count: number;
  color: string;
  icon?: string; // Optional emoji/icon for the label
}

interface VoteBarChartProps {
  options: VoteOption[];
  totalVotes: number;
}

export const VoteBarChart: React.FC<VoteBarChartProps> = ({ options, totalVotes }) => {
  return (
    <View style={styles.container}>
      {options.map((opt, idx) => {
        const pct = totalVotes > 0 ? (opt.count / totalVotes) * 100 : 0;
        return (
          <View key={idx} style={styles.barRow}>
            <View style={styles.labelSection}>
              <Text style={styles.labelText}>
                {opt.label} {opt.icon ? opt.icon : ''}
              </Text>
              <Text style={styles.pctText}>{Math.round(pct)}%</Text>
            </View>
            <View style={styles.track}>
              <AnimatedBar percentage={pct} color={opt.color} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const AnimatedBar = ({ percentage, color }: { percentage: number; color: string }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 500,
      useNativeDriver: false, // Must be false for width animation
    }).start();
  }, [percentage]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          backgroundColor: color,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  barRow: {
    gap: Spacing.xs,
  },
  labelSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontFamily: 'Inter-Regular', // Matching Kiba aesthetic
  },
  pctText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontFamily: 'Inter-Medium',
  },
  track: {
    height: 8,
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
