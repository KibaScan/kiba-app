// Kiba — Safe Switch Service (M7)
// CRUD for safe_switches + safe_switch_logs. Follows pantryService.ts patterns.
// Offline guards, typed returns, composite data loading.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import { PantryOfflineError } from '../types/pantry';
import { canUseGoalWeight } from '../utils/permissions';
import type { Pet } from '../types/pet';
import type { Product } from '../types';
import {
  getCurrentDay,
  getMixForDay,
  getTransitionSchedule,
  computeSwitchOutcome,
  getOutcomeMessage,
} from '../utils/safeSwitchHelpers';
import type {
  SafeSwitch,
  SafeSwitchLog,
  SafeSwitchCardData,
  SafeSwitchProduct,
  CreateSafeSwitchInput,
  TummyCheck,
  SwitchOutcome,
  OutcomeMessage,
} from '../types/safeSwitch';

// ─── Internal ───────────────────────────────────────────

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new PantryOfflineError();
}

const PRODUCT_SELECT = 'id, name, brand, image_url, category, is_supplemental, ga_kcal_per_cup, ga_kcal_per_kg';

// ─── Write Functions ────────────────────────────────────

/**
 * Creates a new safe switch for a pet anchored to a specific pantry slot.
 *
 * M9 Phase B: `input.pantry_item_id` replaces the old `input.old_product_id`.
 * The old product id is derived server-side from the pantry item's join so
 * callers cannot create switches against phantom products they've never fed.
 *
 * Validation:
 *   - Pantry item exists, is active, belongs to the user (via RLS)
 *   - Pantry item has an assignment for input.pet_id (confirms slot ownership)
 *   - Joined product is daily_food, non-supplemental, non-vet-diet
 *   - New product exists and is daily_food / non-supplemental
 *
 * Enforced at DB level: only one active/paused switch per pet.
 */
export async function createSafeSwitch(
  input: CreateSafeSwitchInput,
): Promise<SafeSwitch> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  // Step 1: Fetch pantry item + product + assignment for this pet
  const { data: itemRow, error: itemErr } = await supabase
    .from('pantry_items')
    .select(`
      id,
      product_id,
      is_active,
      products!product_id (id, category, is_supplemental, is_vet_diet, target_species),
      pantry_pet_assignments!inner (pet_id)
    `)
    .eq('id', input.pantry_item_id)
    .eq('is_active', true)
    .eq('pantry_pet_assignments.pet_id', input.pet_id)
    .maybeSingle();

  if (itemErr) {
    throw new Error(`Failed to validate pantry anchor: ${itemErr.message}`);
  }
  if (!itemRow) {
    throw new Error('This pantry item is no longer available for a Safe Switch.');
  }

  const typedItem = itemRow as unknown as {
    id: string;
    product_id: string;
    is_active: boolean;
    products: {
      id: string;
      category: string;
      is_supplemental: boolean | null;
      is_vet_diet: boolean | null;
      target_species: string;
    } | null;
  };

  const oldProduct = typedItem.products;
  if (!oldProduct) {
    throw new Error('Pantry item is missing product data.');
  }
  if (oldProduct.category !== 'daily_food') {
    throw new Error('Safe Switch is only available for daily food.');
  }
  if (oldProduct.is_supplemental === true || oldProduct.is_vet_diet === true) {
    throw new Error('Safe Switch is not available for supplemental or vet diet products.');
  }

  // Step 2: Validate new product
  const { data: newProductRow, error: newErr } = await supabase
    .from('products')
    .select('id, category, is_supplemental')
    .eq('id', input.new_product_id)
    .maybeSingle();
  if (newErr) {
    throw new Error(`Failed to validate new product: ${newErr.message}`);
  }
  const newProduct = newProductRow as { id: string; category: string; is_supplemental: boolean | null } | null;
  if (!newProduct) {
    throw new Error('New product not found.');
  }
  if (newProduct.category !== 'daily_food' || newProduct.is_supplemental === true) {
    throw new Error('The new product must be a daily food.');
  }

  // Step 3: Insert safe_switches row with derived old_product_id + pantry_item_id FK
  const { data, error } = await supabase
    .from('safe_switches')
    .insert({
      user_id: session.user.id,
      pet_id: input.pet_id,
      pantry_item_id: input.pantry_item_id,
      old_product_id: typedItem.product_id,
      new_product_id: input.new_product_id,
      total_days: input.total_days,
      new_serving_size: input.new_serving_size,
      new_serving_size_unit: input.new_serving_size_unit,
      new_feedings_per_day: input.new_feedings_per_day,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — active switch already exists for this pet
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
 * Marks a switch as completed AND atomically swaps the anchored pantry item's
 * product_id to the new product (M9 Phase B).
 *
 * Flow:
 *   1. Fetch the switch with joined pet name + new product display fields + logs
 *   2. Compute the outcome summary + message via Phase A helpers
 *   3. Call the complete_safe_switch_with_pantry_swap RPC (single transaction)
 *   4. Return the computed outcome + message so the screen can render without
 *      a second fetch
 *
 * The caller (SafeSwitchDetailScreen.handleComplete) is responsible for
 * cancelling notifications and rescheduling feeding reminders after this
 * resolves — this service has no React/UI imports.
 */
export async function completeSafeSwitch(
  switchId: string,
): Promise<{ outcome: SwitchOutcome; message: OutcomeMessage }> {
  await requireOnline();

  // Step 1: Fetch switch + pet name + new product display + logs in parallel
  const [switchRes, logsRes] = await Promise.all([
    supabase
      .from('safe_switches')
      .select(`
        id,
        pet_id,
        pantry_item_id,
        new_feedings_per_day,
        new_product_id,
        total_days,
        pet:pets!pet_id (*),
        new_product:products!new_product_id (brand, name)
      `)
      .eq('id', switchId)
      .single(),
    supabase
      .from('safe_switch_logs')
      .select('day_number, tummy_check')
      .eq('switch_id', switchId),
  ]);

  if (switchRes.error || !switchRes.data) {
    throw new Error(`Failed to load safe switch: ${switchRes.error?.message ?? 'not found'}`);
  }

  const sw = switchRes.data as unknown as {
    id: string;
    pet_id: string;
    pantry_item_id: string | null;
    new_feedings_per_day: number | null;
    new_product_id: string;
    total_days: number;
    pet: Pet | null;
    new_product: { brand: string; name: string } | null;
  };

  const logs = (logsRes.data ?? []) as { day_number: number; tummy_check: string | null }[];
  const petName = sw.pet?.name ?? 'your pet';
  const newProductDisplay = sw.new_product
    ? `${sw.new_product.brand} ${sw.new_product.name}`.trim()
    : 'the new food';

  // Step 2: Compute outcome + message via Phase A helpers (unchanged, D-095 compliant)
  const outcome = computeSwitchOutcome(logs, sw.total_days);
  const message = getOutcomeMessage(outcome, petName, newProductDisplay);

  // Step 3: Atomic RPC — swaps pantry product_id + flips switch status + persists outcome
  const { error: rpcErr } = await supabase.rpc('complete_safe_switch_with_pantry_swap', {
    p_switch_id: switchId,
    p_outcome_summary: { outcome, message },
  });

  if (rpcErr) {
    throw new Error(`Failed to complete safe switch: ${rpcErr.message}`);
  }

  // Step 4: (M9 Phase C) Rebalancing siblings is obsolete in behavioral feeding
  
  // Step 5: Return computed values so the caller can render without a re-fetch
  return { outcome, message };
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

  // Fetch old switch data — M9 Phase B propagates pantry_item_id to the new row
  const { data: oldSwitch, error: fetchErr } = await supabase
    .from('safe_switches')
    .select('pet_id, old_product_id, new_product_id, total_days, pantry_item_id, new_serving_size, new_serving_size_unit, new_feedings_per_day')
    .eq('id', switchId)
    .single();

  if (fetchErr || !oldSwitch) throw new Error('Failed to fetch switch for restart.');

  const { pet_id, old_product_id, new_product_id, total_days, pantry_item_id, new_serving_size, new_serving_size_unit, new_feedings_per_day } = oldSwitch as {
    pet_id: string;
    old_product_id: string;
    new_product_id: string;
    total_days: number;
    pantry_item_id: string | null;
    new_serving_size: number | null;
    new_serving_size_unit: string | null;
    new_feedings_per_day: number | null;
  };

  // Step 1: Cancel old switch
  const { error: cancelErr } = await supabase
    .from('safe_switches')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', switchId);

  if (cancelErr) throw new Error(`Failed to cancel old switch: ${cancelErr.message}`);

  // Step 2: Insert new switch with same product pair + carry pantry_item_id anchor
  const { data: newSwitch, error: insertErr } = await supabase
    .from('safe_switches')
    .insert({
      user_id: session.user.id,
      pet_id,
      pantry_item_id,
      old_product_id,
      new_product_id,
      total_days,
      new_serving_size,
      new_serving_size_unit,
      new_feedings_per_day,
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

    // Step 5: Resolve daily cups from pantry serving data.
    // M9 Phase B: prefer the direct pantry_item_id FK. Fall back to 2.4 cups
    // for historical switches with NULL pantry_item_id — these were never
    // anchored to a specific pantry slot.
    let dailyCups = 2.4;
    const pantryItemId = sw.pantry_item_id ?? null;
    if (pantryItemId) {
      const { data: asgn } = await supabase
        .from('pantry_pet_assignments')
        .select('serving_size, serving_size_unit, feedings_per_day')
        .eq('pantry_item_id', pantryItemId)
        .eq('pet_id', petId)
        .maybeSingle();

      if (asgn) {
        const { serving_size, serving_size_unit, feedings_per_day } = asgn as {
          serving_size: number; serving_size_unit: string; feedings_per_day: number;
        };
        if (serving_size_unit === 'cups') {
          dailyCups = serving_size * feedings_per_day;
        }
      } else if (__DEV__) {
        console.warn(
          `[getActiveSwitchForPet] pantry_item_id=${pantryItemId} present but no assignment for pet=${petId} — using 2.4 fallback`,
        );
      }
    } else if (__DEV__) {
      console.warn(
        `[getActiveSwitchForPet] switch=${sw.id} has null pantry_item_id (historical row) — using 2.4 fallback`,
      );
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
