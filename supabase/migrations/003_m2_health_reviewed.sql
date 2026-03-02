-- Kiba — M2 Health Review Tracking
-- Adds health_reviewed_at to distinguish "Perfectly Healthy" (0 rows, reviewed)
-- from "never visited HealthConditionsScreen" (0 rows, not reviewed).
-- Used by PetHubScreen Score Accuracy calculation.

ALTER TABLE pets ADD COLUMN health_reviewed_at TIMESTAMPTZ;
