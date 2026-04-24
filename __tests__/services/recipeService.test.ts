// recipeService — submitRecipe (with image upload + Edge Function dispatch)
// + fetchApprovedRecipes / fetchRecipeById / fetchMyRecipes tests.

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
    storage: { from: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

// Pin globalThis.crypto.randomUUID so tests get a deterministic recipe id.
// Service uses crypto.randomUUID() (native in RN 0.74+/Hermes) to avoid the
// expo-crypto native-module dependency.
beforeEach(() => {
  (globalThis as { crypto?: { randomUUID?: () => string } }).crypto = {
    randomUUID: () => 'fixed-uuid-for-tests',
  };
});

import {
  submitRecipe,
  fetchApprovedRecipes,
  fetchRecipeById,
  fetchMyRecipes,
} from '../../src/services/recipeService';
import { RecipeOfflineError } from '../../src/types/recipe';
import type { SubmitRecipeInput } from '../../src/types/recipe';
import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'order', 'limit', 'not', 'gte', 'lte']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

function mockStorageBucket(uploadResult: { data: unknown; error: unknown }, publicUrl: string) {
  return {
    upload: jest.fn().mockResolvedValue(uploadResult),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl } }),
  };
}

const SAMPLE_INPUT: SubmitRecipeInput = {
  title: 'Pumpkin Bites',
  subtitle: 'Easy 3-ingredient treats',
  species: 'dog',
  life_stage: 'adult',
  ingredients: [
    { name: 'pumpkin puree', quantity: 1, unit: 'cup' },
    { name: 'oat flour', quantity: 0.5, unit: 'cup' },
  ],
  prep_steps: ['Mix.', 'Bake 350°F for 20 min.', 'Cool.'],
  cover_image_uri: 'file:///tmp/cover.jpg',
};

const SAMPLE_RECIPE = {
  id: 'fixed-uuid-for-tests',
  user_id: 'user-1',
  title: 'Pumpkin Bites',
  subtitle: null,
  species: 'dog',
  life_stage: 'adult',
  ingredients: [],
  prep_steps: [],
  cover_image_url: 'https://cdn/r.jpg',
  status: 'approved',
  rejection_reason: null,
  is_killed: false,
  created_at: '2026-04-20T00:00:00Z',
  reviewed_at: '2026-04-21T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
  // fetch — RN-friendly arrayBuffer pattern, mirrors petService.uploadPetPhoto.
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(() =>
    Promise.resolve({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response),
  );
});

// ─── submitRecipe ───────────────────────────────────────

describe('submitRecipe', () => {
  test('throws RecipeOfflineError when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(submitRecipe(SAMPLE_INPUT)).rejects.toBeInstanceOf(RecipeOfflineError);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  test('throws when there is no auth user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
    await expect(submitRecipe(SAMPLE_INPUT)).rejects.toThrow(/auth|user/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('happy path: uploads image, inserts row, invokes validator, returns pending_review', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const bucket = mockStorageBucket({ data: { path: 'user-1/fixed-uuid-for-tests.jpg' }, error: null }, 'https://cdn/r.jpg');
    (supabase.storage.from as jest.Mock).mockReturnValue(bucket);
    const insertChain = mockChain({ data: SAMPLE_RECIPE, error: null });
    (supabase.from as jest.Mock).mockReturnValue(insertChain);
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { status: 'pending_review' },
      error: null,
    });

    const result = await submitRecipe(SAMPLE_INPUT);

    // Storage upload — bucket + path + content type
    expect(supabase.storage.from).toHaveBeenCalledWith('recipe-images');
    expect(bucket.upload).toHaveBeenCalledWith(
      'user-1/fixed-uuid-for-tests.jpg',
      expect.anything(),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
    expect(bucket.getPublicUrl).toHaveBeenCalledWith('user-1/fixed-uuid-for-tests.jpg');

    // DB insert — explicit id supplied, RLS-safe minimal payload
    expect(supabase.from).toHaveBeenCalledWith('community_recipes');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fixed-uuid-for-tests',
        user_id: 'user-1',
        title: SAMPLE_INPUT.title,
        subtitle: SAMPLE_INPUT.subtitle,
        species: 'dog',
        life_stage: 'adult',
        ingredients: SAMPLE_INPUT.ingredients,
        prep_steps: SAMPLE_INPUT.prep_steps,
        cover_image_url: 'https://cdn/r.jpg',
      }),
    );

    // Edge Function — validate-recipe with the recipe_id
    expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-recipe', {
      body: { recipe_id: 'fixed-uuid-for-tests' },
    });

    expect(result).toEqual({ status: 'pending_review', recipe_id: 'fixed-uuid-for-tests' });
  });

  test('auto-reject path: propagates reason from Edge Function', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    (supabase.storage.from as jest.Mock).mockReturnValue(
      mockStorageBucket({ data: { path: 'user-1/fixed-uuid-for-tests.jpg' }, error: null }, 'https://cdn/r.jpg'),
    );
    (supabase.from as jest.Mock).mockReturnValue(mockChain({ data: SAMPLE_RECIPE, error: null }));
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { status: 'auto_rejected', reason: 'Contains chocolate (toxic to dogs).' },
      error: null,
    });

    const result = await submitRecipe(SAMPLE_INPUT);

    expect(result).toEqual({
      status: 'auto_rejected',
      reason: 'Contains chocolate (toxic to dogs).',
      recipe_id: 'fixed-uuid-for-tests',
    });
  });

  test('throws when storage upload fails', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    (supabase.storage.from as jest.Mock).mockReturnValue(
      mockStorageBucket({ data: null, error: { message: 'bucket disabled' } }, ''),
    );

    await expect(submitRecipe(SAMPLE_INPUT)).rejects.toThrow(/upload|bucket/i);
    // Must not insert the row if upload failed — leaves no orphan.
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('throws when DB insert fails', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    (supabase.storage.from as jest.Mock).mockReturnValue(
      mockStorageBucket({ data: { path: 'p' }, error: null }, 'https://cdn/r.jpg'),
    );
    (supabase.from as jest.Mock).mockReturnValue(
      mockChain({ data: null, error: { message: 'rls violation' } }),
    );

    await expect(submitRecipe(SAMPLE_INPUT)).rejects.toThrow(/insert|rls/i);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

// ─── fetchApprovedRecipes ───────────────────────────────

describe('fetchApprovedRecipes', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchApprovedRecipes()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries community_recipes with status + kill filters, default limit 20', async () => {
    const chain = mockChain({ data: [SAMPLE_RECIPE], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchApprovedRecipes();

    expect(supabase.from).toHaveBeenCalledWith('community_recipes');
    expect(chain.eq).toHaveBeenCalledWith('status', 'approved');
    expect(chain.eq).toHaveBeenCalledWith('is_killed', false);
    expect(chain.order).toHaveBeenCalledWith('reviewed_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([SAMPLE_RECIPE]);
  });

  test('honors custom limit', async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await fetchApprovedRecipes(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  test('returns [] on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchApprovedRecipes()).resolves.toEqual([]);
  });
});

// ─── fetchRecipeById ────────────────────────────────────

describe('fetchRecipeById', () => {
  test('returns null when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchRecipeById('fixed-uuid-for-tests')).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns recipe when found', async () => {
    const chain = mockChain({ data: SAMPLE_RECIPE, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchRecipeById('fixed-uuid-for-tests');

    expect(supabase.from).toHaveBeenCalledWith('community_recipes');
    expect(chain.eq).toHaveBeenCalledWith('id', 'fixed-uuid-for-tests');
    expect(result).toEqual(SAMPLE_RECIPE);
  });

  test('returns null when no row matches', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchRecipeById('nope')).resolves.toBeNull();
  });

  test('returns null on supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchRecipeById('fixed-uuid-for-tests')).resolves.toBeNull();
  });
});

// ─── fetchMyRecipes ─────────────────────────────────────

describe('fetchMyRecipes', () => {
  test('returns [] when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);
    await expect(fetchMyRecipes()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns [] when no auth user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
    await expect(fetchMyRecipes()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('queries community_recipes for current user across all statuses', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: [SAMPLE_RECIPE], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await fetchMyRecipes();

    expect(supabase.from).toHaveBeenCalledWith('community_recipes');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([SAMPLE_RECIPE]);
  });

  test('returns [] on supabase error', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const chain = mockChain({ data: null, error: { message: 'boom' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);
    await expect(fetchMyRecipes()).resolves.toEqual([]);
  });
});
