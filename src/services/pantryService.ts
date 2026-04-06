// M5 Pantry Service — Supabase CRUD with offline guards.
// Follows petService.ts patterns. No store sync (deferred to pantryStore).

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import type {
  PantryItem,
  PantryPetAssignment,
  PantryCardData,
  AddToPantryInput,
  DietCompletenessResult,
  PantryAnchor,
} from '../types/pantry';
import { PantryOfflineError } from '../types/pantry';
import {
  calculateDaysRemaining,
  isLowStock,
  getCalorieContext,
} from '../utils/pantryHelpers';
import type { Pet } from '../types/pet';
import type { Product } from '../types';

// ─── Internal ───────────────────────────────────────────

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new PantryOfflineError();
}

/**
 * M9 Phase B: picks the next available slot (0 or 1) for a daily-food assignment
 * on a given pet. Returns null when both slots are full (grandfathered 3+ case)
 * or when the product isn't daily_food. Used by addToPantry + sharePantryItem so
 * newly-added daily foods get a slot label automatically.
 */
async function pickNextSlotForPet(
  petId: string,
  productId: string,
): Promise<number | null> {
  // Only daily_food, non-supplemental, non-vet-diet get slot assignments
  const { data: product } = await supabase
    .from('products')
    .select('category, is_supplemental, is_vet_diet')
    .eq('id', productId)
    .single();
  const p = product as { category: string; is_supplemental: boolean | null; is_vet_diet: boolean | null } | null;
  if (!p || p.category !== 'daily_food' || p.is_supplemental === true || p.is_vet_diet === true) {
    return null;
  }

  // Find existing slot_index values for this pet (any category, but the partial
  // unique index only applies when slot_index is set — so only daily_food rows
  // have non-null slot_index in practice).
  const { data: existing } = await supabase
    .from('pantry_pet_assignments')
    .select('slot_index')
    .eq('pet_id', petId)
    .not('slot_index', 'is', null);

  const taken = new Set(
    ((existing ?? []) as { slot_index: number }[]).map(r => r.slot_index),
  );
  if (!taken.has(0)) return 0;
  if (!taken.has(1)) return 1;
  return null; // Grandfathered 3+ case
}

// ─── Write Functions ────────────────────────────────────

export async function addToPantry(
  input: AddToPantryInput,
  petId: string,
): Promise<PantryItem> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const { data: item, error: itemErr } = await supabase
    .from('pantry_items')
    .insert({
      user_id: session.user.id,
      product_id: input.product_id,
      quantity_original: input.quantity_original,
      quantity_remaining: input.quantity_original,
      quantity_unit: input.quantity_unit,
      serving_mode: input.serving_mode,
      unit_label: 'servings',
    })
    .select()
    .single();

  if (itemErr) throw new Error(`Failed to add pantry item: ${itemErr.message}`);

  // M9 Phase B: auto-assign slot_index for daily food so newly-added items get
  // a slot label in SafeSwitchSetupScreen and are countable as slot-anchored.
  const slotIndex = await pickNextSlotForPet(petId, input.product_id);

  const { error: assignErr } = await supabase
    .from('pantry_pet_assignments')
    .insert({
      pantry_item_id: (item as PantryItem).id,
      pet_id: petId,
      serving_size: input.serving_size,
      serving_size_unit: input.serving_size_unit,
      feedings_per_day: input.feedings_per_day,
      feeding_frequency: input.feeding_frequency,
      feeding_times: input.feeding_times ?? null,
      slot_index: slotIndex,
    });

  if (assignErr) throw new Error(`Failed to assign pantry item: ${assignErr.message}`);

  return item as PantryItem;
}

export async function removePantryItem(
  itemId: string,
  petId?: string,
): Promise<void> {
  await requireOnline();

  // M9 Phase B: block deletion when an active/paused Safe Switch references this
  // pantry item. Scoped to pet when petId is provided (removing one pet's
  // assignment shouldn't block a switch belonging to another pet).
  let switchQuery = supabase
    .from('safe_switches')
    .select('id')
    .eq('pantry_item_id', itemId)
    .in('status', ['active', 'paused'])
    .limit(1);
  if (petId) {
    switchQuery = switchQuery.eq('pet_id', petId);
  }
  const { data: blockingSwitches, error: switchErr } = await switchQuery;
  if (switchErr) {
    throw new Error(`Failed to check active switches: ${switchErr.message}`);
  }
  if (blockingSwitches && blockingSwitches.length > 0) {
    throw new Error('Cancel the active Safe Switch before removing this item.');
  }

  if (petId) {
    const { error: delErr } = await supabase
      .from('pantry_pet_assignments')
      .delete()
      .eq('pantry_item_id', itemId)
      .eq('pet_id', petId);
    if (delErr) throw new Error(`Failed to remove assignment: ${delErr.message}`);

    // Check remaining assignments — soft-delete item if none left
    const { count, error: countErr } = await supabase
      .from('pantry_pet_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('pantry_item_id', itemId);
    if (countErr) throw new Error(`Failed to check assignments: ${countErr.message}`);

    if ((count ?? 0) === 0) {
      const { error: deactErr } = await supabase
        .from('pantry_items')
        .update({ is_active: false })
        .eq('id', itemId);
      if (deactErr) throw new Error(`Failed to deactivate item: ${deactErr.message}`);
    }
  } else {
    // Delete all assignments first, then soft-delete the item
    const { error: delAssignErr } = await supabase
      .from('pantry_pet_assignments')
      .delete()
      .eq('pantry_item_id', itemId);
    if (delAssignErr) throw new Error(`Failed to remove assignments: ${delAssignErr.message}`);

    const { error } = await supabase
      .from('pantry_items')
      .update({ is_active: false })
      .eq('id', itemId);
    if (error) throw new Error(`Failed to remove pantry item: ${error.message}`);
  }
}

export async function restockPantryItem(itemId: string): Promise<PantryItem> {
  await requireOnline();

  // Fetch quantity_original (can't self-reference in Supabase update)
  const { data: current, error: fetchErr } = await supabase
    .from('pantry_items')
    .select('quantity_original')
    .eq('id', itemId)
    .single();
  if (fetchErr) throw new Error(`Failed to fetch item: ${fetchErr.message}`);

  const { data: updated, error } = await supabase
    .from('pantry_items')
    .update({
      quantity_remaining: (current as { quantity_original: number }).quantity_original,
      is_active: true,
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new Error(`Failed to restock item: ${error.message}`);
  return updated as PantryItem;
}

export async function updatePantryItem(
  itemId: string,
  updates: Partial<Pick<PantryItem, 'quantity_remaining' | 'quantity_original' | 'quantity_unit' | 'serving_mode' | 'unit_label'>>,
): Promise<PantryItem> {
  await requireOnline();

  const { data, error } = await supabase
    .from('pantry_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update pantry item: ${error.message}`);
  return data as PantryItem;
}

export async function updatePetAssignment(
  assignmentId: string,
  updates: Partial<Pick<PantryPetAssignment, 'serving_size' | 'serving_size_unit' | 'feedings_per_day' | 'feeding_frequency' | 'feeding_times' | 'notifications_on'>>,
): Promise<PantryPetAssignment> {
  await requireOnline();

  const { data, error } = await supabase
    .from('pantry_pet_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update assignment: ${error.message}`);
  return data as PantryPetAssignment;
}

export async function sharePantryItem(
  itemId: string,
  petId: string,
  assignment: Pick<PantryPetAssignment, 'serving_size' | 'serving_size_unit' | 'feedings_per_day' | 'feeding_frequency'>,
): Promise<PantryPetAssignment> {
  await requireOnline();

  // Validate same species
  const { data: item, error: itemErr } = await supabase
    .from('pantry_items')
    .select('product_id, products(target_species)')
    .eq('id', itemId)
    .single();
  if (itemErr) throw new Error(`Failed to fetch item: ${itemErr.message}`);

  const { data: pet, error: petErr } = await supabase
    .from('pets')
    .select('species')
    .eq('id', petId)
    .single();
  if (petErr) throw new Error(`Failed to fetch pet: ${petErr.message}`);

  const productSpecies = (item as Record<string, unknown>).products
    ? ((item as Record<string, unknown>).products as Record<string, unknown>).target_species
    : null;
  if (productSpecies && productSpecies !== (pet as { species: string }).species) {
    throw new Error(`Cannot share: product is for ${productSpecies}, pet is ${(pet as { species: string }).species}`);
  }

  // M9 Phase B: auto-assign slot_index for the target pet
  const productId = (item as { product_id: string }).product_id;
  const slotIndex = await pickNextSlotForPet(petId, productId);

  const { data, error } = await supabase
    .from('pantry_pet_assignments')
    .insert({
      pantry_item_id: itemId,
      pet_id: petId,
      ...assignment,
      slot_index: slotIndex,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to share pantry item: ${error.message}`);
  return data as PantryPetAssignment;
}

// ─── Score Resolution (D-156) ───────────────────────────

/**
 * D-156 cascade: pet_product_scores → scan_history → (caller falls back to base_score).
 * Returns Map<product_id, score> for hits in steps 1-2 only.
 */
async function resolveScoresForPet(
  petId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productIds.length === 0) return map;

  // Step 1: pet_product_scores (batch-scored, per-pet with allergen overrides)
  const { data: pps } = await supabase
    .from('pet_product_scores')
    .select('product_id, final_score')
    .eq('pet_id', petId)
    .in('product_id', productIds);

  if (pps) {
    for (const row of pps as { product_id: string; final_score: number }[]) {
      map.set(row.product_id, row.final_score);
    }
  }

  // Step 2: scan_history fallback for products not in pet_product_scores
  const missing = productIds.filter(id => !map.has(id));
  if (missing.length > 0) {
    const { data: scans } = await supabase
      .from('scan_history')
      .select('product_id, final_score, scanned_at')
      .eq('pet_id', petId)
      .in('product_id', missing)
      .not('final_score', 'is', null)
      .order('scanned_at', { ascending: false });

    if (scans) {
      for (const row of scans as { product_id: string; final_score: number }[]) {
        // First hit per product_id is the most recent scan
        if (!map.has(row.product_id)) {
          map.set(row.product_id, row.final_score);
        }
      }
    }
  }

  return map;
}

/** Resolve scores for multiple pets + a single product (used by SharePantrySheet). */
export async function resolveScoreForPets(
  petIds: string[],
  productId: string,
  baseScore: number | null,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (petIds.length === 0) return result;

  // Step 1: pet_product_scores
  const { data: pps } = await supabase
    .from('pet_product_scores')
    .select('pet_id, final_score')
    .in('pet_id', petIds)
    .eq('product_id', productId);

  if (pps) {
    for (const row of pps as { pet_id: string; final_score: number }[]) {
      result.set(row.pet_id, row.final_score);
    }
  }

  // Step 2: scan_history fallback
  const missing = petIds.filter(id => !result.has(id));
  if (missing.length > 0) {
    const { data: scans } = await supabase
      .from('scan_history')
      .select('pet_id, final_score, scanned_at')
      .in('pet_id', missing)
      .eq('product_id', productId)
      .not('final_score', 'is', null)
      .order('scanned_at', { ascending: false });

    if (scans) {
      for (const row of scans as { pet_id: string; final_score: number }[]) {
        if (!result.has(row.pet_id)) {
          result.set(row.pet_id, row.final_score);
        }
      }
    }
  }

  // Step 3: fill remaining with base_score
  for (const id of petIds) {
    if (!result.has(id)) {
      result.set(id, baseScore);
    }
  }

  return result;
}

// ─── Read Functions ─────────────────────────────────────

export async function getPantryForPet(petId: string): Promise<PantryCardData[]> {
  try {
    // Fetch pet for calorie context calculations
    const { data: pet, error: petErr } = await supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();
    if (petErr || !pet) return [];

    // Step 1: Get item IDs from assignments
    const { data: petAssignments, error: assignErr } = await supabase
      .from('pantry_pet_assignments')
      .select('pantry_item_id')
      .eq('pet_id', petId);
    if (assignErr || !petAssignments || petAssignments.length === 0) return [];

    const itemIds = (petAssignments as { pantry_item_id: string }[]).map(a => a.pantry_item_id);

    // Step 2: Fetch items with products and all assignments
    const { data: items, error: itemErr } = await supabase
      .from('pantry_items')
      .select('*, products(*), pantry_pet_assignments(*)')
      .in('id', itemIds)
      .eq('is_active', true);
    if (itemErr || !items) return [];

    const typedPet = pet as Pet;

    // Filter out items with null product (deleted product, broken FK)
    const validItems = (items as Record<string, unknown>[]).filter(item => item.products != null);

    // D-156: Resolve per-pet scores via cascade
    const productIds = validItems.map(i => (i.products as { id?: string })?.id ?? i.product_id as string).filter(Boolean);
    const scoreMap = await resolveScoresForPet(petId, productIds);

    const cards: PantryCardData[] = validItems.map((item) => {
      const allAssignments: PantryPetAssignment[] =
        (item.pantry_pet_assignments as PantryPetAssignment[]) ?? [];
      const product = item.products as PantryCardData['product'];
      const qtyRemaining = item.quantity_remaining as number;
      const qtyUnit = item.quantity_unit as string;
      const sMode = item.serving_mode as string;

      const daysRemaining = calculateDaysRemaining(
        qtyRemaining,
        qtyUnit as PantryItem['quantity_unit'],
        sMode as PantryItem['serving_mode'],
        allAssignments,
        product?.ga_kcal_per_cup,
        product?.ga_kcal_per_kg,
      );

      const petAssignment = allAssignments.find(a => a.pet_id === petId);
      const calorieCtx = petAssignment && product
        ? getCalorieContext(
            product as unknown as Product,
            typedPet,
            petAssignment.serving_size,
            petAssignment.serving_size_unit,
            petAssignment.feedings_per_day,
          )
        : null;

      // Strip Supabase relation keys, replace with our typed fields
      const { pantry_pet_assignments: _, products: __, ...itemFields } = item;

      // D-156 cascade: pet_product_scores → scan_history → base_score → null
      const productId = item.product_id as string;
      const resolvedScore = scoreMap.get(productId) ?? product?.base_score ?? null;

      return {
        ...itemFields,
        product,
        assignments: allAssignments,
        days_remaining: daysRemaining,
        is_low_stock: isLowStock(daysRemaining, qtyRemaining, sMode as PantryItem['serving_mode']),
        is_empty: qtyRemaining <= 0,
        calorie_context: calorieCtx,
        resolved_score: resolvedScore,
      } as PantryCardData;
    });

    // Sort: recalled -> active -> low stock -> empty
    cards.sort((a, b) => {
      const priority = (c: PantryCardData): number => {
        if (c.product?.is_recalled) return 0;
        if (c.is_empty) return 3;
        if (c.is_low_stock) return 2;
        return 1;
      };
      return priority(a) - priority(b);
    });

    return cards;
  } catch (e) {
    console.error('[getPantryForPet] FAILED:', e);
    return [];
  }
}

/**
 * Checks if a product is already in the user's active pantry for a given pet.
 * Returns the existing pantry item ID if found (for restock flow), null otherwise.
 * Queries via pantry_pet_assignments join — pantry items are user-owned, not pet-owned.
 */
export async function checkDuplicateUpc(
  productId: string,
  petId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, pantry_pet_assignments!inner(pet_id)')
    .eq('product_id', productId)
    .eq('is_active', true)
    .eq('pantry_pet_assignments.pet_id', petId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id as string;
}

/**
 * Returns diet completeness status for a pet's pantry.
 *
 * M9 Phase B note: this function is slot-compatible but not slot-aware. It
 * still returns 'complete' when any non-supplemental daily_food assignment
 * exists, which is a no-op for users whose slots were backfilled correctly.
 * Slot-aware nudges ("add a second slot for mixed feeding") are a FUTURE
 * extension — don't gate completeness on slot_index or new additions will
 * silently drop to 'red_warning' until auto-slot-assignment runs.
 */
export async function evaluateDietCompleteness(
  petId: string,
  petName: string,
): Promise<DietCompletenessResult> {
  // Step 1: Get item IDs for this pet
  const { data: assignments, error: assignErr } = await supabase
    .from('pantry_pet_assignments')
    .select('pantry_item_id')
    .eq('pet_id', petId);

  if (assignErr || !assignments || assignments.length === 0) {
    return { status: 'empty', message: null };
  }

  const itemIds = (assignments as { pantry_item_id: string }[]).map(a => a.pantry_item_id);

  // Step 2: Fetch items with product info
  const { data: items, error: itemErr } = await supabase
    .from('pantry_items')
    .select('id, products(is_supplemental, category)')
    .in('id', itemIds)
    .eq('is_active', true);

  if (itemErr || !items || items.length === 0) {
    return { status: 'empty', message: null };
  }

  const typedItems = items as unknown as { id: string; products: { is_supplemental: boolean; category: string } | null }[];

  const hasCompleteFood = typedItems.some(
    i => i.products?.is_supplemental === false && i.products?.category === 'daily_food',
  );
  if (hasCompleteFood) {
    return { status: 'complete', message: null };
  }

  const nonTreatItems = typedItems.filter(i => i.products?.category !== 'treat');
  if (nonTreatItems.length === 0) {
    return {
      status: 'red_warning',
      message: `No meals found in ${petName}'s pantry. Treats don't provide complete nutrition on their own.`,
    };
  }

  const supplementalCount = typedItems.filter(
    i => i.products?.is_supplemental === true,
  ).length;

  if (supplementalCount >= 2) {
    return {
      status: 'amber_warning',
      message: `${petName}'s pantry has supplemental foods but no complete diet.`,
    };
  }

  return {
    status: 'red_warning',
    message: `${petName}'s pantry does not include a complete diet.`,
  };
}

/**
 * M9 Phase B: returns every daily-food pantry anchor for a pet, hydrated with
 * slot_index, product_form, and D-156 resolved score. Used by:
 *  - ResultScreen to decide whether to show the "Switch to this" CTA
 *  - pickSlotForSwap (pantryHelpers) to pick which slot a Safe Switch replaces
 *  - SafeSwitchSetupScreen to render the slot picker bottom sheet
 *
 * Filters: is_active=true, category='daily_food', is_supplemental=false,
 * is_vet_diet=false, assigned to this pet. Grandfathered rows (slot_index=null)
 * are included — pickSlotForSwap sorts them to the back via ?? 99.
 *
 * Offline-graceful: returns [] on error.
 */
export async function getPantryAnchor(petId: string): Promise<PantryAnchor[]> {
  try {
    // Step 1: Get this pet's assignments with slot_index
    const { data: assignments, error: assignErr } = await supabase
      .from('pantry_pet_assignments')
      .select('pantry_item_id, slot_index')
      .eq('pet_id', petId);
    if (assignErr || !assignments || assignments.length === 0) return [];

    const typedAssignments = assignments as { pantry_item_id: string; slot_index: number | null }[];
    const slotByItemId = new Map(typedAssignments.map(a => [a.pantry_item_id, a.slot_index]));
    const itemIds = typedAssignments.map(a => a.pantry_item_id);

    // Step 2: Fetch active items joined to products, filter daily food / non-supplemental / non-vet-diet
    const { data: items, error: itemErr } = await supabase
      .from('pantry_items')
      .select('id, product_id, products(id, product_form, category, is_supplemental, is_vet_diet)')
      .in('id', itemIds)
      .eq('is_active', true);
    if (itemErr || !items) return [];

    const typedItems = items as unknown as Array<{
      id: string;
      product_id: string;
      products: {
        id: string;
        product_form: string | null;
        category: string;
        is_supplemental: boolean | null;
        is_vet_diet: boolean | null;
      } | null;
    }>;

    const filtered = typedItems.filter(
      i =>
        i.products?.category === 'daily_food' &&
        i.products?.is_supplemental !== true &&
        i.products?.is_vet_diet !== true,
    );
    if (filtered.length === 0) return [];

    // Step 3: Resolve scores via D-156 cascade (reuses the private helper)
    const productIds = filtered.map(i => i.product_id);
    const scoreMap = await resolveScoresForPet(petId, productIds);

    return filtered.map(i => ({
      pantryItemId: i.id,
      productId: i.product_id,
      productForm: i.products?.product_form ?? null,
      slotIndex: slotByItemId.get(i.id) ?? null,
      resolvedScore: scoreMap.get(i.product_id) ?? null,
    }));
  } catch (e) {
    console.error('[getPantryAnchor] FAILED:', e);
    return [];
  }
}
