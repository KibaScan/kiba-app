// M5 Appointment Service — Supabase CRUD with offline guards (D-103).
// Follows pantryService.ts patterns.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import type {
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  RecurringOption,
  PetHealthRecord,
  HealthRecordType,
} from '../types/appointment';

// ─── Internal ───────────────────────────────────────────

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new Error('Connect to the internet to manage appointments.');
}

function getNextDate(date: string, recurring: RecurringOption): string {
  const d = new Date(date);
  switch (recurring) {
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'biannual':  d.setMonth(d.getMonth() + 6); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
    default: break;
  }
  return d.toISOString();
}

// ─── Write Functions ────────────────────────────────────

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<Appointment> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pet_appointments')
    .insert({
      user_id: session.user.id,
      type: input.type,
      custom_label: input.custom_label ?? null,
      scheduled_at: input.scheduled_at,
      pet_ids: input.pet_ids,
      location: input.location ?? null,
      notes: input.notes ?? null,
      reminder: input.reminder ?? '1_day',
      recurring: input.recurring ?? 'none',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create appointment: ${error.message}`);
  return data as Appointment;
}

export async function updateAppointment(
  id: string,
  updates: UpdateAppointmentInput,
): Promise<Appointment> {
  await requireOnline();

  const { data, error } = await supabase
    .from('pet_appointments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update appointment: ${error.message}`);
  return data as Appointment;
}

export async function deleteAppointment(id: string): Promise<void> {
  await requireOnline();

  const { error } = await supabase
    .from('pet_appointments')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete appointment: ${error.message}`);
}

export async function completeAppointment(id: string): Promise<Appointment> {
  await requireOnline();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('pet_appointments')
    .update({ is_completed: true, completed_at: now, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete appointment: ${error.message}`);

  const completed = data as Appointment;

  // Auto-create next occurrence for recurring appointments
  if (completed.recurring !== 'none') {
    const { error: nextErr } = await supabase
      .from('pet_appointments')
      .insert({
        user_id: completed.user_id,
        type: completed.type,
        custom_label: completed.custom_label,
        scheduled_at: getNextDate(completed.scheduled_at, completed.recurring),
        pet_ids: completed.pet_ids,
        location: completed.location,
        notes: completed.notes,
        reminder: completed.reminder,
        recurring: completed.recurring,
      });
    if (nextErr) throw new Error(`Failed to create next recurring appointment: ${nextErr.message}`);
  }

  return completed;
}

// ─── Read Functions ─────────────────────────────────────

export async function getUpcomingAppointments(
  userId: string,
  petId?: string,
): Promise<Appointment[]> {
  try {
    let query = supabase
      .from('pet_appointments')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('scheduled_at', { ascending: true });

    if (petId) {
      query = query.contains('pet_ids', [petId]);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as Appointment[];
  } catch {
    return [];
  }
}

export async function getPastAppointments(
  userId: string,
  petId?: string,
): Promise<Appointment[]> {
  try {
    let query = supabase
      .from('pet_appointments')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false });

    if (petId) {
      query = query.contains('pet_ids', [petId]);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as Appointment[];
  } catch {
    return [];
  }
}

// ─── Health Records (D-163) ────────────────────────────

export async function logHealthRecord(
  appointmentId: string,
  recordData: {
    record_type: HealthRecordType;
    treatment_name: string;
    administered_at: string;
    next_due_at?: string | null;
    vet_name?: string | null;
    notes?: string | null;
  },
  petIds: string[],
): Promise<PetHealthRecord[]> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  // Insert one record per pet
  const rows = petIds.map((petId) => ({
    pet_id: petId,
    user_id: session.user.id,
    appointment_id: appointmentId,
    record_type: recordData.record_type,
    treatment_name: recordData.treatment_name,
    administered_at: recordData.administered_at,
    next_due_at: recordData.next_due_at ?? null,
    vet_name: recordData.vet_name ?? null,
    notes: recordData.notes ?? null,
  }));

  const { data, error } = await supabase
    .from('pet_health_records')
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to log health record: ${error.message}`);

  // Create follow-up appointment if next_due_at provided
  if (recordData.next_due_at) {
    const { data: apptData } = await supabase
      .from('pet_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptData) {
      const original = apptData as Appointment;
      await supabase
        .from('pet_appointments')
        .insert({
          user_id: session.user.id,
          type: original.type,
          custom_label: original.custom_label,
          scheduled_at: new Date(recordData.next_due_at + 'T10:00:00').toISOString(),
          pet_ids: original.pet_ids,
          location: original.location,
          notes: recordData.treatment_name,
          reminder: '1_week',
          recurring: 'none',
        });
    }
  }

  // Complete the appointment
  await completeAppointment(appointmentId);

  return (data ?? []) as PetHealthRecord[];
}

export async function getHealthRecords(
  petId: string,
  recordType?: HealthRecordType,
): Promise<PetHealthRecord[]> {
  try {
    let query = supabase
      .from('pet_health_records')
      .select('*')
      .eq('pet_id', petId)
      .order('administered_at', { ascending: false });

    if (recordType) {
      query = query.eq('record_type', recordType);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as PetHealthRecord[];
  } catch {
    return [];
  }
}

export async function addManualHealthRecord(
  recordData: {
    pet_id: string;
    record_type: HealthRecordType;
    treatment_name: string;
    administered_at: string;
    next_due_at?: string | null;
    vet_name?: string | null;
    notes?: string | null;
  },
): Promise<PetHealthRecord> {
  await requireOnline();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pet_health_records')
    .insert({
      pet_id: recordData.pet_id,
      user_id: session.user.id,
      appointment_id: null,
      record_type: recordData.record_type,
      treatment_name: recordData.treatment_name,
      administered_at: recordData.administered_at,
      next_due_at: recordData.next_due_at ?? null,
      vet_name: recordData.vet_name ?? null,
      notes: recordData.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add health record: ${error.message}`);
  return data as PetHealthRecord;
}
