// Jest mock for react-native-reanimated
// Provides no-op implementations of hooks and components used in WeightGoalSlider.

const React = require('react');

const useSharedValue = (init) => ({ value: init });
const useAnimatedStyle = (fn) => fn();
const withSpring = (val) => val;
const withTiming = (val) => val;
const runOnJS = (fn) => fn;

const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
  ScrollView: 'Animated.ScrollView',
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedGestureHandler: (handlers) => handlers,
  createAnimatedComponent: (comp) => comp,
};
