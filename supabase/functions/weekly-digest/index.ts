// supabase/functions/weekly-digest/index.ts
// M5: Weekly/daily digest notification — summarizes scan activity, pantry state, recalls, appointments.
// Triggered by pg_cron: weekly (Sunday 9 AM UTC) and daily (9 AM UTC).
// Accepts { mode: 'weekly' | 'daily' } in POST body.
// D-084: Zero emoji. D-095: No health claims.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH = 100;
const MAX_BODY_LENGTH = 200;
const NEW_ACCOUNT_DAYS = 3;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

// ─── Push Helpers ───────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
  priority: string;
}

async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<string[]> {
  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH) {
    const batch = messages.slice(i, i + EXPO_PUSH_BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error(
          `[weekly-digest] Expo push failed: ${res.status} ${res.statusText}`,
        );
        continue;
      }
      const json = (await res.json()) as {
        data: Array<{
          status: string;
          details?: { error?: string };
        }>;
      };
      for (let j = 0; j < json.data.length; j++) {
        const ticket = json.data[j];
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
        ) {
          deadTokens.push(batch[j].to);
        }
      }
    } catch (err) {
      console.error('[weekly-digest] Expo push error:', err);
    }
  }
  return deadTokens;
}

// ─── Formatting Helpers ─────────────────────────────────

function formatPetLabel(petNames: string[]): string {
  if (petNames.length <= 1) return petNames[0] ?? 'Your pet';
  const others = petNames.length - 1;
  return `${petNames[0]} and ${others} other pet${others > 1 ? 's' : ''}`;
}

function formatAppointmentType(type: string): string {
  switch (type) {
    case 'vet_visit':
      return 'vet visit';
    case 'grooming':
      return 'grooming';
    case 'medication':
      return 'medication';
    case 'vaccination':
      return 'vaccination';
    case 'deworming':
      return 'deworming';
    default:
      return 'appointment';
  }
}

// ─── Types ──────────────────────────────────────────────

interface PantryRow {
  user_id: string;
  quantity_remaining: number;
  serving_mode: string;
  products: {
    name: string;
    brand: string;
    is_recalled: boolean;
  };
}

interface AppointmentRow {
  user_id: string;
  type: string;
  scheduled_at: string;
  pet_ids: string[];
}

interface PantryState {
  totalItems: number;
  lowStockCount: number;
  emptyCount: number;
  recalledNames: string[];
}

// ─── Main Handler ───────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Auth guard: service role bearer token
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const startTime = Date.now();

  // Parse mode from request body
  let mode: 'weekly' | 'daily' = 'weekly';
  try {
    const body = await req.json();
    if (body.mode === 'daily') mode = 'daily';
  } catch {
    // Default to weekly
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
  );

  // ── 1. Get eligible users (matching digest_frequency, notifications enabled) ──

  const { data: settingsRows, error: settingsError } = await supabase
    .from('user_settings')
    .select('user_id, created_at')
    .eq('notifications_enabled', true)
    .eq('digest_frequency', mode);

  if (settingsError) {
    console.error('[weekly-digest] Settings query failed:', settingsError);
    return jsonResponse({ error: 'Settings query failed' }, 500);
  }

  if (!settingsRows || settingsRows.length === 0) {
    return jsonResponse({
      users_notified: 0,
      messages_sent: 0,
      mode,
      duration_ms: Date.now() - startTime,
    });
  }

  // Filter out accounts < 3 days old (avoid spamming during onboarding)
  const ageCutoff = new Date();
  ageCutoff.setDate(ageCutoff.getDate() - NEW_ACCOUNT_DAYS);
  const eligibleUsers = settingsRows.filter(
    (s) => new Date(s.created_at) < ageCutoff,
  );

  if (eligibleUsers.length === 0) {
    return jsonResponse({
      users_notified: 0,
      messages_sent: 0,
      mode,
      duration_ms: Date.now() - startTime,
    });
  }

  const userIds = eligibleUsers.map((s) => s.user_id);

  // ── 2. Batch fetch all data in parallel ──

  const lookbackDays = mode === 'weekly' ? 7 : 1;
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
  const lookbackISO = lookbackDate.toISOString();

  const appointmentEnd = new Date();
  appointmentEnd.setDate(
    appointmentEnd.getDate() + (mode === 'weekly' ? 7 : 1),
  );
  const appointmentEndISO = appointmentEnd.toISOString();
  const nowISO = new Date().toISOString();

  const [tokensRes, petsRes, scansRes, pantryRes, appointmentsRes] =
    await Promise.all([
      supabase
        .from('push_tokens')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .eq('is_active', true),

      supabase
        .from('pets')
        .select('id, user_id, name')
        .in('user_id', userIds),

      supabase
        .from('scan_history')
        .select('user_id')
        .in('user_id', userIds)
        .gte('scanned_at', lookbackISO),

      supabase
        .from('pantry_items')
        .select(
          'user_id, quantity_remaining, serving_mode, ' +
            'products(name, brand, is_recalled)',
        )
        .in('user_id', userIds)
        .eq('is_active', true),

      supabase
        .from('pet_appointments')
        .select('user_id, type, scheduled_at, pet_ids')
        .in('user_id', userIds)
        .eq('is_completed', false)
        .gte('scheduled_at', nowISO)
        .lte('scheduled_at', appointmentEndISO),
    ]);

  // ── 3. Build lookup maps ──

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokensRes.data ?? []) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.expo_push_token);
    tokensByUser.set(row.user_id, list);
  }

  const petsByUser = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of petsRes.data ?? []) {
    const list = petsByUser.get(row.user_id) ?? [];
    list.push({ id: row.id, name: row.name });
    petsByUser.set(row.user_id, list);
  }

  const scanCountByUser = new Map<string, number>();
  for (const row of scansRes.data ?? []) {
    scanCountByUser.set(
      row.user_id,
      (scanCountByUser.get(row.user_id) ?? 0) + 1,
    );
  }

  const pantryByUser = new Map<string, PantryState>();
  for (const row of (pantryRes.data ?? []) as unknown as PantryRow[]) {
    const state = pantryByUser.get(row.user_id) ?? {
      totalItems: 0,
      lowStockCount: 0,
      emptyCount: 0,
      recalledNames: [],
    };
    state.totalItems++;

    if (row.quantity_remaining <= 0) {
      state.emptyCount++;
    } else if (row.serving_mode === 'unit' && row.quantity_remaining <= 5) {
      state.lowStockCount++;
    }

    if (row.products.is_recalled) {
      state.recalledNames.push(row.products.name);
    }

    pantryByUser.set(row.user_id, state);
  }

  const appointmentsByUser = new Map<string, AppointmentRow[]>();
  for (const row of (appointmentsRes.data ??
    []) as unknown as AppointmentRow[]) {
    const list = appointmentsByUser.get(row.user_id) ?? [];
    list.push(row);
    appointmentsByUser.set(row.user_id, list);
  }

  // ── 4. Build push messages (one per user, sent to all their tokens) ──

  const messages: ExpoPushMessage[] = [];
  let usersNotified = 0;

  for (const userId of userIds) {
    const tokens = tokensByUser.get(userId);
    if (!tokens || tokens.length === 0) continue;

    const pets = petsByUser.get(userId);
    if (!pets || pets.length === 0) continue;

    const scanCount = scanCountByUser.get(userId) ?? 0;
    const pantry = pantryByUser.get(userId);
    const appointments = appointmentsByUser.get(userId) ?? [];

    const petNames = pets.map((p) => p.name);
    const primaryPet = petNames[0];
    const petLabel = formatPetLabel(petNames);

    // Build body parts — prioritized, concatenated up to MAX_BODY_LENGTH
    const parts: string[] = [];

    // P1: Recall alerts (always first if present)
    if (pantry && pantry.recalledNames.length > 0) {
      if (pantry.recalledNames.length === 1) {
        parts.push(
          `Recall Alert: ${truncate(pantry.recalledNames[0], 30)} in ${primaryPet}'s pantry.`,
        );
      } else {
        parts.push(
          `Recall Alert: ${pantry.recalledNames.length} recalled products in pantry.`,
        );
      }
    }

    // P2: Upcoming appointments (nearest first)
    if (appointments.length > 0) {
      const sorted = [...appointments].sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      );
      const next = sorted[0];
      const apptDate = new Date(next.scheduled_at);
      const dayStr = apptDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const apptPet =
        pets.find((p) => next.pet_ids.includes(p.id))?.name ?? primaryPet;
      parts.push(
        `${apptPet}'s ${formatAppointmentType(next.type)} coming up ${dayStr}.`,
      );
    }

    // P3: Activity summary
    const timeframe = mode === 'weekly' ? 'week' : 'day';

    if (scanCount > 0) {
      parts.push(
        `${petLabel} had a busy ${timeframe}! ${scanCount} product${scanCount > 1 ? 's' : ''} scanned.`,
      );
    } else if (pantry && pantry.totalItems > 0) {
      if (mode === 'weekly') {
        parts.push(
          `Haven't scanned in a while? ${primaryPet}'s pantry has ${pantry.totalItems} item${pantry.totalItems > 1 ? 's' : ''} tracked.`,
        );
      } else {
        parts.push(
          `${primaryPet}'s pantry has ${pantry.totalItems} item${pantry.totalItems > 1 ? 's' : ''} tracked.`,
        );
      }
    } else {
      // Cold start — no scans, no pantry
      parts.push(
        `Scan ${primaryPet}'s food to see how it scores.`,
      );
    }

    // P4: Low stock / empty summary
    if (pantry) {
      const stockParts: string[] = [];
      if (pantry.emptyCount > 0) {
        stockParts.push(`${pantry.emptyCount} empty`);
      }
      if (pantry.lowStockCount > 0) {
        stockParts.push(`${pantry.lowStockCount} running low`);
      }
      if (stockParts.length > 0) {
        parts.push(stockParts.join(', ') + '.');
      }
    }

    // Assemble body respecting 200 char limit
    let body = '';
    for (const part of parts) {
      const candidate = body ? `${body} ${part}` : part;
      if (candidate.length > MAX_BODY_LENGTH) {
        if (!body) body = truncate(part, MAX_BODY_LENGTH);
        break;
      }
      body = candidate;
    }

    if (!body) continue;

    // Title
    const titleLabel = mode === 'weekly' ? 'Weekly Summary' : 'Daily Summary';
    const title =
      petNames.length === 1
        ? `${primaryPet}'s ${titleLabel}`
        : titleLabel;

    for (const token of tokens) {
      messages.push({
        to: token,
        title: truncate(title, 65),
        body,
        data: { type: 'digest', screen: 'Home' },
        sound: 'default',
        priority: 'default',
      });
    }

    usersNotified++;
  }

  // ── 5. Send push notifications + dead token cleanup ──

  if (messages.length > 0) {
    const deadTokens = await sendExpoPush(messages);

    if (deadTokens.length > 0) {
      const { error: deactivateError } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('expo_push_token', deadTokens);

      if (deactivateError) {
        console.error(
          '[weekly-digest] Failed to deactivate tokens:',
          deactivateError,
        );
      } else {
        console.log(
          `[weekly-digest] Deactivated ${deadTokens.length} dead token(s)`,
        );
      }
    }
  }

  // ── 6. Response ──

  return jsonResponse({
    users_notified: usersNotified,
    messages_sent: messages.length,
    mode,
    duration_ms: Date.now() - startTime,
  });
});
