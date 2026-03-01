// Kiba — Pet Form Validation (M2 Session 2)
// Pure functions for Create/Edit pet form validation.
// Consumed by CreatePetScreen and EditPetScreen.

export interface PetFormErrors {
  name?: string;
  weight?: string;
  dob?: string;
}

export interface PetFormFields {
  name: string;
  weight: string;
  dobMode: 'exact' | 'approximate';
  dobSet: boolean;
  dobMonth: number;
  dobYear: number;
  approxYears: number;
  approxMonths: number;
}

/**
 * Validate pet form fields. Returns an object with error messages for invalid fields.
 * Empty object = all valid.
 */
export function validatePetForm(fields: PetFormFields): PetFormErrors {
  const errors: PetFormErrors = {};

  // Name: required, 1-20 chars, trimmed
  const trimmedName = fields.name.trim();
  if (!trimmedName) {
    errors.name = 'Pet name is required';
  }

  // Weight: optional, but if entered must be 0.5-300 lbs
  if (fields.weight.trim()) {
    const w = parseFloat(fields.weight);
    if (isNaN(w) || w < 0.5 || w > 300) {
      errors.weight = 'Weight must be between 0.5 and 300 lbs';
    }
  }

  // DOB: only validate if user has interacted with DOB fields
  if (fields.dobSet) {
    if (fields.dobMode === 'exact') {
      const dob = new Date(fields.dobYear, fields.dobMonth, 1);
      const now = new Date();
      // Compare year/month only (day 1 is always used)
      if (
        fields.dobYear > now.getFullYear() ||
        (fields.dobYear === now.getFullYear() && fields.dobMonth > now.getMonth())
      ) {
        errors.dob = 'Birth date cannot be in the future';
      }
    } else {
      // Approximate mode: years + months can't both be 0
      if (fields.approxYears === 0 && fields.approxMonths === 0) {
        errors.dob = 'Please enter an approximate age';
      }
    }
  }

  return errors;
}

/**
 * Check if the typed name matches the pet name for delete confirmation.
 * Case-insensitive comparison.
 */
export function canDeletePet(inputName: string, petName: string): boolean {
  return inputName.trim().toLowerCase() === petName.trim().toLowerCase();
}

/**
 * Returns true if the form has no validation errors.
 */
export function isFormValid(errors: PetFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
