// FeedingIntentSheet — Render tests (Task 3 of wet-food-extras-path).
// Uses @testing-library/react-native v12 (first render-test file in the repo).
// Mocks mirror AddToPantrySheet.test.ts for haptics and vector icons so the
// component's import chain resolves in the jest-expo sandbox.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FeedingIntentSheet } from '../../../src/components/pantry/FeedingIntentSheet';

describe('FeedingIntentSheet', () => {
  const baseProps = {
    isVisible: true,
    petName: 'Buster',
    onRegularMeal: jest.fn(),
    onTopperExtras: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onRegularMeal.mockClear();
    baseProps.onTopperExtras.mockClear();
    baseProps.onDismiss.mockClear();
  });

  test('renders header with pet name', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    expect(getByText(/How will Buster eat this/i)).toBeTruthy();
  });

  test('renders both option cards', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    expect(getByText('Regular meal')).toBeTruthy();
    expect(getByText('Just a topper or extra')).toBeTruthy();
  });

  test('tapping "Regular meal" invokes onRegularMeal', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    fireEvent.press(getByText('Regular meal'));
    expect(baseProps.onRegularMeal).toHaveBeenCalledTimes(1);
    expect(baseProps.onTopperExtras).not.toHaveBeenCalled();
  });

  test('tapping "Just a topper or extra" invokes onTopperExtras', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    fireEvent.press(getByText('Just a topper or extra'));
    expect(baseProps.onTopperExtras).toHaveBeenCalledTimes(1);
    expect(baseProps.onRegularMeal).not.toHaveBeenCalled();
  });

  test('returns null when isVisible is false', () => {
    const { queryByText } = render(
      <FeedingIntentSheet {...baseProps} isVisible={false} />,
    );
    expect(queryByText('Regular meal')).toBeNull();
  });
});
