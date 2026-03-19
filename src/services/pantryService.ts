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
      unit_label: input.unit_label ?? 'units',
    })
    .select()
    .single();

  if (itemErr) throw new Error(`Failed to add pantry item: ${itemErr.message}`);

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
    });

  if (assignErr) throw new Error(`Failed to assign pantry item: ${assignErr.message}`);

  return item as PantryItem;
}

export async function removePantryItem(
  itemId: string,
  petId?: string,
): Promise<void> {
  await requireOnline();

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
  updates: Partial<Pick<PantryItem, 'quantity_remaining' | 'quantity_original' | 'quantity_unit' | 'serving_mode'>>,
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

  const { data, error } = await supabase
    .from('pantry_pet_assignments')
    .insert({
      pantry_item_id: itemId,
      pet_id: petId,
      ...assignment,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to share pantry item: ${error.message}`);
  return data as PantryPetAssignment;
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
      .or('is_active.eq.true,quantity_remaining.eq.0');
    if (itemErr || !items) return [];

    const typedPet = pet as Pet;

    const cards: PantryCardData[] = (items as Record<string, unknown>[]).map((item) => {
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

      return {
        ...itemFields,
        product,
        assignments: allAssignments,
        days_remaining: daysRemaining,
        is_low_stock: isLowStock(daysRemaining, qtyRemaining, sMode as PantryItem['serving_mode']),
        is_empty: qtyRemaining <= 0,
        calorie_context: calorieCtx,
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
  } catch {
    return [];
  }
}

export async function checkDuplicateUpc(
  productId: string,
  petId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('id, pantry_pet_assignments!inner(pet_id)')
    .eq('product_id', productId)
    .eq('is_active', true)
    .eq('pantry_pet_assignments.pet_id', petId);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

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
    return { status: 'empty', message: null };
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
