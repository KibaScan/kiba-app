// Kiba — M5 Appointment Types (D-103)
// Matches pet_appointments table (migration 017).

// Union types matching SQL CHECK constraints
export type AppointmentType = 'vet_visit' | 'grooming' | 'medication' | 'vaccination' | 'deworming' | 'other';
export type HealthRecordType = 'vaccination' | 'deworming';
export type ReminderOption = 'off' | '1_hour' | '1_day' | '3_days' | '1_week';
export type RecurringOption = 'none' | 'monthly' | 'quarterly' | 'biannual' | 'yearly';

/** Matches pet_appointments table exactly (14 columns). */
export interface Appointment {
  id: string;
  user_id: string;
  type: AppointmentType;
  custom_label: string | null;
  scheduled_at: string;
  pet_ids: string[];
  location: string | null;
  notes: string | null;
  reminder: ReminderOption;
  recurring: RecurringOption;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentInput {
  type: AppointmentType;
  custom_label?: string;
  scheduled_at: string;
  pet_ids: string[];
  location?: string;
  notes?: string;
  reminder?: ReminderOption;
  recurring?: RecurringOption;
}

export interface UpdateAppointmentInput {
  type?: AppointmentType;
  custom_label?: string | null;
  scheduled_at?: string;
  pet_ids?: string[];
  location?: string | null;
  notes?: string | null;
  reminder?: ReminderOption;
  recurring?: RecurringOption;
}

/** Matches pet_health_records table (D-163). */
export interface PetHealthRecord {
  id: string;
  pet_id: string;
  user_id: string;
  appointment_id: string | null;
  record_type: HealthRecordType;
  treatment_name: string;
  administered_at: string;
  next_due_at: string | null;
  vet_name: string | null;
  notes: string | null;
  created_at: string;
}
