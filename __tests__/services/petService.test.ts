import {
  createPet,
  updatePet,
  deletePet,
  getPetsForUser,
  savePetConditions,
  savePetAllergens,
  petPhotoPath,
} from '../../src/services/petService';
import type { Pet } from '../../src/types/pet';

// ─── Mocks ──────────────────────────────────────────────────

// Mock Supabase client
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// Mock useActivePetStore — keep methods as jest.fn() for assertions
const mockStoreState = {
  pets: [] as Pet[],
  activePetId: null as string | null,
  addPet: jest.fn(),
  removePet: jest.fn(),
  updatePet: jest.fn(),
  setActivePet: jest.fn(),
  loadPets: jest.fn(),
};

jest.mock('../../src/stores/useActivePetStore', () => ({
  useActivePetStore: { getState: () => mockStoreState },
}));

import { supabase } from '../../src/services/supabase';

// ─── Mock Helpers ───────────────────────────────────────────

/** Creates a chainable Supabase query mock that resolves to `result`. */
function mockChain(result: { data: any; error: any }) {
  const chain: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  // Make chain itself awaitable (for queries without .single())
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/** Minimal Pet factory for test assertions */
function fakePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buddy',
    species: 'dog',
    breed: null,
    weight_current_lbs: null,
    weight_goal_lbs: null,
    weight_updated_at: null,
    date_of_birth: null,
    dob_is_approximate: false,
    activity_level: 'moderate',
    is_neutered: true,
    sex: null,
    photo_url: null,
    life_stage: null,
    breed_size: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.pets = [];
  mockStoreState.activePetId = null;
});

// ─── createPet ──────────────────────────────────────────────

describe('createPet', () => {
  test('name + species only → succeeds, life_stage null (no DOB)', async () => {
    const returned = fakePet();
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createPet({
      user_id: 'user-1',
      name: 'Buddy',
      species: 'dog',
      breed: null,
      weight_current_lbs: null,
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: null,
      dob_is_approximate: false,
      activity_level: 'moderate',
      is_neutered: true,
      sex: null,
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    expect(result).toEqual(returned);

    // Verify insert payload has null life_stage (no DOB)
    const insertPayload = chain.insert.mock.calls[0][0];
    expect(insertPayload.life_stage).toBeNull();
    expect(insertPayload.breed_size).toBeNull();
    expect(insertPayload.weight_updated_at).toBeNull();
    expect(insertPayload.name).toBe('Buddy');

    // Store synced
    expect(mockStoreState.addPet).toHaveBeenCalledWith(returned);
  });

  test('full profile → life_stage derived correctly', async () => {
    // 3 years old medium dog → should be 'adult'
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 3);
    const dobStr = dob.toISOString();

    const returned = fakePet({
      date_of_birth: dobStr,
      breed: 'Labrador Retriever',
      weight_current_lbs: 65,
      breed_size: 'large',
      life_stage: 'adult',
    });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await createPet({
      user_id: 'user-1',
      name: 'Max',
      species: 'dog',
      breed: 'Labrador Retriever',
      weight_current_lbs: 65,
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: dobStr,
      dob_is_approximate: false,
      activity_level: 'high',
      is_neutered: true,
      sex: 'male',
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    const insertPayload = chain.insert.mock.calls[0][0];
    // Lab is a known breed → 'large'
    expect(insertPayload.breed_size).toBe('large');
    // 3yr old large dog → adult (adultEnd=72mo)
    expect(insertPayload.life_stage).toBe('adult');
    // Weight provided → weight_updated_at set
    expect(insertPayload.weight_updated_at).toBeTruthy();
  });

  test('known breed → breed_size from map (not from weight)', async () => {
    const returned = fakePet({ breed: 'Great Dane', breed_size: 'giant' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await createPet({
      user_id: 'user-1',
      name: 'Zeus',
      species: 'dog',
      breed: 'Great Dane',
      weight_current_lbs: 50, // weight says 'medium', but Great Dane is always 'giant'
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: null,
      dob_is_approximate: false,
      activity_level: 'moderate',
      is_neutered: true,
      sex: null,
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    const insertPayload = chain.insert.mock.calls[0][0];
    expect(insertPayload.breed_size).toBe('giant');
  });

  test('Mixed Breed with weight → breed_size from weight', async () => {
    const returned = fakePet({ breed: 'Mixed Breed', breed_size: 'large' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await createPet({
      user_id: 'user-1',
      name: 'Rex',
      species: 'dog',
      breed: 'Mixed Breed',
      weight_current_lbs: 75, // 55-90 = large
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: null,
      dob_is_approximate: false,
      activity_level: 'moderate',
      is_neutered: true,
      sex: null,
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    const insertPayload = chain.insert.mock.calls[0][0];
    expect(insertPayload.breed_size).toBe('large');
  });

  test('cat → breed_size always null', async () => {
    const returned = fakePet({ species: 'cat', breed_size: null });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await createPet({
      user_id: 'user-1',
      name: 'Whiskers',
      species: 'cat',
      breed: 'Siamese',
      weight_current_lbs: 10,
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: null,
      dob_is_approximate: false,
      activity_level: 'low',
      is_neutered: true,
      sex: null,
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    const insertPayload = chain.insert.mock.calls[0][0];
    expect(insertPayload.breed_size).toBeNull();
  });

  test('missing name → throws', async () => {
    await expect(
      createPet({
        user_id: 'user-1',
        name: '',
        species: 'dog',
        breed: null,
        weight_current_lbs: null,
        weight_goal_lbs: null,
        weight_updated_at: null,
        date_of_birth: null,
        dob_is_approximate: false,
        activity_level: 'moderate',
        is_neutered: true,
        sex: null,
        photo_url: null,
        life_stage: null,
        breed_size: null,
      }),
    ).rejects.toThrow('Pet name is required');
  });

  test('name > 20 chars → throws', async () => {
    await expect(
      createPet({
        user_id: 'user-1',
        name: 'A'.repeat(21),
        species: 'dog',
        breed: null,
        weight_current_lbs: null,
        weight_goal_lbs: null,
        weight_updated_at: null,
        date_of_birth: null,
        dob_is_approximate: false,
        activity_level: 'moderate',
        is_neutered: true,
        sex: null,
        photo_url: null,
        life_stage: null,
        breed_size: null,
      }),
    ).rejects.toThrow('Pet name must be 20 characters or fewer');
  });

  test('name is trimmed', async () => {
    const returned = fakePet({ name: 'Buddy' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await createPet({
      user_id: 'user-1',
      name: '  Buddy  ',
      species: 'dog',
      breed: null,
      weight_current_lbs: null,
      weight_goal_lbs: null,
      weight_updated_at: null,
      date_of_birth: null,
      dob_is_approximate: false,
      activity_level: 'moderate',
      is_neutered: true,
      sex: null,
      photo_url: null,
      life_stage: null,
      breed_size: null,
    });

    const insertPayload = chain.insert.mock.calls[0][0];
    expect(insertPayload.name).toBe('Buddy');
  });
});

// ─── updatePet ──────────────────────────────────────────────

describe('updatePet', () => {
  test('changing weight → weight_updated_at is fresh timestamp', async () => {
    const existing = fakePet({ weight_current_lbs: 30 });
    mockStoreState.pets = [existing];

    const returned = fakePet({ weight_current_lbs: 35 });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const before = new Date().toISOString();
    await updatePet('pet-1', { weight_current_lbs: 35 });

    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload.weight_updated_at).toBeTruthy();
    expect(updatePayload.weight_updated_at >= before).toBe(true);
    expect(mockStoreState.updatePet).toHaveBeenCalledWith('pet-1', returned);
  });

  test('clearing weight → weight_updated_at set to null', async () => {
    const existing = fakePet({ weight_current_lbs: 30 });
    mockStoreState.pets = [existing];

    const returned = fakePet({ weight_current_lbs: null, weight_updated_at: null });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await updatePet('pet-1', { weight_current_lbs: null });

    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload.weight_updated_at).toBeNull();
  });

  test('changing DOB → life_stage re-derived', async () => {
    const existing = fakePet({ species: 'dog', breed_size: 'medium' });
    mockStoreState.pets = [existing];

    // Set DOB to 6 months ago → puppy
    const dob = new Date();
    dob.setMonth(dob.getMonth() - 6);
    const dobStr = dob.toISOString();

    const returned = fakePet({ date_of_birth: dobStr, life_stage: 'puppy' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await updatePet('pet-1', { date_of_birth: dobStr });

    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload.life_stage).toBe('puppy');
  });

  test('changing breed → breed_size re-derived', async () => {
    const existing = fakePet({ breed: 'Mixed Breed', breed_size: null });
    mockStoreState.pets = [existing];

    const returned = fakePet({ breed: 'Golden Retriever', breed_size: 'large' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await updatePet('pet-1', { breed: 'Golden Retriever' });

    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload.breed_size).toBe('large');
  });

  test('species is stripped from updates (immutable after creation)', async () => {
    const existing = fakePet({ species: 'dog' });
    mockStoreState.pets = [existing];

    const returned = fakePet({ species: 'dog', name: 'Rex' });
    const chain = mockChain({ data: returned, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await updatePet('pet-1', { species: 'cat' as any, name: 'Rex' });

    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload.species).toBeUndefined();
    expect(updatePayload.name).toBe('Rex');
  });
});

// ─── deletePet ──────────────────────────────────────────────

describe('deletePet', () => {
  test('cascades to allergens and conditions, then deletes pet', async () => {
    const allergenChain = mockChain({ data: null, error: null });
    const conditionChain = mockChain({ data: null, error: null });
    const petChain = mockChain({ data: null, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(allergenChain)   // pet_allergens
      .mockReturnValueOnce(conditionChain)  // pet_conditions
      .mockReturnValueOnce(petChain);       // pets

    await deletePet('pet-1');

    // Verify tables accessed in correct order
    const fromCalls = (supabase.from as jest.Mock).mock.calls;
    expect(fromCalls[0][0]).toBe('pet_allergens');
    expect(fromCalls[1][0]).toBe('pet_conditions');
    expect(fromCalls[2][0]).toBe('pets');

    // Store synced
    expect(mockStoreState.removePet).toHaveBeenCalledWith('pet-1');
  });
});

// ─── getPetsForUser ─────────────────────────────────────────

describe('getPetsForUser', () => {
  test('returns pets ordered by created_at asc', async () => {
    const pets = [
      fakePet({ id: 'pet-1', name: 'First', created_at: '2025-01-01T00:00:00Z' }),
      fakePet({ id: 'pet-2', name: 'Second', created_at: '2025-06-01T00:00:00Z' }),
    ];
    const chain = mockChain({ data: pets, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getPetsForUser();

    expect(result).toEqual(pets);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

// ─── savePetConditions ──────────────────────────────────────

describe('savePetConditions', () => {
  test('empty array → deletes existing, inserts zero rows (Perfectly Healthy)', async () => {
    const deleteChain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(deleteChain);

    await savePetConditions('pet-1', []);

    // Delete was called
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
    // Insert was NOT called (zero conditions)
    expect(deleteChain.insert).not.toHaveBeenCalled();
  });

  test('non-empty → correct rows inserted', async () => {
    const deleteChain = mockChain({ data: null, error: null });
    const insertChain = mockChain({ data: null, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(insertChain);

    await savePetConditions('pet-1', ['obesity', 'allergy']);

    expect(insertChain.insert).toHaveBeenCalledWith([
      { pet_id: 'pet-1', condition_tag: 'obesity' },
      { pet_id: 'pet-1', condition_tag: 'allergy' },
    ]);
  });
});

// ─── savePetAllergens ───────────────────────────────────────

describe('savePetAllergens', () => {
  test('correct rows inserted with is_custom flags', async () => {
    const deleteChain = mockChain({ data: null, error: null });
    const insertChain = mockChain({ data: null, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(insertChain);

    await savePetAllergens('pet-1', [
      { name: 'Chicken', isCustom: false },
      { name: 'Quinoa', isCustom: true },
    ]);

    expect(insertChain.insert).toHaveBeenCalledWith([
      { pet_id: 'pet-1', allergen: 'Chicken', is_custom: false },
      { pet_id: 'pet-1', allergen: 'Quinoa', is_custom: true },
    ]);
  });

  test('empty array → deletes existing, inserts nothing', async () => {
    const deleteChain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(deleteChain);

    await savePetAllergens('pet-1', []);

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.insert).not.toHaveBeenCalled();
  });
});

// ─── petPhotoPath ──────────────────────────────────────────

describe('petPhotoPath', () => {
  test('generates correct storage path', () => {
    expect(petPhotoPath('user-abc', 'pet-123')).toBe('user-abc/pet-123.jpg');
  });

  test('handles UUID-style IDs', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const petId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(petPhotoPath(userId, petId)).toBe(`${userId}/${petId}.jpg`);
  });
});
