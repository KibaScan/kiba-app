// VendorDirectoryScreen — render tests (Task 22 of M9 Community plan).
// Vendor data is fetched via vendorService; we mock the service with a small
// fixture so tests stay deterministic against catalog growth.

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
jest.mock('../../src/services/vendorService');

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import VendorDirectoryScreen from '../../src/screens/VendorDirectoryScreen';
import * as vendorService from '../../src/services/vendorService';
import type { Vendor } from '../../src/services/vendorService';

const mockedVendor = vendorService as jest.Mocked<typeof vendorService>;

// Spy Linking.openURL — assert mailto / https URLs without firing native handler.
const openURLSpy = jest
  .spyOn(Linking, 'openURL')
  .mockResolvedValue(true as unknown as void);

const FIXTURE: Vendor[] = [
  {
    id: '1',
    brand_slug: 'pure-balance',
    brand_name: 'Pure Balance',
    contact_email: 'help@purebalance.example',
    website_url: 'https://purebalance.example',
    parent_company: 'Walmart',
    headquarters_country: 'USA',
    is_published: true,
  },
  {
    id: '2',
    brand_slug: 'wellness',
    brand_name: 'Wellness',
    contact_email: 'support@wellness.example',
    website_url: 'https://wellness.example',
    parent_company: null,
    headquarters_country: 'USA',
    is_published: true,
  },
  {
    id: '3',
    brand_slug: 'acana',
    brand_name: 'Acana',
    contact_email: null,
    website_url: 'https://acana.example',
    parent_company: 'Champion Petfoods',
    headquarters_country: 'Canada',
    is_published: true,
  },
];

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderScreen(initialBrand?: string) {
  const route = initialBrand ? { params: { initialBrand } } : { params: undefined };
  return render(
    <VendorDirectoryScreen
      {...({ route, navigation: { navigate: jest.fn(), goBack: jest.fn() } } as any)}
    />,
  );
}

describe('VendorDirectoryScreen', () => {
  beforeEach(() => {
    mockedVendor.fetchPublishedVendors.mockResolvedValue(FIXTURE);
  });

  afterEach(() => jest.clearAllMocks());

  it('renders all 3 vendors grouped under A / P / W after fetch resolves', async () => {
    const { getByText, queryByText } = renderScreen();
    await flush();

    // Section headers — alphabetical, no '#' since fixture has none.
    expect(getByText('A')).toBeTruthy();
    expect(getByText('P')).toBeTruthy();
    expect(getByText('W')).toBeTruthy();
    // Rows present.
    expect(getByText('Acana')).toBeTruthy();
    expect(getByText('Pure Balance')).toBeTruthy();
    expect(getByText('Wellness')).toBeTruthy();
    // Empty-state copy must not render once vendors loaded.
    expect(queryByText(/coming soon/i)).toBeNull();
  });

  it('search "well" filters to only Wellness', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen();
    await flush();

    fireEvent.changeText(getByPlaceholderText(/Search/i), 'well');

    expect(getByText('Wellness')).toBeTruthy();
    expect(queryByText('Acana')).toBeNull();
    expect(queryByText('Pure Balance')).toBeNull();
  });

  it('search "Pure" filters to only Pure Balance', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen();
    await flush();

    fireEvent.changeText(getByPlaceholderText(/Search/i), 'Pure');

    expect(getByText('Pure Balance')).toBeTruthy();
    expect(queryByText('Acana')).toBeNull();
    expect(queryByText('Wellness')).toBeNull();
  });

  it('tapping a row expands it and reveals email + website actions', async () => {
    const { getByText, queryByLabelText, getByLabelText } = renderScreen();
    await flush();

    // Collapsed by default — action buttons hidden.
    expect(queryByLabelText(/Email Pure Balance/i)).toBeNull();
    expect(queryByLabelText(/Visit Pure Balance website/i)).toBeNull();

    fireEvent.press(getByText('Pure Balance'));

    expect(getByLabelText(/Email Pure Balance/i)).toBeTruthy();
    expect(getByLabelText(/Visit Pure Balance website/i)).toBeTruthy();
  });

  it('tapping an expanded row collapses it', async () => {
    const { getByText, queryByLabelText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Pure Balance'));
    expect(getByLabelText(/Email Pure Balance/i)).toBeTruthy();

    fireEvent.press(getByText('Pure Balance'));
    expect(queryByLabelText(/Email Pure Balance/i)).toBeNull();
  });

  it('tapping the email button calls Linking.openURL with mailto: prefix', async () => {
    const { getByText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Pure Balance'));
    fireEvent.press(getByLabelText(/Email Pure Balance/i));

    expect(openURLSpy).toHaveBeenCalledWith('mailto:help@purebalance.example');
  });

  it('tapping the website button calls Linking.openURL with website_url as-is', async () => {
    const { getByText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Pure Balance'));
    fireEvent.press(getByLabelText(/Visit Pure Balance website/i));

    expect(openURLSpy).toHaveBeenCalledWith('https://purebalance.example');
  });

  it('hides the email button when contact_email is null (Acana case)', async () => {
    const { getByText, queryByLabelText, getByLabelText } = renderScreen();
    await flush();

    fireEvent.press(getByText('Acana'));

    expect(queryByLabelText(/Email Acana/i)).toBeNull();
    // Website button should still render.
    expect(getByLabelText(/Visit Acana website/i)).toBeTruthy();
  });

  it('route.params.initialBrand populates the search bar on mount', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen('Pure');
    await flush();

    const input = getByPlaceholderText(/Search/i) as any;
    expect(input.props.value).toBe('Pure');
    // Filter applied — only Pure Balance visible.
    expect(getByText('Pure Balance')).toBeTruthy();
    expect(queryByText('Acana')).toBeNull();
    expect(queryByText('Wellness')).toBeNull();
  });

  it('parent_company text never renders (privacy/analytics-only per spec §7.1)', async () => {
    const { getByText, queryByText } = renderScreen();
    await flush();

    // Walmart (Pure Balance parent) and Champion Petfoods (Acana parent)
    // must NOT appear anywhere — collapsed view or expanded view.
    expect(queryByText(/Walmart/i)).toBeNull();
    expect(queryByText(/Champion Petfoods/i)).toBeNull();

    // Expand Pure Balance and re-check — still no parent company text.
    fireEvent.press(getByText('Pure Balance'));
    expect(queryByText(/Walmart/i)).toBeNull();

    // Expand Acana and re-check.
    fireEvent.press(getByText('Acana'));
    expect(queryByText(/Champion Petfoods/i)).toBeNull();
  });

  it('renders the empty-state copy when fetchPublishedVendors returns []', async () => {
    mockedVendor.fetchPublishedVendors.mockResolvedValue([]);

    const { findByText } = renderScreen();

    expect(await findByText(/Vendor directory coming soon/i)).toBeTruthy();
  });
});
