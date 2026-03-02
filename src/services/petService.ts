// M2 Pet CRUD — Supabase-backed with local state sync.
// All derived fields (life_stage, breed_size) are computed here, never user-entered.
// Photo upload to Supabase Storage 'pet-photos' bucket happens at save time.

import { supabase } from './supabase';
import type { Pet, PetCondition, PetAllergen, BreedSize } from '../types/pet';
import { deriveLifeStage, deriveBreedSize } from '../utils/lifeStage';
import { useActivePetStore } from '../stores/useActivePetStore';
import { BREED_SIZE_MAP } from '../data/breeds';

/**
 * Resolve breed size: known breed → map lookup, else → weight-based derivation.
 * Cats return null (no breed-size life stage variation).
 */
function lookupBreedSize(
  breed: string | null,
  species: 'dog' | 'cat',
  weightLbs: number | null,
): BreedSize | null {
  if (species === 'cat') return null;

  if (breed && breed !== 'Mixed Breed') {
    const mapped = BREED_SIZE_MAP[breed];
    if (mapped) return mapped;
  }

  // Mixed/unknown breed: derive from weight, null if no weight
  return weightLbs != null ? deriveBreedSize(weightLbs) : null;
}

// ─── Photo Upload ───────────────────────────────────────────

/**
 * Generate the storage path for a pet photo.
 * Path: `{user_id}/{pet_id}.jpg` — matches RLS prefix policy on 'pet-photos' bucket.
 */
export function petPhotoPath(userId: string, petId: string): string {
  return `${userId}/${petId}.jpg`;
}

/** Returns true if the URI is a local file (not an already-uploaded https URL). */
function isLocalFileUri(uri: string | null): boolean {
  if (!uri) return false;
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

/**
 * Upload a pet photo from a local URI to Supabase Storage.
 * Returns the public URL on success, null on failure.
 * Failures are logged but never throw — pet save must not be blocked.
 */
async function uploadPetPhoto(
  userId: string,
  petId: string,
  localUri: string,
): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const path = petPhotoPath(userId, petId);

    const { error } = await supabase.storage
      .from('pet-photos')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Pet photo upload failed:', error.message);
      return null;
    }

    const { data } = supabase.storage
      .from('pet-photos')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.warn('Pet photo upload failed:', (err as Error).message);
    return null;
  }
}

/**
 * Get the authenticated user ID from Supabase session.
 * Returns null if no active session.
 */
async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── CRUD ───────────────────────────────────────────────────

export async function createPet(
  input: Omit<Pet, 'id' | 'created_at' | 'updated_at'>,
): Promise<Pet> {
  const name = input.name?.trim();
  if (!name) throw new Error('Pet name is required');
  if (name.length > 20) throw new Error('Pet name must be 20 characters or fewer');
  if (!input.species) throw new Error('Species is required');

  const breed_size = lookupBreedSize(input.breed, input.species, input.weight_current_lbs);

  const life_stage = input.date_of_birth
    ? deriveLifeStage(new Date(input.date_of_birth), input.species, breed_size)
    : null;

  const weight_updated_at =
    input.weight_current_lbs != null ? new Date().toISOString() : null;

  // Separate local photo URI — upload happens after insert (need pet ID for path)
  const localPhotoUri = isLocalFileUri(input.photo_url) ? input.photo_url : null;

  const { data, error } = await supabase
    .from('pets')
    .insert({
      ...input,
      name,
      breed_size,
      life_stage,
      weight_updated_at,
      photo_url: localPhotoUri ? null : input.photo_url,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create pet: ${error.message}`);

  let pet = data as Pet;

  // Upload photo if local URI was provided
  if (localPhotoUri) {
    const userId = await getAuthUserId();
    if (userId) {
      const publicUrl = await uploadPetPhoto(userId, pet.id, localPhotoUri);
      if (publicUrl) {
        // Update pet record with public URL
        const { data: updated, error: updateErr } = await supabase
          .from('pets')
          .update({ photo_url: publicUrl })
          .eq('id', pet.id)
          .select()
          .single();
        if (!updateErr && updated) {
          pet = updated as Pet;
        }
      }
    }
  }

  useActivePetStore.getState().addPet(pet);
  return pet;
}

export async function updatePet(
  petId: string,
  updates: Partial<Pet>,
): Promise<Pet> {
  const store = useActivePetStore.getState();
  const currentPet = store.pets.find((p) => p.id === petId);

  // Species is immutable after creation — strip it from updates
  const { species: _stripped, ...safeUpdates } = updates;
  const patch: Record<string, unknown> = { ...safeUpdates };

  // D-117: weight changed → update timestamp
  if ('weight_current_lbs' in updates) {
    patch.weight_updated_at =
      updates.weight_current_lbs != null ? new Date().toISOString() : null;
  }

  // Re-derive breed_size when breed or weight changes
  if ('breed' in updates || 'weight_current_lbs' in updates) {
    const breed = (updates.breed ?? currentPet?.breed) ?? null;
    const species = currentPet?.species ?? 'dog';
    const weight =
      ('weight_current_lbs' in updates
        ? updates.weight_current_lbs
        : currentPet?.weight_current_lbs) ?? null;
    patch.breed_size = lookupBreedSize(breed, species, weight);
  }

  // Re-derive life_stage when DOB, breed, or weight changes (breed/weight affect breed_size)
  if ('date_of_birth' in updates || 'breed' in updates || 'weight_current_lbs' in updates) {
    const dob = (updates.date_of_birth ?? currentPet?.date_of_birth) ?? null;
    const species = currentPet?.species ?? 'dog';
    const breedSize =
      (patch.breed_size as BreedSize | null) ?? currentPet?.breed_size ?? null;
    patch.life_stage = dob
      ? deriveLifeStage(new Date(dob), species, breedSize)
      : null;
  }

  // Handle photo upload if a local file URI was provided
  if ('photo_url' in updates && isLocalFileUri(updates.photo_url ?? null)) {
    const userId = await getAuthUserId();
    if (userId) {
      const publicUrl = await uploadPetPhoto(userId, petId, updates.photo_url!);
      if (publicUrl) {
        patch.photo_url = publicUrl;
      } else {
        // Upload failed — keep existing photo, don't overwrite with local URI
        delete patch.photo_url;
      }
    } else {
      // No auth session — keep existing photo
      delete patch.photo_url;
    }
  }

  const { data, error } = await supabase
    .from('pets')
    .update(patch)
    .eq('id', petId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update pet: ${error.message}`);

  const pet = data as Pet;
  store.updatePet(petId, pet);
  return pet;
}

export async function deletePet(petId: string): Promise<void> {
  // Cascade: remove related rows first (hard delete — D-110 soft delete is M3+)
  const { error: allergenErr } = await supabase
    .from('pet_allergens')
    .delete()
    .eq('pet_id', petId);
  if (allergenErr) throw new Error(`Failed to delete allergens: ${allergenErr.message}`);

  const { error: conditionErr } = await supabase
    .from('pet_conditions')
    .delete()
    .eq('pet_id', petId);
  if (conditionErr) throw new Error(`Failed to delete conditions: ${conditionErr.message}`);

  const { error } = await supabase.from('pets').delete().eq('id', petId);
  if (error) throw new Error(`Failed to delete pet: ${error.message}`);

  useActivePetStore.getState().removePet(petId);
}

export async function getPetsForUser(): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch pets: ${error.message}`);
  return (data ?? []) as Pet[];
}

// ─── Conditions & Allergens ─────────────────────────────────

export async function getPetConditions(petId: string): Promise<PetCondition[]> {
  const { data, error } = await supabase
    .from('pet_conditions')
    .select('*')
    .eq('pet_id', petId);
  if (error) throw new Error(`Failed to fetch conditions: ${error.message}`);
  return (data ?? []) as PetCondition[];
}

export async function getPetAllergens(petId: string): Promise<PetAllergen[]> {
  const { data, error } = await supabase
    .from('pet_allergens')
    .select('*')
    .eq('pet_id', petId);
  if (error) throw new Error(`Failed to fetch allergens: ${error.message}`);
  return (data ?? []) as PetAllergen[];
}

export async function savePetConditions(
  petId: string,
  conditions: string[],
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from('pet_conditions')
    .delete()
    .eq('pet_id', petId);
  if (deleteErr) throw new Error(`Failed to clear conditions: ${deleteErr.message}`);

  // D-119: empty array = "Perfectly Healthy" — stores zero rows
  if (conditions.length > 0) {
    const rows = conditions.map((tag) => ({ pet_id: petId, condition_tag: tag }));
    const { error: insertErr } = await supabase
      .from('pet_conditions')
      .insert(rows);
    if (insertErr) throw new Error(`Failed to save conditions: ${insertErr.message}`);
  }
}

export async function savePetAllergens(
  petId: string,
  allergens: { name: string; isCustom: boolean }[],
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from('pet_allergens')
    .delete()
    .eq('pet_id', petId);
  if (deleteErr) throw new Error(`Failed to clear allergens: ${deleteErr.message}`);

  if (allergens.length > 0) {
    const rows = allergens.map((a) => ({
      pet_id: petId,
      allergen: a.name,
      is_custom: a.isCustom,
    }));
    const { error: insertErr } = await supabase
      .from('pet_allergens')
      .insert(rows);
    if (insertErr) throw new Error(`Failed to save allergens: ${insertErr.message}`);
  }
}
