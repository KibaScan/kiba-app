// SafetyFlagSheet — render tests (Task 27 of M9 Community plan).
// scoreFlagService.submitFlag is mocked so the success / offline / generic
// failure branches and the auto-close timer can be triggered deterministically.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('../../../src/services/scoreFlagService');

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafetyFlagSheet } from '../../../src/components/community/SafetyFlagSheet';
import * as scoreFlagService from '../../../src/services/scoreFlagService';
import {
  ScoreFlagOfflineError,
  type ScoreFlag,
  type ScoreFlagReason,
} from '../../../src/types/scoreFlag';

const mockedService = scoreFlagService as jest.Mocked<typeof scoreFlagService>;

const FLAG: ScoreFlag = {
  id: 'flag-1',
  user_id: 'user-1',
  pet_id: 'pet-1',
  product_id: 'prod-1',
  scan_id: null,
  reason: 'score_wrong',
  detail: null,
  status: 'open',
  admin_note: null,
  created_at: '2026-04-23T00:00:00Z',
  reviewed_at: null,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  petId: 'pet-1',
  productId: 'prod-1',
};

describe('SafetyFlagSheet', () => {
  beforeEach(() => {
    baseProps.onClose.mockClear();
    mockedService.submitFlag.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Reason picker ────────────────────────────────────

  it('renders all 6 reasons when reasonOptions not provided', () => {
    const { getByText } = render(<SafetyFlagSheet {...baseProps} />);
    expect(getByText('Score seems off')).toBeTruthy();
    expect(getByText('Ingredient missing or wrong')).toBeTruthy();
    expect(getByText('I think this is recalled')).toBeTruthy();
    expect(getByText('Information looks outdated')).toBeTruthy();
    expect(getByText('Recipe safety concern')).toBeTruthy();
    expect(getByText('Something else')).toBeTruthy();
  });

  it('renders only the filtered set when reasonOptions is provided', () => {
    const opts: ScoreFlagReason[] = ['recipe_concern', 'other'];
    const { getByText, queryByText } = render(
      <SafetyFlagSheet {...baseProps} reasonOptions={opts} />,
    );
    expect(getByText('Recipe safety concern')).toBeTruthy();
    expect(getByText('Something else')).toBeTruthy();
    expect(queryByText('Score seems off')).toBeNull();
    expect(queryByText('Ingredient missing or wrong')).toBeNull();
    expect(queryByText('I think this is recalled')).toBeNull();
    expect(queryByText('Information looks outdated')).toBeNull();
  });

  it('defaultReason pre-selects the matching radio', () => {
    const { getByLabelText } = render(
      <SafetyFlagSheet {...baseProps} defaultReason="recalled" />,
    );
    const row = getByLabelText('I think this is recalled');
    expect(row.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it('renders "Report a concern" header when defaultReason is recipe_concern', () => {
    const { getByText, queryByText } = render(
      <SafetyFlagSheet {...baseProps} defaultReason="recipe_concern" />,
    );
    expect(getByText('Report a concern')).toBeTruthy();
    expect(queryByText('Flag this score')).toBeNull();
  });

  // ─── Submit gating ────────────────────────────────────

  it('submit button is disabled until a reason is selected', () => {
    const { getByLabelText } = render(<SafetyFlagSheet {...baseProps} />);
    const button = getByLabelText('Submit report');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('selecting a reason enables the submit button', () => {
    const { getByLabelText } = render(<SafetyFlagSheet {...baseProps} />);
    fireEvent.press(getByLabelText('Score seems off'));
    const button = getByLabelText('Submit report');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  // ─── Submit payload ───────────────────────────────────

  it('submits with correct payload (petId, productId, scanId, reason, detail)', async () => {
    mockedService.submitFlag.mockResolvedValue(FLAG);

    const { getByLabelText, getByPlaceholderText } = render(
      <SafetyFlagSheet {...baseProps} scanId="scan-99" />,
    );
    fireEvent.press(getByLabelText('Score seems off'));
    fireEvent.changeText(
      getByPlaceholderText('Add details (optional)'),
      'It looks too low for this product',
    );
    fireEvent.press(getByLabelText('Submit report'));
    await flush();

    expect(mockedService.submitFlag).toHaveBeenCalledWith({
      pet_id: 'pet-1',
      product_id: 'prod-1',
      scan_id: 'scan-99',
      reason: 'score_wrong',
      detail: 'It looks too low for this product',
    });
  });

  it('omits scan_id and detail when not provided', async () => {
    mockedService.submitFlag.mockResolvedValue(FLAG);

    const { getByLabelText } = render(<SafetyFlagSheet {...baseProps} />);
    fireEvent.press(getByLabelText('Something else'));
    fireEvent.press(getByLabelText('Submit report'));
    await flush();

    const payload = mockedService.submitFlag.mock.calls[0][0];
    expect(payload).toEqual({
      pet_id: 'pet-1',
      product_id: 'prod-1',
      reason: 'other',
    });
  });

  // ─── Success / auto-close ─────────────────────────────

  it('on success: shows confirmation copy, then auto-closes after delay', async () => {
    jest.useFakeTimers();
    mockedService.submitFlag.mockResolvedValue(FLAG);

    const { getByLabelText, getByText, queryByText } = render(
      <SafetyFlagSheet {...baseProps} />,
    );
    fireEvent.press(getByLabelText('Score seems off'));
    fireEvent.press(getByLabelText('Submit report'));

    // Drain submitFlag promise resolution.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getByText(/Thanks — your report was submitted\./i)).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();

    // Advance the auto-close timer.
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    // Confirmation still visible — sheet host owns the unmount via `visible`.
    expect(queryByText(/Thanks — your report was submitted\./i)).toBeTruthy();

    jest.useRealTimers();
  });

  // ─── Offline error ───────────────────────────────────

  it('on ScoreFlagOfflineError: shows offline copy, does not call onClose', async () => {
    mockedService.submitFlag.mockRejectedValue(new ScoreFlagOfflineError());

    const { getByLabelText, findByText, queryByText } = render(
      <SafetyFlagSheet {...baseProps} />,
    );
    fireEvent.press(getByLabelText('Score seems off'));
    fireEvent.press(getByLabelText('Submit report'));

    expect(
      await findByText(/You're offline — try again when connected\./i),
    ).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(queryByText(/Thanks — your report was submitted\./i)).toBeNull();
  });

  // ─── Generic error ──────────────────────────────────

  it('on generic error: shows error copy, does not call onClose', async () => {
    mockedService.submitFlag.mockRejectedValue(new Error('rls violation'));

    const { getByLabelText, findByText, queryByText } = render(
      <SafetyFlagSheet {...baseProps} />,
    );
    fireEvent.press(getByLabelText('Score seems off'));
    fireEvent.press(getByLabelText('Submit report'));

    expect(
      await findByText(/Something went wrong\. Please try again\./i),
    ).toBeTruthy();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(queryByText(/Thanks — your report was submitted\./i)).toBeNull();
  });

  // ─── Cancel ─────────────────────────────────────────

  it('Cancel button calls onClose', () => {
    const { getByLabelText } = render(<SafetyFlagSheet {...baseProps} />);
    fireEvent.press(getByLabelText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });
});
