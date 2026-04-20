jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ResultHeaderMenu } from '../../../src/components/result/ResultHeaderMenu';

describe('ResultHeaderMenu', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onShare: jest.fn(),
    onReportIssue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Share and Report issue items', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    expect(getByText('Share')).toBeTruthy();
    expect(getByText('Report issue')).toBeTruthy();
  });

  test('fires onShare and closes on tap', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    fireEvent.press(getByText('Share'));
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('fires onReportIssue and closes on tap', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    fireEvent.press(getByText('Report issue'));
    expect(baseProps.onReportIssue).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when not visible', () => {
    const { queryByText } = render(<ResultHeaderMenu {...baseProps} visible={false} />);
    expect(queryByText('Share')).toBeNull();
  });

  test('backdrop tap fires onClose without triggering action handlers', () => {
    const { getByLabelText } = render(<ResultHeaderMenu {...baseProps} />);
    fireEvent.press(getByLabelText('Close menu'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    expect(baseProps.onShare).not.toHaveBeenCalled();
    expect(baseProps.onReportIssue).not.toHaveBeenCalled();
  });
});
