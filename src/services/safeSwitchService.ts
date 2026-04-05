// Kiba — Safe Switch Service (M7)
// CRUD for safe_switches + safe_switch_logs. Follows pantryService.ts patterns.
// Offline guards, typed returns, composite data loading.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import { PantryOfflineError } from '../types/pantry';
import { getCurrentDay, getMixForDay, getTransitionSchedule } from '../utils/safeSwitchHelpers';
import type {
  SafeSwitch,
  SafeSwitchLog,
  SafeSwitchCardData,
  SafeSwitchProduct,
  CreateSafeSwitchInput,
  TummyCheck,
} from '../types/safeSwitch';

// ─── Internal ───────────────────────────────────────────

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new PantryOfflineError();
}

const PRODUCT_SELECT = 'id, name, brand, image_url, category, is_supplemental, ga_kcal_per_cup, ga_kcal_per_kg';

// ─── Write Functions ────────────────────────────────────

/**
 * Creates a new safe switch for a pet.
 * Enforced at DB level: only one active/paused switch per pet.
 */
export async function createSafeSwitch(
  input: CreateSafeSwitchInput,
): Promise<SafeSwitch> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('safe_switches')
    .insert({
      user_id: session.user.id,
      pet_id: input.pet_id,
      old_product_id: input.old_product_id,
      new_product_id: input.new_product_id,
      total_days: input.total_days,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — active switch already exists
      throw new Error('An active food transition already exists for this pet. Complete or cancel it first.');
    }
    throw new Error(`Failed to create safe switch: ${error.message}`);
  }

  return data as SafeSwitch;
}

/**
 * Logs a tummy check for a specific day. Upserts — one check per day.
 */
export async function logTummyCheck(
  switchId: string,
  dayNumber: number,
  tummyCheck: TummyCheck,
): Promise<SafeSwitchLog> {
  await requireOnline();

  const { data, error } = await supabase
    .from('safe_switch_logs')
    .upsert(
      {
        switch_id: switchId,
        day_number: dayNumber,
        tummy_check: tummyCheck,
      },
      { onConflict: 'switch_id,day_number' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to log tummy check: ${error.message}`);
  return data as SafeSwitchLog;
}

/**
 * Marks a switch as completed.
 */
export async function completeSafeSwitch(switchId: string): Promise<void> {
  await requireOnline();

  const { error } = await supabase
    .from('safe_switches')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', switchId);

  if (error) throw new Error(`Failed to complete safe switch: ${error.message}`);
}

/**
 * Cancels a switch.
 */
export async function cancelSafeSwitch(switchId: string): Promise<void> {
  await requireOnline();

  const { error } = await supabase
    .from('safe_switches')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', switchId);

  if (error) throw new Error(`Failed to cancel safe switch: ${error.message}`);
}

/**
 * Pauses a switch (e.g. upset tummy, user wants to slow down).
 */
export async function pauseSafeSwitch(switchId: string): Promise<void> {
  await requireOnline();

  const { error } = await supabase
    .from('safe_switches')
    .update({ status: 'paused' })
    .eq('id', switchId);

  if (error) throw new Error(`Failed to pause safe switch: ${error.message}`);
}

/**
 * Resumes a paused switch.
 */
export async function resumeSafeSwitch(switchId: string): Promise<void> {
  await requireOnline();

  const { error } = await supabase
    .from('safe_switches')
    .update({ status: 'active' })
    .eq('id', switchId);

  if (error) throw new Error(`Failed to resume safe switch: ${error.message}`);
}

/**
 * Restarts a switch: cancels the old row and creates a new one with the same
 * product pair and duration. The partial unique index
 * idx_safe_switches_one_active_per_pet (WHERE status IN ('active', 'paused'))
 * allows this — cancelling first frees the slot for the insert.
 */
export async function restartSafeSwitch(switchId: string): Promise<SafeSwitch> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  // Fetch old switch data
  const { data: oldSwitch, error: fetchErr } = await supabase
    .from('safe_switches')
    .select('pet_id, old_product_id, new_product_id, total_days')
    .eq('id', switchId)
    .single();

  if (fetchErr || !oldSwitch) throw new Error('Failed to fetch switch for restart.');

  const { pet_id, old_product_id, new_product_id, total_days } = oldSwitch as {
    pet_id: string; old_product_id: string; new_product_id: string; total_days: number;
  };

  // Step 1: Cancel old switch
  const { error: cancelErr } = await supabase
    .from('safe_switches')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', switchId);

  if (cancelErr) throw new Error(`Failed to cancel old switch: ${cancelErr.message}`);

  // Step 2: Insert new switch with same product pair
  const { data: newSwitch, error: insertErr } = await supabase
    .from('safe_switches')
    .insert({
      user_id: session.user.id,
      pet_id,
      old_product_id,
      new_product_id,
      total_days,
      status: 'active',
    })
    .select()
    .single();

  if (insertErr) throw new Error(`Failed to create new switch: ${insertErr.message}`);

  return newSwitch as SafeSwitch;
}

// ─── Read Functions ─────────────────────────────────────

/**
 * Loads the active/paused safe switch for a pet, with products, logs, and computed state.
 * Returns null if no active switch exists.
 */
export async function getActiveSwitchForPet(
  petId: string,
): Promise<SafeSwitchCardData | null> {
  try {
    // Step 1: Fetch active/paused switch with product joins
    const { data: switchRow, error: switchErr } = await supabase
      .from('safe_switches')
      .select(`
        *,
        old_product:products!safe_switches_old_product_id_fkey(${PRODUCT_SELECT}),
        new_product:products!safe_switches_new_product_id_fkey(${PRODUCT_SELECT})
      `)
      .eq('pet_id', petId)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (switchErr || !switchRow) return null;

    const sw = switchRow as unknown as SafeSwitch & {
      old_product: SafeSwitchProduct;
      new_product: SafeSwitchProduct;
    };

    // Step 2: Fetch logs for this switch
    const { data: logs } = await supabase
      .from('safe_switch_logs')
      .select('*')
      .eq('switch_id', sw.id)
      .order('day_number', { ascending: true });

    const typedLogs = (logs ?? []) as SafeSwitchLog[];

    // Step 3: Resolve scores (same cascade as pantryService)
    let oldScore: number | null = null;
    let newScore: number | null = null;

    const { data: scores } = await supabase
      .from('pet_product_scores')
      .select('product_id, final_score')
      .eq('pet_id', petId)
      .in('product_id', [sw.old_product_id, sw.new_product_id]);

    if (scores) {
      for (const row of scores as { product_id: string; final_score: number }[]) {
        if (row.product_id === sw.old_product_id) oldScore = row.final_score;
        if (row.product_id === sw.new_product_id) newScore = row.final_score;
      }
    }

    // Step 4: Compute derived state
    const currentDay = getCurrentDay(sw.started_at, sw.total_days);
    const todayMix = getMixForDay(currentDay, sw.total_days);
    const todayLogged = typedLogs.some(l => l.day_number === currentDay && l.tummy_check != null);
    const schedule = getTransitionSchedule(sw.total_days);

    // Step 5: Resolve daily cups from pantry serving data
    let dailyCups = 2.4; // Fallback when no pantry data exists
    const { data: pantryItems } = await supabase
      .from('pantry_items')
      .select('id')
      .eq('product_id', sw.old_product_id)
      .eq('is_active', true)
      .limit(1);

    if (pantryItems && pantryItems.length > 0) {
      const { data: asgn } = await supabase
        .from('pantry_pet_assignments')
        .select('serving_size, serving_size_unit, feedings_per_day')
        .eq('pantry_item_id', (pantryItems[0] as { id: string }).id)
        .eq('pet_id', petId)
        .maybeSingle();

      if (asgn) {
        const { serving_size, serving_size_unit, feedings_per_day } = asgn as {
          serving_size: number; serving_size_unit: string; feedings_per_day: number;
        };
        if (serving_size_unit === 'cups') {
          dailyCups = serving_size * feedings_per_day;
        }
      }
    }

    // Strip relation keys, build composite
    const { old_product, new_product, ...switchFields } = sw;

    return {
      switch: switchFields as SafeSwitch,
      oldProduct: old_product,
      newProduct: new_product,
      oldScore,
      newScore,
      logs: typedLogs,
      currentDay,
      todayMix,
      todayLogged,
      schedule,
      dailyCups,
    };
  } catch (e) {
    console.error('[getActiveSwitchForPet] FAILED:', e);
    return null;
  }
}

/**
 * Checks if a pet has an active or paused safe switch.
 * Lightweight check — no product joins.
 */
export async function hasActiveSwitchForPet(petId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('safe_switches')
    .select('*', { count: 'exact', head: true })
    .eq('pet_id', petId)
    .in('status', ['active', 'paused']);

  if (error) return false;
  return (count ?? 0) > 0;
}
