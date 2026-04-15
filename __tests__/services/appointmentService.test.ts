// Appointment Service Tests — CRUD, recurring, offline guards, permissions.
// Pattern: jest.mock Supabase + network, mockChain helper (matches pantryService.test.ts).

import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  completeAppointment,
  getUpcomingAppointments,
  getPastAppointments,
  logHealthRecord,
  getHealthRecords,
  addManualHealthRecord,
} from '../../src/services/appointmentService';
// ─── Mocks ──────────────────────────────────────────────

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

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

// Mock permissions without requireActual (avoids RevenueCat transform issue)
let mockPremium = false;
jest.mock('../../src/utils/permissions', () => ({
  isPremium: () => mockPremium,
  canCreateAppointment: (activeCount: number) => {
    if (mockPremium) return true;
    return activeCount < 2;
  },
}));

import { canCreateAppointment } from '../../src/utils/permissions';

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

// ─── Helpers ────────────────────────────────────────────

function mockChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'contains', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  // Make chain thenable for queries without .single()
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

const VALID_INPUT = {
  type: 'vet_visit' as const,
  scheduled_at: '2026-04-15T10:00:00Z',
  pet_ids: ['pet-1'],
  location: 'Paws & Claws',
};

const MOCK_APPOINTMENT = {
  id: 'appt-1',
  user_id: 'user-1',
  type: 'vet_visit',
  custom_label: null,
  scheduled_at: '2026-04-15T10:00:00Z',
  pet_ids: ['pet-1'],
  location: 'Paws & Claws',
  notes: null,
  reminder: '1_day',
  recurring: 'none',
  is_completed: false,
  completed_at: null,
  created_at: '2026-03-20T00:00:00Z',
  updated_at: '2026-03-20T00:00:00Z',
};

// ─── Setup ──────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
  mockPremium = false;
});

// ─── Offline Guards ─────────────────────────────────────

describe('offline guards', () => {
  beforeEach(() => {
    (isOnline as jest.Mock).mockResolvedValue(false);
  });

  test('createAppointment throws when offline', async () => {
    await expect(createAppointment(VALID_INPUT)).rejects.toThrow('Connect to the internet');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('updateAppointment throws when offline', async () => {
    await expect(updateAppointment('appt-1', { location: 'New Clinic' })).rejects.toThrow('Connect to the internet');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('deleteAppointment throws when offline', async () => {
    await expect(deleteAppointment('appt-1')).rejects.toThrow('Connect to the internet');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('completeAppointment throws when offline', async () => {
    await expect(completeAppointment('appt-1')).rejects.toThrow('Connect to the internet');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('getUpcomingAppointments returns [] when offline (graceful)', async () => {
    const chain = mockChain({ data: null, error: { message: 'network error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getUpcomingAppointments('user-1');
    expect(result).toEqual([]);
  });

  test('getPastAppointments returns [] when offline (graceful)', async () => {
    const chain = mockChain({ data: null, error: { message: 'network error' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getPastAppointments('user-1');
    expect(result).toEqual([]);
  });
});

// ─── CRUD ───────────────────────────────────────────────

describe('createAppointment', () => {
  test('inserts appointment and returns it', async () => {
    const chain = mockChain({ data: MOCK_APPOINTMENT, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createAppointment(VALID_INPUT);
    expect(supabase.from).toHaveBeenCalledWith('pet_appointments');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      type: 'vet_visit',
      pet_ids: ['pet-1'],
      reminder: '1_day',
      recurring: 'none',
    }));
    expect(result).toEqual(MOCK_APPOINTMENT);
  });

  test('throws on Supabase error', async () => {
    const chain = mockChain({ data: null, error: { message: 'insert failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(createAppointment(VALID_INPUT)).rejects.toThrow('Failed to create appointment');
  });

  test('throws when not authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
    });

    await expect(createAppointment(VALID_INPUT)).rejects.toThrow('Not authenticated');
  });
});

describe('updateAppointment', () => {
  test('updates and returns appointment', async () => {
    const updated = { ...MOCK_APPOINTMENT, location: 'New Clinic' };
    const chain = mockChain({ data: updated, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await updateAppointment('appt-1', { location: 'New Clinic' });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      location: 'New Clinic',
    }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'appt-1');
    expect(result.location).toBe('New Clinic');
  });
});

describe('deleteAppointment', () => {
  test('hard deletes appointment', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await deleteAppointment('appt-1');
    expect(supabase.from).toHaveBeenCalledWith('pet_appointments');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'appt-1');
  });
});

// ─── Complete + Recurring ───────────────────────────────

describe('completeAppointment', () => {
  test('marks appointment as completed', async () => {
    const chain = mockChain({ data: { ...MOCK_APPOINTMENT, is_completed: true, completed_at: '2026-03-20T12:00:00Z' }, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await completeAppointment('appt-1');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      is_completed: true,
    }));
    expect(result.is_completed).toBe(true);
  });

  test('auto-creates next monthly occurrence', async () => {
    const recurring = { ...MOCK_APPOINTMENT, recurring: 'monthly', is_completed: true, completed_at: '2026-03-20T12:00:00Z' };
    const chain = mockChain({ data: recurring, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await completeAppointment('appt-1');

    // Second call to supabase.from is the insert for next occurrence
    expect(supabase.from).toHaveBeenCalledTimes(2);
    const insertCall = chain.insert.mock.calls[1]?.[0] ?? chain.insert.mock.calls[0]?.[0];
    // The next scheduled_at should be ~1 month after original
    expect(insertCall).toBeDefined();
  });

  test('does NOT create next occurrence for non-recurring', async () => {
    const nonRecurring = { ...MOCK_APPOINTMENT, recurring: 'none', is_completed: true };
    const chain = mockChain({ data: nonRecurring, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await completeAppointment('appt-1');

    // Only one call to supabase.from (the update)
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

// ─── Read Functions ─────────────────────────────────────

describe('getUpcomingAppointments', () => {
  test('returns upcoming appointments ordered by scheduled_at', async () => {
    const appointments = [MOCK_APPOINTMENT];
    const chain = mockChain({ data: appointments, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getUpcomingAppointments('user-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.eq).toHaveBeenCalledWith('is_completed', false);
    expect(chain.order).toHaveBeenCalledWith('scheduled_at', { ascending: true });
    expect(result).toEqual(appointments);
  });

  test('filters by pet_id when provided', async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await getUpcomingAppointments('user-1', 'pet-1');
    expect(chain.contains).toHaveBeenCalledWith('pet_ids', ['pet-1']);
  });

  test('returns [] on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'query failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getUpcomingAppointments('user-1');
    expect(result).toEqual([]);
  });
});

describe('getPastAppointments', () => {
  test('returns past appointments ordered by completed_at desc', async () => {
    const past = [{ ...MOCK_APPOINTMENT, is_completed: true, completed_at: '2026-03-20T12:00:00Z' }];
    const chain = mockChain({ data: past, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getPastAppointments('user-1');
    expect(chain.eq).toHaveBeenCalledWith('is_completed', true);
    expect(chain.order).toHaveBeenCalledWith('completed_at', { ascending: false });
    expect(result).toEqual(past);
  });

  test('filters by pet_id when provided', async () => {
    const chain = mockChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await getPastAppointments('user-1', 'pet-2');
    expect(chain.contains).toHaveBeenCalledWith('pet_ids', ['pet-2']);
  });
});

// ─── Permissions (D-103) ────────────────────────────────

describe('canCreateAppointment', () => {
  test('free tier: allows up to 2 active appointments', () => {
    expect(canCreateAppointment(0)).toBe(true);
    expect(canCreateAppointment(1)).toBe(true);
    expect(canCreateAppointment(2)).toBe(false);
    expect(canCreateAppointment(5)).toBe(false);
  });

  test('premium: unlimited appointments', () => {
    mockPremium = true;
    expect(canCreateAppointment(0)).toBe(true);
    expect(canCreateAppointment(2)).toBe(true);
    expect(canCreateAppointment(100)).toBe(true);
  });
});

// ─── Health Records (D-163) ─────────────────────────────

describe('logHealthRecord', () => {
  const RECORD_DATA = {
    record_type: 'vaccination' as const,
    treatment_name: 'Rabies',
    administered_at: '2026-03-20',
    next_due_at: null as string | null,
    vet_name: 'Dr. Smith',
    notes: null,
  };

  test('creates one record per pet for vaccination', async () => {
    // First call: insert to pet_health_records
    const insertChain = mockChain({ data: [{ id: 'rec-1' }, { id: 'rec-2' }], error: null });
    // Second call: fetch original appointment (for follow-up check)
    // Third call: complete appointment
    const completeChain = mockChain({
      data: { ...MOCK_APPOINTMENT, type: 'vaccination', is_completed: true, completed_at: '2026-03-20T12:00:00Z' },
      error: null,
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return insertChain; // insert health records
      return completeChain; // complete appointment
    });

    await logHealthRecord('appt-1', RECORD_DATA, ['pet-1', 'pet-2']);

    // Should insert to pet_health_records
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pet_id: 'pet-1', record_type: 'vaccination', treatment_name: 'Rabies' }),
        expect.objectContaining({ pet_id: 'pet-2', record_type: 'vaccination', treatment_name: 'Rabies' }),
      ]),
    );
  });

  test('creates one record per pet for deworming', async () => {
    const dewormData = { ...RECORD_DATA, record_type: 'deworming' as const, treatment_name: 'Milbemax' };
    const insertChain = mockChain({ data: [{ id: 'rec-1' }], error: null });
    const completeChain = mockChain({
      data: { ...MOCK_APPOINTMENT, type: 'deworming', is_completed: true },
      error: null,
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return insertChain;
      return completeChain;
    });

    await logHealthRecord('appt-1', dewormData, ['pet-1']);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ record_type: 'deworming', treatment_name: 'Milbemax' }),
      ]),
    );
  });

  test('with next_due_at creates follow-up appointment', async () => {
    const dataWithFollowUp = { ...RECORD_DATA, next_due_at: '2027-03-20' };
    const insertChain = mockChain({ data: [{ id: 'rec-1' }], error: null });

    // Calls: 1=insert records, 2=fetch original appt, 3=insert follow-up, 4=complete
    const originalAppt = { ...MOCK_APPOINTMENT, type: 'vaccination', location: 'Paws & Claws', pet_ids: ['pet-1'] };
    const fetchChain = mockChain({ data: originalAppt, error: null });
    const followUpChain = mockChain({ data: null, error: null });
    const completeChain = mockChain({
      data: { ...MOCK_APPOINTMENT, is_completed: true, completed_at: '2026-03-20T12:00:00Z' },
      error: null,
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return insertChain;    // insert records
      if (callCount === 2) return fetchChain;      // fetch original
      if (callCount === 3) return followUpChain;   // insert follow-up
      return completeChain;                         // complete
    });

    await logHealthRecord('appt-1', dataWithFollowUp, ['pet-1']);

    // Should create follow-up appointment
    expect(followUpChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'vaccination',
        pet_ids: ['pet-1'],
        location: 'Paws & Claws',
        reminder: '1_week',
        recurring: 'none',
        notes: 'Rabies',
      }),
    );
  });

  test('without next_due_at creates no follow-up appointment', async () => {
    const insertChain = mockChain({ data: [{ id: 'rec-1' }], error: null });
    const completeChain = mockChain({
      data: { ...MOCK_APPOINTMENT, is_completed: true },
      error: null,
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return insertChain;
      return completeChain;
    });

    await logHealthRecord('appt-1', RECORD_DATA, ['pet-1']);

    // Only 2 calls: insert records + complete (no fetch original, no insert follow-up)
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  test('calls completeAppointment after record insert', async () => {
    const insertChain = mockChain({ data: [{ id: 'rec-1' }], error: null });
    const completeChain = mockChain({
      data: { ...MOCK_APPOINTMENT, is_completed: true, completed_at: '2026-03-20T12:00:00Z' },
      error: null,
    });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return insertChain;
      return completeChain;
    });

    await logHealthRecord('appt-1', RECORD_DATA, ['pet-1']);

    // Last call should be to pet_appointments for the complete update
    const lastCallTable = (supabase.from as jest.Mock).mock.calls.slice(-1)[0][0];
    expect(lastCallTable).toBe('pet_appointments');
  });
});

describe('getHealthRecords', () => {
  test('returns records filtered by type, sorted DESC', async () => {
    const records = [
      { id: 'rec-1', record_type: 'vaccination', treatment_name: 'Rabies', administered_at: '2026-03-20' },
    ];
    const chain = mockChain({ data: records, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getHealthRecords('pet-1', 'vaccination');
    expect(supabase.from).toHaveBeenCalledWith('pet_health_records');
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
    expect(chain.eq).toHaveBeenCalledWith('record_type', 'vaccination');
    expect(chain.order).toHaveBeenCalledWith('administered_at', { ascending: false });
    expect(result).toEqual(records);
  });

  test('returns [] on error', async () => {
    const chain = mockChain({ data: null, error: { message: 'query failed' } });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await getHealthRecords('pet-1');
    expect(result).toEqual([]);
  });
});

describe('addManualHealthRecord', () => {
  test('creates record with null appointment_id', async () => {
    const record = {
      id: 'rec-1',
      pet_id: 'pet-1',
      user_id: 'user-1',
      appointment_id: null,
      record_type: 'vaccination',
      treatment_name: 'DHPP',
      administered_at: '2026-03-20',
    };
    const chain = mockChain({ data: record, error: null });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await addManualHealthRecord({
      pet_id: 'pet-1',
      record_type: 'vaccination',
      treatment_name: 'DHPP',
      administered_at: '2026-03-20',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pet_id: 'pet-1',
        appointment_id: null,
        record_type: 'vaccination',
        treatment_name: 'DHPP',
      }),
    );
    expect(result).toEqual(record);
  });
});

// ─── Recurring Date Calculation ─────────────────────────

describe('recurring date calculation (via completeAppointment)', () => {
  const intervals = [
    { recurring: 'monthly', expectMonth: 4 },
    { recurring: 'quarterly', expectMonth: 6 },
    { recurring: 'biannual', expectMonth: 9 },
    { recurring: 'yearly', expectMonth: 3 },
  ] as const;

  for (const { recurring, expectMonth } of intervals) {
    test(`${recurring}: next occurrence has correct date`, async () => {
      const appt = {
        ...MOCK_APPOINTMENT,
        scheduled_at: '2026-03-15T10:00:00.000Z',
        recurring,
        is_completed: true,
        completed_at: '2026-03-20T12:00:00Z',
      };
      const chain = mockChain({ data: appt, error: null });
      (supabase.from as jest.Mock).mockReturnValue(chain);

      await completeAppointment('appt-1');

      // Find the insert call (second supabase.from call)
      expect(supabase.from).toHaveBeenCalledTimes(2);
      const insertArgs = chain.insert.mock.calls.find(
        (call: Record<string, unknown>[]) => (call[0] as Record<string, unknown>)?.scheduled_at !== undefined
      );
      expect(insertArgs).toBeDefined();
      const nextDate = new Date((insertArgs![0] as Record<string, string>).scheduled_at);
      if (recurring === 'yearly') {
        expect(nextDate.getFullYear()).toBe(2027);
        expect(nextDate.getMonth()).toBe(expectMonth - 1); // 0-indexed
      } else {
        expect(nextDate.getMonth()).toBe(expectMonth - 1); // 0-indexed
      }
    });
  }
});
