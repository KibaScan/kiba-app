// Kiba — Centralized Paywall Boundary (D-051)
// ALL premium checks go through this file. Never scatter if(isPremium) elsewhere.

import Purchases, { CustomerInfo } from 'react-native-purchases';
import { supabase } from '../services/supabase';
import { Limits } from './constants';

// ─── Cached State ──────────────────────────────────────────
// Sync reads use cached value. Refresh via refreshSubscriptionStatus().

let _cachedPremium = false;
let _devOverride: boolean | null = null; // __DEV__ only

// ─── RevenueCat Init ───────────────────────────────────────

let _configured = false;

export async function configureRevenueCat(): Promise<void> {
  if (_configured) return;
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[permissions] No RevenueCat API key — paywall disabled');
    return;
  }
  try {
    Purchases.configure({ apiKey });
    _configured = true;
    await refreshSubscriptionStatus();
  } catch (err) {
    console.warn('[permissions] RevenueCat configure failed:', err);
  }
}

// ─── Subscription Refresh ──────────────────────────────────

export async function refreshSubscriptionStatus(): Promise<void> {
  if (_devOverride !== null) {
    _cachedPremium = _devOverride;
    return;
  }
  if (!_configured) {
    _cachedPremium = false;
    return;
  }
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    _cachedPremium = info.entitlements.active['premium'] !== undefined;
  } catch {
    // Keep cached value on failure
  }
}

// ─── Core Check (sync — reads cache) ──────────────────────

export function isPremium(): boolean {
  if (_devOverride !== null) return _devOverride;
  return _cachedPremium;
}

// ─── Scan Limit (D-050: 5 scans/week, rolling 7-day window) ──

export async function canScan(): Promise<boolean> {
  if (isPremium()) return true;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) return false;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userData.user.id)
    .gte('scanned_at', sevenDaysAgo);

  if (error) {
    console.warn('[permissions] scan count query failed:', error);
    return true; // Fail open — don't block users on DB error
  }

  return (count ?? 0) < Limits.freeScansPerWeek;
}

// ─── Rolling Window Info (for DevMenu + UI) ────────────────

export async function getScanWindowInfo(): Promise<{
  count: number;
  remaining: number;
  oldestScanAt: string | null;
}> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) return { count: 0, remaining: Limits.freeScansPerWeek, oldestScanAt: null };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('scans')
    .select('scanned_at')
    .eq('user_id', userData.user.id)
    .gte('scanned_at', sevenDaysAgo)
    .order('scanned_at', { ascending: true });

  if (error || !data) return { count: 0, remaining: Limits.freeScansPerWeek, oldestScanAt: null };

  return {
    count: data.length,
    remaining: Math.max(0, Limits.freeScansPerWeek - data.length),
    oldestScanAt: data.length > 0 ? data[0].scanned_at : null,
  };
}

// ─── Pet Limit ─────────────────────────────────────────────

export function canAddPet(currentPetCount: number): boolean {
  if (isPremium()) return true;
  return currentPetCount < Limits.freePetsMax;
}

// ─── Feature Gates ─────────────────────────────────────────

export function canSearch(): boolean {
  return isPremium();
}

export function canCompare(): boolean {
  return isPremium();
}

export function canUseSafeSwaps(): boolean {
  return isPremium();
}

export function canUseGoalWeight(): boolean {
  return isPremium();
}

export function canUseTreatBattery(): boolean {
  return isPremium();
}

export function canExportVetReport(): boolean {
  return isPremium();
}

export function canStartEliminationDiet(): boolean {
  return isPremium();
}

// ─── Appointment Gate (D-103) ────────────────────────────

export function canCreateAppointment(activeCount: number): boolean {
  if (isPremium()) return true;
  return activeCount < Limits.freeAppointmentsMax;
}

// FREE for all users (D-125): scanning (up to limit), basic score, 1 pet, Recall Siren
export function canSetRecallAlerts(): boolean {
  return true;
}

// ─── Purchase Flow ────────────────────────────────────────
// Centralizes all RevenueCat API calls in this file (D-051).

export async function purchaseSubscription(
  plan: 'annual' | 'monthly',
): Promise<{ success: boolean; error?: string }> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      return { success: false, error: 'No subscription plans are currently available.' };
    }

    const pkg = plan === 'annual' ? current.annual : current.monthly;
    if (!pkg) {
      return { success: false, error: `The ${plan} plan is not currently available.` };
    }

    await Purchases.purchasePackage(pkg);
    await refreshSubscriptionStatus();
    return { success: true };
  } catch (err: any) {
    if (err.userCancelled) return { success: false };
    console.error('[permissions] Purchase failed:', err);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}

// ─── Dev Overrides (__DEV__ only) ──────────────────────────

export function setDevPremiumOverride(premium: boolean | null): void {
  if (!__DEV__) return;
  _devOverride = premium;
  _cachedPremium = premium ?? false;
}

export function getDevPremiumOverride(): boolean | null {
  return __DEV__ ? _devOverride : null;
}
