import {
  getConditionDetails,
  upsertConditionDetail,
  deleteConditionDetail,
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from '../../src/services/petService';

// ─── Mocks ──────────────────────────────────────────────────

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
  },
}));

jest.mock('../../src/stores/useActivePetStore', () => ({
  useActivePetStore: {
    getState: () => ({
      pets: [],
      activePetId: null,
      addPet: jest.fn(),
      removePet: jest.fn(),
      updatePet: jest.fn(),
      setActivePet: jest.fn(),
      loadPets: jest.fn(),
    }),
  },
}));

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import { supabase } from '../../src/services/supabase';
import { isOnline } from '../../src/utils/network';

// ─── Mock Helpers ───────────────────────────────────────────

function mockChain(result: { data: any; error: any }) {
  const chain: any = {};
  for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'order', 'in']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

// ─── Condition Details ──────────────────────────────────────

describe('getConditionDetails', () => {
  it('returns condition details for a pet', async () => {
    const details = [
      { id: 'cd-1', pet_id: 'pet-1', condition: 'hyperthyroid', sub_type: 'iodine_restricted', severity: 'moderate', diagnosed_at: null, notes: null, created_at: '2026-01-01' },
    ];
    const chain = mockChain({ data: details, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getConditionDetails('pet-1');
    expect(result).toEqual(details);
    expect(supabase.from).toHaveBeenCalledWith('pet_condition_details');
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
  });

  it('throws on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'RLS denied' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(getConditionDetails('pet-1')).rejects.toThrow('Failed to fetch condition details');
  });
});

describe('upsertConditionDetail', () => {
  it('upserts a condition detail with online guard', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await upsertConditionDetail('pet-1', {
      condition: 'hyperthyroid',
      sub_type: 'iodine_restricted',
      severity: 'moderate',
      diagnosed_at: null,
      notes: null,
    });

    expect(supabase.from).toHaveBeenCalledWith('pet_condition_details');
    expect(chain.upsert).toHaveBeenCalledWith(
      { pet_id: 'pet-1', condition: 'hyperthyroid', sub_type: 'iodine_restricted', severity: 'moderate', diagnosed_at: null, notes: null },
      { onConflict: 'pet_id,condition' },
    );
  });

  it('throws when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      upsertConditionDetail('pet-1', {
        condition: 'ckd',
        sub_type: null,
        severity: 'moderate',
        diagnosed_at: null,
        notes: null,
      }),
    ).rejects.toThrow('Connect to the internet');
  });
});

describe('deleteConditionDetail', () => {
  it('deletes by pet_id and condition', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await deleteConditionDetail('pet-1', 'hyperthyroid');

    expect(supabase.from).toHaveBeenCalledWith('pet_condition_details');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
    expect(chain.eq).toHaveBeenCalledWith('condition', 'hyperthyroid');
  });
});

// ─── Medications ────────────────────────────────────────────

describe('getMedications', () => {
  it('returns medications for a pet ordered by created_at desc', async () => {
    const meds = [
      { id: 'med-1', pet_id: 'pet-1', medication_name: 'Methimazole', status: 'current', dosage: '2.5mg twice daily', started_at: '2026-01-01', ended_at: null, prescribed_for: 'hyperthyroid', notes: null, created_at: '2026-01-01' },
    ];
    const chain = mockChain({ data: meds, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getMedications('pet-1');
    expect(result).toEqual(meds);
    expect(supabase.from).toHaveBeenCalledWith('pet_medications');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('createMedication', () => {
  it('creates a medication and returns it', async () => {
    const med = { id: 'med-1', pet_id: 'pet-1', medication_name: 'Methimazole', status: 'current' as const, dosage: '2.5mg', started_at: null, ended_at: null, prescribed_for: 'hyperthyroid', notes: null, created_at: '2026-01-01' };
    const chain = mockChain({ data: med, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createMedication('pet-1', {
      medication_name: 'Methimazole',
      status: 'current',
      dosage: '2.5mg',
      started_at: null,
      ended_at: null,
      prescribed_for: 'hyperthyroid',
      notes: null,
    });

    expect(result).toEqual(med);
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      createMedication('pet-1', {
        medication_name: 'Aspirin',
        status: 'current',
        dosage: null,
        started_at: null,
        ended_at: null,
        prescribed_for: null,
        notes: null,
      }),
    ).rejects.toThrow('Connect to the internet');
  });
});

describe('updateMedication', () => {
  it('updates a medication by id', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await updateMedication('med-1', { status: 'past', ended_at: '2026-03-27' });

    expect(supabase.from).toHaveBeenCalledWith('pet_medications');
    expect(chain.update).toHaveBeenCalledWith({ status: 'past', ended_at: '2026-03-27' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'med-1');
  });
});

describe('deleteMedication', () => {
  it('deletes a medication by id', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await deleteMedication('med-1');

    expect(supabase.from).toHaveBeenCalledWith('pet_medications');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'med-1');
  });

  it('throws when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValueOnce(false);
    await expect(deleteMedication('med-1')).rejects.toThrow('Connect to the internet');
  });
});
