// KibaKitchenSubmitScreen — render tests (Task 24 of M9 Community plan).
// Submit form gating, dynamic-row min/max enforcement, success / auto-reject /
// offline branches. recipeService + expo-image-picker are mocked so tests stay
// deterministic and never exercise the real network or photo library.

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

// Service mock — captured per-test via mockResolvedValue / mockRejectedValue.
jest.mock('../../src/services/recipeService');

// Image-picker mock — `launchImageLibraryAsync` is the only entry point we use.
// The default mock returns a successful pick; tests can override per-case.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://mock.jpg' }],
  }),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import KibaKitchenSubmitScreen from '../../src/screens/KibaKitchenSubmitScreen';
import * as recipeService from '../../src/services/recipeService';
import * as ImagePicker from 'expo-image-picker';
import { RecipeOfflineError } from '../../src/types/recipe';

const mockedRecipe = recipeService as jest.Mocked<typeof recipeService>;
const mockedPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;

// Spy on Alert so we can assert success / error toasts without a native handler.
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockGoBack = jest.fn();

function renderScreen() {
  // Match VendorDirectoryScreen.test pattern — props-cast navigation so we can
  // capture the goBack spy directly. useNavigation() is unused on this screen.
  return render(
    <KibaKitchenSubmitScreen
      {...({
        route: { params: undefined },
        navigation: { navigate: jest.fn(), goBack: mockGoBack },
      } as any)}
    />,
  );
}

/**
 * Fill all required fields with valid values so submit is enabled. Returns the
 * render output so tests can assert further state. Uses default mock image pick
 * (file://mock.jpg).
 */
async function fillValidForm(api: ReturnType<typeof renderScreen>) {
  const { getByLabelText, getByPlaceholderText, getByText } = api;

  // Pick cover photo.
  await act(async () => {
    fireEvent.press(getByLabelText(/Add cover photo/i));
  });

  // Title — use a11y label since "Title" placeholder also matches "Subtitle".
  fireEvent.changeText(getByLabelText('Recipe title'), 'Peanut Butter Bites');

  // Ingredients (start with 2 empty rows). Fill them.
  const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
  const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
  const unitInputs = api.getAllByPlaceholderText(/Unit/i);
  fireEvent.changeText(nameInputs[0], 'Peanut butter');
  fireEvent.changeText(qtyInputs[0], '2');
  fireEvent.changeText(unitInputs[0], 'tbsp');
  fireEvent.changeText(nameInputs[1], 'Oats');
  fireEvent.changeText(qtyInputs[1], '1');
  fireEvent.changeText(unitInputs[1], 'cup');

  // Prep step (start with 1 empty row).
  const stepInputs = api.getAllByPlaceholderText(/Step/i);
  fireEvent.changeText(stepInputs[0], 'Mix and bake at 350F for 20 min.');

  // AAFCO acknowledgment.
  fireEvent.press(getByLabelText(/I understand this recipe is not/i));

  return { getByLabelText, getByPlaceholderText, getByText };
}

describe('KibaKitchenSubmitScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockedRecipe.submitRecipe.mockReset();
    mockedPicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://mock.jpg' }],
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Gating tests ──────────────────────────────────────

  it('disables Submit when title is empty', () => {
    const { getByLabelText } = renderScreen();
    const submit = getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables Submit when AAFCO checkbox is unchecked', async () => {
    const api = renderScreen();
    // Fill everything except the checkbox.
    await act(async () => {
      fireEvent.press(api.getByLabelText(/Add cover photo/i));
    });
    fireEvent.changeText(api.getByLabelText('Recipe title'), 'My Recipe');

    const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
    const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
    const unitInputs = api.getAllByPlaceholderText(/Unit/i);
    fireEvent.changeText(nameInputs[0], 'Beef');
    fireEvent.changeText(qtyInputs[0], '1');
    fireEvent.changeText(unitInputs[0], 'lb');
    fireEvent.changeText(nameInputs[1], 'Carrot');
    fireEvent.changeText(qtyInputs[1], '1');
    fireEvent.changeText(unitInputs[1], 'cup');

    const stepInputs = api.getAllByPlaceholderText(/Step/i);
    fireEvent.changeText(stepInputs[0], 'Cook well.');

    // Don't check AAFCO.
    const submit = api.getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables Submit when cover photo is not set', () => {
    const api = renderScreen();
    fireEvent.changeText(api.getByLabelText('Recipe title'), 'My Recipe');

    const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
    const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
    fireEvent.changeText(nameInputs[0], 'A');
    fireEvent.changeText(qtyInputs[0], '1');
    fireEvent.changeText(nameInputs[1], 'B');
    fireEvent.changeText(qtyInputs[1], '1');

    const stepInputs = api.getAllByPlaceholderText(/Step/i);
    fireEvent.changeText(stepInputs[0], 'Cook.');

    fireEvent.press(api.getByLabelText(/I understand this recipe is not/i));

    const submit = api.getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables Submit when title is shorter than 4 chars', async () => {
    const api = renderScreen();
    await act(async () => {
      fireEvent.press(api.getByLabelText(/Add cover photo/i));
    });
    fireEvent.changeText(api.getByLabelText('Recipe title'), 'ok');

    const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
    const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
    fireEvent.changeText(nameInputs[0], 'Beef');
    fireEvent.changeText(qtyInputs[0], '1');
    fireEvent.changeText(nameInputs[1], 'Rice');
    fireEvent.changeText(qtyInputs[1], '1');

    const stepInputs = api.getAllByPlaceholderText(/Step/i);
    fireEvent.changeText(stepInputs[0], 'Cook.');

    fireEvent.press(api.getByLabelText(/I understand this recipe is not/i));

    const submit = api.getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables Submit when an ingredient quantity is missing or zero', async () => {
    const api = renderScreen();
    await act(async () => {
      fireEvent.press(api.getByLabelText(/Add cover photo/i));
    });
    fireEvent.changeText(api.getByLabelText('Recipe title'), 'My Recipe');

    const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
    const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
    fireEvent.changeText(nameInputs[0], 'Beef');
    // qty[0] left empty.
    fireEvent.changeText(nameInputs[1], 'Rice');
    fireEvent.changeText(qtyInputs[1], '1');

    const stepInputs = api.getAllByPlaceholderText(/Step/i);
    fireEvent.changeText(stepInputs[0], 'Cook.');

    fireEvent.press(api.getByLabelText(/I understand this recipe is not/i));

    const submit = api.getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables Submit when no prep step text is entered', async () => {
    const api = renderScreen();
    await act(async () => {
      fireEvent.press(api.getByLabelText(/Add cover photo/i));
    });
    fireEvent.changeText(api.getByLabelText('Recipe title'), 'My Recipe');

    const nameInputs = api.getAllByPlaceholderText(/Ingredient name/i);
    const qtyInputs = api.getAllByPlaceholderText(/Qty/i);
    fireEvent.changeText(nameInputs[0], 'Beef');
    fireEvent.changeText(qtyInputs[0], '1');
    fireEvent.changeText(nameInputs[1], 'Rice');
    fireEvent.changeText(qtyInputs[1], '1');

    // step[0] left empty.

    fireEvent.press(api.getByLabelText(/I understand this recipe is not/i));

    const submit = api.getByLabelText(/Submit recipe/i);
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  // ─── Dynamic-row tests ─────────────────────────────────

  it('starts with 2 ingredient rows; tapping Add increments and respects max 20', () => {
    const api = renderScreen();
    expect(api.getAllByPlaceholderText(/Ingredient name/i)).toHaveLength(2);

    const addBtn = api.getByLabelText(/Add ingredient/i);

    // Add 18 more rows to hit the cap of 20.
    for (let i = 0; i < 18; i++) {
      fireEvent.press(addBtn);
    }
    expect(api.getAllByPlaceholderText(/Ingredient name/i)).toHaveLength(20);

    // 21st press is a no-op — count stays at 20.
    fireEvent.press(addBtn);
    expect(api.getAllByPlaceholderText(/Ingredient name/i)).toHaveLength(20);
  });

  it('removes ingredient rows above min 2 but blocks removing below 2', () => {
    const api = renderScreen();
    fireEvent.press(api.getByLabelText(/Add ingredient/i));
    expect(api.getAllByPlaceholderText(/Ingredient name/i)).toHaveLength(3);

    const removeBtns = api.getAllByLabelText(/Remove ingredient/i);
    fireEvent.press(removeBtns[0]);
    expect(api.getAllByPlaceholderText(/Ingredient name/i)).toHaveLength(2);

    // At min — Remove buttons should not be present (or should be disabled).
    expect(api.queryAllByLabelText(/Remove ingredient/i)).toHaveLength(0);
  });

  it('starts with 1 prep step row; Add increments and respects max 15', () => {
    const api = renderScreen();
    expect(api.getAllByPlaceholderText(/Step/i)).toHaveLength(1);

    const addBtn = api.getByLabelText(/Add step/i);

    for (let i = 0; i < 14; i++) {
      fireEvent.press(addBtn);
    }
    expect(api.getAllByPlaceholderText(/Step/i)).toHaveLength(15);

    fireEvent.press(addBtn);
    expect(api.getAllByPlaceholderText(/Step/i)).toHaveLength(15);
  });

  // ─── Submit branches ───────────────────────────────────

  it('submit success path — calls submitRecipe with payload then navigates back', async () => {
    mockedRecipe.submitRecipe.mockResolvedValue({
      status: 'pending_review',
      recipe_id: 'r-1',
    });

    const api = renderScreen();
    await fillValidForm(api);

    await act(async () => {
      fireEvent.press(api.getByLabelText(/Submit recipe/i));
    });

    expect(mockedRecipe.submitRecipe).toHaveBeenCalledTimes(1);
    const payload = mockedRecipe.submitRecipe.mock.calls[0][0];
    expect(payload.title).toBe('Peanut Butter Bites');
    expect(payload.species).toBe('dog');
    expect(payload.life_stage).toBe('adult');
    expect(payload.ingredients).toEqual([
      { name: 'Peanut butter', quantity: 2, unit: 'tbsp' },
      { name: 'Oats', quantity: 1, unit: 'cup' },
    ]);
    expect(payload.prep_steps).toEqual(['Mix and bake at 350F for 20 min.']);
    expect(payload.cover_image_uri).toBe('file://mock.jpg');

    // Success toast + navigate back.
    expect(alertSpy).toHaveBeenCalledWith(
      'Submitted',
      expect.stringMatching(/submitted for review/i),
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('submit auto-reject path — renders rejection_reason inline; does NOT navigate back', async () => {
    mockedRecipe.submitRecipe.mockResolvedValue({
      status: 'auto_rejected',
      reason: 'Contains chocolate, which is toxic to dogs.',
      recipe_id: 'r-2',
    });

    const api = renderScreen();
    await fillValidForm(api);

    await act(async () => {
      fireEvent.press(api.getByLabelText(/Submit recipe/i));
    });

    expect(api.getByText(/Contains chocolate, which is toxic to dogs/)).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('submit offline path — RecipeOfflineError shows offline-specific copy', async () => {
    mockedRecipe.submitRecipe.mockRejectedValue(new RecipeOfflineError());

    const api = renderScreen();
    await fillValidForm(api);

    await act(async () => {
      fireEvent.press(api.getByLabelText(/Submit recipe/i));
    });

    expect(api.getByText(/offline/i)).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('submit generic error path — shows fallback copy', async () => {
    mockedRecipe.submitRecipe.mockRejectedValue(new Error('boom'));

    const api = renderScreen();
    await fillValidForm(api);

    await act(async () => {
      fireEvent.press(api.getByLabelText(/Submit recipe/i));
    });

    expect(api.getByText(/Something went wrong/i)).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
