// Kiba — Anonymous Auth (dev placeholder)
// Signs in anonymously on startup so RLS policies work.
// Replace with real auth (email/social) in a later milestone.

import { supabase } from './supabase';

/**
 * Ensures a Supabase session exists. If no session is found,
 * signs in anonymously to provide a real auth.uid() for RLS.
 */
export async function ensureAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    return;
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[Kiba Auth] Anonymous sign-in failed:', error.message);
  }
}
