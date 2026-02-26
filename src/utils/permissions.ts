// Kiba — Centralized Paywall Boundary
// ALL premium checks go through this file. Never scatter if(isPremium) elsewhere.

import { Limits } from './constants';

// M0 stub: no RevenueCat yet. Returns static values.
// Will be wired to RevenueCat subscription state in M3-M4.

let _isPremium = false;

export function setSubscriptionStatus(premium: boolean): void {
  _isPremium = premium;
}

export function isPremium(): boolean {
  return _isPremium;
}

export function canScan(weeklyCount: number): boolean {
  if (_isPremium) return true;
  return weeklyCount < Limits.freeScansPerWeek;
}

export function canSearch(): boolean {
  return _isPremium;
}

export function canAddPet(currentPetCount: number): boolean {
  if (_isPremium) return true;
  return currentPetCount < Limits.freePetsMax;
}

export function canViewSafeSwaps(): boolean {
  return _isPremium;
}

export function canSetRecallAlerts(): boolean {
  return _isPremium;
}
