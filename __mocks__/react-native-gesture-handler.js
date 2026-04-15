// Jest mock for react-native-gesture-handler
// Provides no-op gesture API used in WeightGoalSlider.

const React = require('react');

const GestureDetector = ({ children }) => children;

const gestureBuilder = () => ({
  onBegin: function() { return this; },
  onUpdate: function() { return this; },
  onEnd: function() { return this; },
  onFinalize: function() { return this; },
  minDistance: function() { return this; },
  activeOffsetX: function() { return this; },
  activeOffsetY: function() { return this; },
  failOffsetX: function() { return this; },
  failOffsetY: function() { return this; },
  enabled: function() { return this; },
});

const Gesture = {
  Pan: gestureBuilder,
  Tap: gestureBuilder,
  Race: (...args) => gestureBuilder(),
  Exclusive: (...args) => gestureBuilder(),
};

const Swipeable = React.forwardRef(({ children }, ref) => {
  React.useImperativeHandle(ref, () => ({ close: () => {} }));
  return children;
});
const RectButton = ({ children, onPress, style }) =>
  React.createElement('Pressable', { style, onPress }, children);

module.exports = {
  GestureDetector,
  GestureHandlerRootView: ({ children }) => children,
  Gesture,
  Directions: {},
  State: {},
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  Swipeable,
  RectButton,
  gestureHandlerRootHOC: (comp) => comp,
};
