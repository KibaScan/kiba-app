// D-121 Haptic Feedback Map
// Named functions wrapping expo-haptics. No-op on unsupported platforms (web).
// See PET_PROFILE_SPEC.md §10 for interaction → haptic mapping.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isSupported = Platform.OS !== 'web';

/** Chip toggle (conditions, allergens, activity, DOB mode) */
export function chipToggle(): void {
  if (isSupported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Species toggle */
export function speciesToggle(): void {
  if (isSupported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Scan button press */
export function scanButton(): void {
  if (isSupported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Save success */
export function saveSuccess(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Barcode recognized */
export function barcodeRecognized(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** 100% profile complete */
export function profileComplete(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Hepatic lipidosis warning (D-062) */
export function hepaticWarning(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Scan error / general error */
export function scanError(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Delete confirmation tap */
export function deleteConfirm(): void {
  if (isSupported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Database miss — softer warning pulse */
export function scanWarning(): void {
  if (isSupported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
