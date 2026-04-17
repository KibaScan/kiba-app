jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

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
});
