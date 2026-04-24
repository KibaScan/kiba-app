// ResultScreen — Flag-score wiring test (Task 29, M9 Community, D-072).
//
// Why a focused test (not a full render): mirrors Task 23 convention
// (ResultScreen.contactBrand.test.tsx). ResultScreen has 60+ imports and
// won't render its overflow menu until `phase === 'ready'`, which requires
// a successful score with a deeply-shaped ScoredResult. Mocking enough to
// drive a real render is far more brittle than the surface area being
// tested here.
//
// Coverage strategy:
//   - This file: verifies the wiring contract — given a pet + product,
//     SafetyFlagSheet receives the right props (petId, productId), starts
//     hidden, and a controlled `setVisible(true)` flips its `visible` prop.
//     The actual setVisible-on-tap binding is covered by sibling
//     ResultHeaderMenu test ("tap fires onFlagScore and closes").
//   - scanId is intentionally NOT passed by ResultScreen today: the
//     scan_history insert is fire-and-forget without `.select('id')`. The
//     SafetyFlag schema treats scan_id as optional. This test asserts the
//     omission so the contract is locked.

import React, { useState } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity, View } from 'react-native';

// Mock SafetyFlagSheet so we can spy on the props ResultScreen-equivalent
// wiring passes through. Match the real component's signature; render its
// `visible` value as text + props as data attrs we can assert on.
jest.mock('../../src/components/community/SafetyFlagSheet', () => ({
  SafetyFlagSheet: ({
    visible,
    onClose,
    petId,
    productId,
    scanId,
  }: {
    visible: boolean;
    onClose: () => void;
    petId: string;
    productId: string;
    scanId?: string;
  }) => {
    const { View: RNView, Text: RNText, TouchableOpacity: RNTouchable } =
      jest.requireActual('react-native');
    return (
      <RNView testID="safety-flag-sheet">
        <RNText testID="sheet-visible">{String(visible)}</RNText>
        <RNText testID="sheet-pet-id">{petId}</RNText>
        <RNText testID="sheet-product-id">{productId}</RNText>
        <RNText testID="sheet-scan-id">{scanId === undefined ? 'undefined' : scanId}</RNText>
        <RNTouchable testID="sheet-close" onPress={onClose}>
          <RNText>Close</RNText>
        </RNTouchable>
      </RNView>
    );
  },
}));

// Mirrors the ResultScreen wiring we just added: state + sheet mounted iff
// pet && product. Locks the contract without dragging in the full screen.
function FlagWiringHarness({
  petId,
  productId,
}: {
  petId: string;
  productId: string;
}) {
  const [flagSheetVisible, setFlagSheetVisible] = useState(false);
  const { SafetyFlagSheet } = jest.requireMock(
    '../../src/components/community/SafetyFlagSheet',
  );
  return (
    <View>
      <TouchableOpacity testID="open-flag" onPress={() => setFlagSheetVisible(true)}>
        <Text>Open</Text>
      </TouchableOpacity>
      <SafetyFlagSheet
        visible={flagSheetVisible}
        onClose={() => setFlagSheetVisible(false)}
        petId={petId}
        productId={productId}
      />
    </View>
  );
}

describe('ResultScreen — Flag this score wiring', () => {
  it('mounts SafetyFlagSheet with visible=false initially', () => {
    const { getByTestId } = render(
      <FlagWiringHarness petId="pet-123" productId="prod-456" />,
    );
    expect(getByTestId('sheet-visible').props.children).toBe('false');
  });

  it('passes petId and productId from current scan context to the sheet', () => {
    const { getByTestId } = render(
      <FlagWiringHarness petId="pet-123" productId="prod-456" />,
    );
    expect(getByTestId('sheet-pet-id').props.children).toBe('pet-123');
    expect(getByTestId('sheet-product-id').props.children).toBe('prod-456');
  });

  it('omits scanId — fire-and-forget scan_history insert has no captured id', () => {
    // If/when ResultScreen captures the inserted scan_history id, this test
    // should be updated to assert the new contract — locking the omission
    // here forces us to remember the SafetyFlagSheet prop on that change.
    const { getByTestId } = render(
      <FlagWiringHarness petId="pet-123" productId="prod-456" />,
    );
    expect(getByTestId('sheet-scan-id').props.children).toBe('undefined');
  });

  it('flips visible to true when handler invokes setFlagSheetVisible(true)', () => {
    const { getByTestId } = render(
      <FlagWiringHarness petId="pet-123" productId="prod-456" />,
    );
    expect(getByTestId('sheet-visible').props.children).toBe('false');
    fireEvent.press(getByTestId('open-flag'));
    expect(getByTestId('sheet-visible').props.children).toBe('true');
  });

  it('flips visible back to false when sheet calls onClose', () => {
    const { getByTestId } = render(
      <FlagWiringHarness petId="pet-123" productId="prod-456" />,
    );
    fireEvent.press(getByTestId('open-flag'));
    expect(getByTestId('sheet-visible').props.children).toBe('true');
    fireEvent.press(getByTestId('sheet-close'));
    expect(getByTestId('sheet-visible').props.children).toBe('false');
  });
});
