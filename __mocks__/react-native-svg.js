// Mock for react-native-svg used in tests
// Provides stub React components for Svg, Circle, etc.

const React = require('react');

function createMockComponent(name) {
  return React.forwardRef((props, ref) =>
    React.createElement(name, { ...props, ref }),
  );
}

const Svg = createMockComponent('Svg');

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  Circle: createMockComponent('Circle'),
  Rect: createMockComponent('Rect'),
  Path: createMockComponent('Path'),
  Line: createMockComponent('Line'),
  G: createMockComponent('G'),
  Text: createMockComponent('SvgText'),
  Defs: createMockComponent('Defs'),
  LinearGradient: createMockComponent('LinearGradient'),
  Stop: createMockComponent('Stop'),
  ClipPath: createMockComponent('ClipPath'),
};
