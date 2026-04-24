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

  // ─── Contact brand item (Task 23, M9 Community) ───────────────────────────
  describe('Contact brand item', () => {
    test('hidden when onContactBrand is not provided', () => {
      const { queryByText } = render(<ResultHeaderMenu {...baseProps} brandName="Pure Balance" />);
      expect(queryByText(/Contact /)).toBeNull();
    });

    test('hidden when brandName is not provided', () => {
      const onContactBrand = jest.fn();
      const { queryByText } = render(
        <ResultHeaderMenu {...baseProps} onContactBrand={onContactBrand} />,
      );
      expect(queryByText(/Contact /)).toBeNull();
    });

    test('renders "Contact {brand}" item when both onContactBrand + brandName provided', () => {
      const onContactBrand = jest.fn();
      const { getByText } = render(
        <ResultHeaderMenu
          {...baseProps}
          onContactBrand={onContactBrand}
          brandName="Pure Balance"
        />,
      );
      expect(getByText('Contact Pure Balance')).toBeTruthy();
    });

    test('tap fires onContactBrand and closes', () => {
      const onContactBrand = jest.fn();
      const { getByText } = render(
        <ResultHeaderMenu
          {...baseProps}
          onContactBrand={onContactBrand}
          brandName="Pure Balance"
        />,
      );
      fireEvent.press(getByText('Contact Pure Balance'));
      expect(onContactBrand).toHaveBeenCalledTimes(1);
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Flag this score item (Task 29, M9 Community, D-072) ──────────────────
  describe('Flag this score item', () => {
    test('renders when onFlagScore is provided', () => {
      const onFlagScore = jest.fn();
      const { getByText } = render(
        <ResultHeaderMenu {...baseProps} onFlagScore={onFlagScore} />,
      );
      expect(getByText('Flag this score')).toBeTruthy();
    });

    test('hidden when onFlagScore is not provided', () => {
      const { queryByText } = render(<ResultHeaderMenu {...baseProps} />);
      expect(queryByText('Flag this score')).toBeNull();
    });

    test('tap fires onFlagScore and closes', () => {
      const onFlagScore = jest.fn();
      const { getByText } = render(
        <ResultHeaderMenu {...baseProps} onFlagScore={onFlagScore} />,
      );
      fireEvent.press(getByText('Flag this score'));
      expect(onFlagScore).toHaveBeenCalledTimes(1);
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
