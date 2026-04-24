// ToxicDatabaseScreen — render tests (Task 21 of M9 Community plan).
// Curated 35-entry data is bundled client-side; we mock the JSON to a small
// fixture so tests stay deterministic against the real-data growth.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => {
  const RN = jest.requireActual('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
    SafeAreaView: RN.View,
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('@react-navigation/native-stack', () => ({}));

jest.mock('../../src/data/toxic_foods.json', () => ({
  toxics: [
    {
      id: 'chocolate',
      name: 'Chocolate',
      alt_names: ['cocoa', 'cacao'],
      category: 'food',
      species_severity: { dog: 'toxic', cat: 'toxic' },
      symptoms: ['vomiting', 'tremors'],
      safe_threshold_note: null,
      references: [{ label: 'ASPCA', url: 'https://aspca.org/test' }],
    },
    {
      id: 'lily-true',
      name: 'Lily (True/Lilium)',
      alt_names: ['lilium', 'easter lily'],
      category: 'plant',
      species_severity: { dog: 'caution', cat: 'toxic' },
      symptoms: ['kidney failure'],
      safe_threshold_note: 'Even one leaf can be fatal to cats.',
      references: [{ label: 'PetPoison', url: 'https://petpoisonhelpline.com/lily' }],
    },
    {
      id: 'aspirin',
      name: 'Aspirin',
      alt_names: ['acetylsalicylic acid'],
      category: 'medication',
      species_severity: { dog: 'caution', cat: 'toxic' },
      symptoms: ['liver damage'],
      safe_threshold_note: null,
      references: [{ label: 'AVMA', url: 'https://avma.org/test' }],
    },
  ],
}));

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import ToxicDatabaseScreen from '../../src/screens/ToxicDatabaseScreen';

// Spy Linking.openURL — verify reference taps in the sheet without exiting the
// process (default Jest behavior is to throw "no native handler registered").
const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as unknown as void);

function renderScreen() {
  // The stub Task-19 prop type expects NativeStackScreenProps; render tests
  // don't exercise route params or navigation, so casting an empty object is
  // safe for this surface.
  return render(<ToxicDatabaseScreen {...({} as any)} />);
}

describe('ToxicDatabaseScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders all 3 entries grouped under Toxic / Caution sections by default (Dog)', () => {
    const { getByText, queryByText } = renderScreen();

    // Section headers — Toxic and Caution are populated; Safe is empty so
    // suppressed (parity with BookmarksScreen empty-bucket behavior).
    expect(getByText(/Toxic · 1/)).toBeTruthy();
    expect(getByText(/Caution · 2/)).toBeTruthy();
    expect(queryByText(/Safe · /)).toBeNull();

    // Rows: chocolate is toxic to dogs; lily and aspirin are caution for dogs.
    expect(getByText('Chocolate')).toBeTruthy();
    expect(getByText('Lily (True/Lilium)')).toBeTruthy();
    expect(getByText('Aspirin')).toBeTruthy();
  });

  it('switching to Cat moves lily and aspirin from Caution to Toxic', () => {
    const { getByText, getByLabelText, queryByText } = renderScreen();

    fireEvent.press(getByLabelText('Cat'));

    expect(getByText(/Toxic · 3/)).toBeTruthy();
    expect(queryByText(/Caution · /)).toBeNull();
  });

  it('search "lily" filters to only the lily entry (and only its section header)', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText(/Search/i), 'lily');

    expect(getByText('Lily (True/Lilium)')).toBeTruthy();
    expect(queryByText('Chocolate')).toBeNull();
    expect(queryByText('Aspirin')).toBeNull();
    expect(getByText(/Caution · 1/)).toBeTruthy();
    expect(queryByText(/Toxic · /)).toBeNull();
  });

  it('search by alt_name "cocoa" matches chocolate', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText(/Search/i), 'cocoa');

    expect(getByText('Chocolate')).toBeTruthy();
    expect(queryByText('Lily (True/Lilium)')).toBeNull();
    expect(queryByText('Aspirin')).toBeNull();
  });

  it('category chip "Food" filters to only chocolate', () => {
    const { getByLabelText, getByText, queryByText } = renderScreen();

    fireEvent.press(getByLabelText(/Filter category: Food/i));

    expect(getByText('Chocolate')).toBeTruthy();
    expect(queryByText('Lily (True/Lilium)')).toBeNull();
    expect(queryByText('Aspirin')).toBeNull();
  });

  it('tapping a row opens the entry sheet with symptoms + references', () => {
    const { getByText, queryByText, getByLabelText } = renderScreen();

    // Sheet hidden by default — close button should not exist yet.
    expect(queryByText('vomiting')).toBeNull();

    fireEvent.press(getByText('Chocolate'));

    // Symptoms list rendered.
    expect(getByText(/vomiting/)).toBeTruthy();
    expect(getByText(/tremors/)).toBeTruthy();
    // Reference label appears as tappable text.
    expect(getByText('ASPCA')).toBeTruthy();
    // Close button is exposed via accessibilityLabel.
    expect(getByLabelText('Close')).toBeTruthy();
  });

  it('tapping a reference in the sheet calls Linking.openURL with its URL', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Chocolate'));
    fireEvent.press(getByText('ASPCA'));

    expect(openURLSpy).toHaveBeenCalledWith('https://aspca.org/test');
  });

  it('tapping close on the sheet hides it', () => {
    const { getByText, queryByText, getByLabelText } = renderScreen();

    fireEvent.press(getByText('Chocolate'));
    expect(getByText(/vomiting/)).toBeTruthy();

    fireEvent.press(getByLabelText('Close'));

    expect(queryByText(/vomiting/)).toBeNull();
  });

  it('renders the safe_threshold_note when present', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Lily (True/Lilium)'));
    expect(getByText(/Even one leaf can be fatal to cats\./)).toBeTruthy();
  });
});
