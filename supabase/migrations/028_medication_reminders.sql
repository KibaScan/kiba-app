-- Migration 028: Medication reminders + duration
-- Adds reminder_times (up to 4 daily "HH:MM" times) and duration_days to pet_medications.
-- Adds medication_reminders_enabled toggle to user_settings.

ALTER TABLE pet_medications ADD COLUMN IF NOT EXISTS reminder_times TEXT[] DEFAULT '{}';
ALTER TABLE pet_medications ADD COLUMN IF NOT EXISTS duration_days INTEGER;

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS medication_reminders_enabled BOOLEAN DEFAULT true;
