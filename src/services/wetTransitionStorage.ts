// Kiba — Wet Food Transition Storage (V2-3)
// AsyncStorage-backed persistence for discrete food transition guides.
// One active transition per pet, keyed by petId.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WetTransitionRecord } from '../utils/wetTransitionHelpers';
import { isWetTransitionExpired } from '../utils/wetTransitionHelpers';

const KEY_PREFIX = '@kiba_wet_transition_';

export async function saveWetTransition(record: WetTransitionRecord): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + record.petId, JSON.stringify(record));
}

export async function getWetTransition(petId: string): Promise<WetTransitionRecord | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + petId);
  if (!raw) return null;

  try {
    const record: WetTransitionRecord = JSON.parse(raw);
    if (record.dismissed) return null;
    if (isWetTransitionExpired(record.startedAt, record.totalDays)) return null;
    return record;
  } catch {
    return null;
  }
}

export async function dismissWetTransition(petId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + petId);
  if (!raw) return;

  try {
    const record: WetTransitionRecord = JSON.parse(raw);
    record.dismissed = true;
    await AsyncStorage.setItem(KEY_PREFIX + petId, JSON.stringify(record));
  } catch {
    // Silently ignore corrupt data
  }
}

export async function clearWetTransition(petId: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + petId);
}
