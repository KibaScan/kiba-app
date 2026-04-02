// Health Record CRUD Tests — updateHealthRecord, deleteHealthRecord.
// Pattern: jest.mock Supabase + network, mockChain helper.

import {
  updateHealthRecord,
  deleteHealthRecord,
} from '../../src/services/appointmentService';

// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  },
}));

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'update', 'delete', 'eq', 'single']) {
    chain[m] = jest.fn(() => chain);
  }
  // Terminal calls resolve with the result
  chain.single = jest.fn().mockResolvedValue(result);
  // Make chain thenable for queries without .single() (like delete)
  (chain as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => unknown,
    reject: (v: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

const MOCK_RECORD = {
  id: 'rec-1',
  pet_id: 'pet-1',
  user_id: 'user-1',
  appointment_id: null,
  record_type: 'vaccination',
  treatment_name: 'Rabies',
  administered_at: '2026-03-15',
  next_due_at: '2027-03-15',
  vet_name: 'Dr. Smith',
  notes: null,
  created_at: '2026-03-15T10:00:00Z',
};

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

// ─── updateHealthRecord ─────────────────────────────────

describe('updateHealthRecord', () => {
  test('updates record and returns updated data', async () => {
    const updated = { ...MOCK_RECORD, treatment_name: 'Rabies (3yr)' };
    const chain = mockChain({ data: updated, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await updateHealthRecord('rec-1', {
      treatment_name: 'Rabies (3yr)',
    });

    expect(supabase.from).toHaveBeenCalledWith('pet_health_records');
    expect(chain.update).toHaveBeenCalledWith({ treatment_name: 'Rabies (3yr)' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'rec-1');
    expect(chain.select).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  test('throws when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);

    await expect(
      updateHealthRecord('rec-1', { treatment_name: 'DHPP' }),
    ).rejects.toThrow();
    expect(isOnline).toHaveBeenCalled();
  });

  test('throws on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'not found' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(
      updateHealthRecord('rec-1', { treatment_name: 'DHPP' }),
    ).rejects.toThrow('Failed to update health record: not found');
  });

  test('supports partial updates', async () => {
    const updated = { ...MOCK_RECORD, vet_name: null, next_due_at: null };
    const chain = mockChain({ data: updated, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await updateHealthRecord('rec-1', {
      vet_name: null,
      next_due_at: null,
    });

    expect(chain.update).toHaveBeenCalledWith({ vet_name: null, next_due_at: null });
    expect(result.vet_name).toBeNull();
    expect(result.next_due_at).toBeNull();
  });
});

// ─── deleteHealthRecord ─────────────────────────────────

describe('deleteHealthRecord', () => {
  test('deletes record by id', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await deleteHealthRecord('rec-1');

    expect(supabase.from).toHaveBeenCalledWith('pet_health_records');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'rec-1');
  });

  test('throws when offline', async () => {
    (isOnline as jest.Mock).mockResolvedValue(false);

    await expect(deleteHealthRecord('rec-1')).rejects.toThrow();
    expect(isOnline).toHaveBeenCalled();
  });

  test('throws on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'permission denied' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(deleteHealthRecord('rec-1')).rejects.toThrow(
      'Failed to delete health record: permission denied',
    );
  });
});
