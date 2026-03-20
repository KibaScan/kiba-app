// supabase/functions/auto-deplete/index.ts
// M5: Server-side cron — deducts pantry quantities daily, sends low stock / empty push notifications.
// Triggered every 30 min by pg_cron via pg_net. Uses daily-total deduction (timezone-agnostic).
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

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Unit Conversion Helpers ────────────────────────────

/**
 * Convert a daily serving in cups to the item's quantity_unit.
 * Two-step: cups → kg (via calorie density or fallback) → quantity_unit.
 * Constants are the inverse of convertToKg() in pantryHelpers.ts.
 */
function cupsToDeduction(
  dailyCups: number,
  quantityUnit: string,
  kcalPerCup: number | null,
  kcalPerKg: number | null,
): number {
  // Step 1: cups → kg
  const kgPerCup =
    kcalPerCup && kcalPerKg && kcalPerCup > 0 && kcalPerKg > 0
      ? kcalPerCup / kcalPerKg // calorie-based (accurate)
      : 0.1134; // fallback: 1 cup ≈ 113.4g dry kibble
  const deductionKg = dailyCups * kgPerCup;

  // Step 2: kg → quantity_unit
  switch (quantityUnit) {
    case 'kg':
      return deductionKg;
    case 'g':
      return deductionKg * 1000;
    case 'lbs':
      return deductionKg * 2.205;
    case 'oz':
      return deductionKg * 35.274;
    default:
      return 0;
  }
}

/**
 * Compute days remaining for low stock check (weight mode).
 * Mirrors calculateDaysRemaining() in pantryHelpers.ts.
 */
function computeDaysRemaining(
  remaining: number,
  dailyCups: number,
  quantityUnit: string,
  kcalPerCup: number | null,
  kcalPerKg: number | null,
): number | null {
  if (dailyCups <= 0) return null;
  if (!kcalPerCup || !kcalPerKg || kcalPerCup <= 0 || kcalPerKg <= 0)
    return null;

  // Convert remaining quantity to kg, then to cups
  let remainingKg: number;
  switch (quantityUnit) {
    case 'kg':
      remainingKg = remaining;
      break;
    case 'g':
      remainingKg = remaining / 1000;
      break;
    case 'lbs':
      remainingKg = remaining / 2.205;
      break;
    case 'oz':
      remainingKg = remaining / 35.274;
      break;
    default:
      return null;
  }
  const totalCups = (remainingKg * kcalPerKg) / kcalPerCup;
  return totalCups / dailyCups;
}

/**
 * Low stock check — matches pantryHelpers.ts:89-99.
 */
function isLowStock(
  remaining: number,
  daysRemaining: number | null,
  servingMode: string,
): boolean {
  if (servingMode === 'weight') {
    return daysRemaining != null && daysRemaining <= 5;
  }
  return remaining <= 5 || (daysRemaining != null && daysRemaining <= 5);
}

// ─── Notification Helpers ───────────────────────────────

/**
 * Strip redundant brand prefix from product name.
 * Copy of formatters.ts:61-89 (Deno can't import from src/).
 */
function stripBrandFromName(
  brandName: string,
  productName: string,
): string {
  if (!brandName || !productName) return productName;
  const lower = productName.toLowerCase();
  const brandLower = brandName.toLowerCase();

  if (lower.startsWith(brandLower)) {
    const remainder = productName
      .slice(brandName.length)
      .replace(/^[\s\-\u2013\u2014]+/, '');
    if (remainder.length >= 10) return remainder;
    return productName;
  }

  if (brandLower.length < 5) return productName;
  const searchZone = lower.slice(0, 40);
  const idx = searchZone.indexOf(brandLower);
  if (idx < 0) return productName;
  if (idx > 0 && searchZone[idx - 1] !== ' ') return productName;
  const afterIdx = idx + brandLower.length;
  if (afterIdx < lower.length && lower[afterIdx] !== ' ') return productName;

  const remainder = productName
    .slice(afterIdx)
    .replace(/^[\s\-\u2013\u2014]+/, '');
  if (remainder.length < 10) return productName;
  return remainder;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
  priority: string;
}

/**
 * Send push notifications via Expo Push API.
 * Returns tokens that should be deactivated (DeviceNotRegistered).
 */
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
          `[auto-deplete] Expo push failed: ${res.status} ${res.statusText}`,
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
      console.error('[auto-deplete] Expo push error:', err);
    }
  }
  return deadTokens;
}

// ─── Types ──────────────────────────────────────────────

interface AssignmentRow {
  pet_id: string;
  serving_size: number;
  serving_size_unit: string;
  feedings_per_day: number;
  notifications_on: boolean;
  pantry_items: {
    id: string;
    user_id: string;
    quantity_remaining: number;
    quantity_unit: string;
    serving_mode: string;
    unit_label: string | null;
    last_deducted_at: string | null;
    products: {
      name: string;
      brand: string;
      ga_kcal_per_cup: number | null;
      ga_kcal_per_kg: number | null;
    };
  };
  pets: {
    name: string;
  };
}

interface ItemGroup {
  itemId: string;
  userId: string;
  oldRemaining: number;
  quantityUnit: string;
  servingMode: string;
  unitLabel: string | null;
  productName: string;
  kcalPerCup: number | null;
  kcalPerKg: number | null;
  totalDeduction: number;
  totalDailyCups: number; // for daysRemaining calc (weight mode)
  petNotifications: Array<{
    petName: string;
    notificationsOn: boolean;
  }>;
}

// ─── Main Handler ───────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Auth guard: verify service role bearer token
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const startTime = Date.now();

  // Service role client — bypasses RLS (system-level cron)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
  );

  // ── 1. Compute today boundary (UTC) ──

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  // ── 2. Query eligible assignments ──
  // Daily assignments on active items with remaining > 0, not yet deducted today.
  // Returns one row per assignment; shared items appear multiple times.

  const { data: rows, error: queryError } = await supabase
    .from('pantry_pet_assignments')
    .select(
      'pet_id, serving_size, serving_size_unit, feedings_per_day, notifications_on, ' +
        'pantry_items!inner(id, user_id, quantity_remaining, quantity_unit, serving_mode, unit_label, last_deducted_at, ' +
        'products(name, brand, ga_kcal_per_cup, ga_kcal_per_kg)), ' +
        'pets(name)',
    )
    .eq('feeding_frequency', 'daily');

  if (queryError) {
    console.error('[auto-deplete] Query failed:', queryError);
    return jsonResponse({ error: 'Query failed' }, 500);
  }

  if (!rows || rows.length === 0) {
    return jsonResponse({
      items_deducted: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // ── 3. Filter & group by pantry_item_id ──

  const itemGroups = new Map<string, ItemGroup>();

  for (const row of rows as unknown as AssignmentRow[]) {
    const item = row.pantry_items;

    // Filter: active, has remaining, not deducted today
    if (item.quantity_remaining <= 0) continue;
    if (
      item.last_deducted_at &&
      new Date(item.last_deducted_at) >= todayStart
    ) {
      continue;
    }

    const product = item.products;
    const productDisplayName = truncate(
      stripBrandFromName(product.brand, product.name),
      30,
    );

    let group = itemGroups.get(item.id);
    if (!group) {
      group = {
        itemId: item.id,
        userId: item.user_id,
        oldRemaining: item.quantity_remaining,
        quantityUnit: item.quantity_unit,
        servingMode: item.serving_mode,
        unitLabel: item.unit_label,
        productName: productDisplayName,
        kcalPerCup: product.ga_kcal_per_cup,
        kcalPerKg: product.ga_kcal_per_kg,
        totalDeduction: 0,
        totalDailyCups: 0,
        petNotifications: [],
      };
      itemGroups.set(item.id, group);
    }

    // Compute this assignment's daily deduction
    const dailyServing = row.serving_size * row.feedings_per_day;

    if (item.serving_mode === 'unit') {
      group.totalDeduction += dailyServing;
    } else {
      // Weight mode: cups/scoops → quantity_unit (scoops treated as cups)
      const deduction = cupsToDeduction(
        dailyServing,
        item.quantity_unit,
        product.ga_kcal_per_cup,
        product.ga_kcal_per_kg,
      );
      group.totalDeduction += deduction;
      group.totalDailyCups += dailyServing;
    }

    group.petNotifications.push({
      petName: row.pets?.name ?? 'Your pet',
      notificationsOn: row.notifications_on,
    });
  }

  if (itemGroups.size === 0) {
    return jsonResponse({
      items_deducted: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // ── 4. Apply deductions & detect state transitions ──

  interface Transition {
    type: 'empty' | 'low_stock';
    userId: string;
    petName: string;
    productName: string;
    unitLabel: string | null;
    servingMode: string;
    daysRemaining: number | null;
    newRemaining: number;
  }

  const transitions: Transition[] = [];
  let itemsDeducted = 0;

  for (const group of itemGroups.values()) {
    const newRemaining = Math.max(
      0,
      group.oldRemaining - group.totalDeduction,
    );

    // Apply deduction with idempotency guard
    const { error: updateError } = await supabase
      .from('pantry_items')
      .update({
        quantity_remaining: Math.round(newRemaining * 100) / 100,
        last_deducted_at: new Date().toISOString(),
      })
      .eq('id', group.itemId)
      .or(
        `last_deducted_at.is.null,last_deducted_at.lt.${todayStartISO}`,
      );

    if (updateError) {
      console.error(
        `[auto-deplete] Update failed for item ${group.itemId}:`,
        updateError,
      );
      continue;
    }

    itemsDeducted++;

    // Detect state transitions for notifications
    const petsWantingNotifications = group.petNotifications.filter(
      (p) => p.notificationsOn,
    );
    if (petsWantingNotifications.length === 0) continue;

    // Empty transition
    if (group.oldRemaining > 0 && newRemaining <= 0) {
      for (const pet of petsWantingNotifications) {
        transitions.push({
          type: 'empty',
          userId: group.userId,
          petName: pet.petName,
          productName: group.productName,
          unitLabel: group.unitLabel,
          servingMode: group.servingMode,
          daysRemaining: null,
          newRemaining: 0,
        });
      }
      continue; // empty supersedes low stock
    }

    // Low stock transition
    let oldDays: number | null = null;
    let newDays: number | null = null;

    if (group.servingMode === 'weight') {
      oldDays = computeDaysRemaining(
        group.oldRemaining,
        group.totalDailyCups,
        group.quantityUnit,
        group.kcalPerCup,
        group.kcalPerKg,
      );
      newDays = computeDaysRemaining(
        newRemaining,
        group.totalDailyCups,
        group.quantityUnit,
        group.kcalPerCup,
        group.kcalPerKg,
      );
    }

    const wasLow = isLowStock(
      group.oldRemaining,
      oldDays,
      group.servingMode,
    );
    const isLow = isLowStock(newRemaining, newDays, group.servingMode);

    if (!wasLow && isLow) {
      for (const pet of petsWantingNotifications) {
        transitions.push({
          type: 'low_stock',
          userId: group.userId,
          petName: pet.petName,
          productName: group.productName,
          unitLabel: group.unitLabel,
          servingMode: group.servingMode,
          daysRemaining: newDays,
          newRemaining,
        });
      }
    }
  }

  // ── 5. Send push notifications ──

  let notificationsSent = 0;

  if (transitions.length > 0) {
    // Collect unique user IDs
    const userIds = [...new Set(transitions.map((t) => t.userId))];

    // Batch fetch push tokens + user settings
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    const { data: settingsRows } = await supabase
      .from('user_settings')
      .select(
        'user_id, notifications_enabled, low_stock_alerts_enabled, empty_alerts_enabled',
      )
      .in('user_id', userIds);

    // Build lookup maps
    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows ?? []) {
      const tokens = tokensByUser.get(row.user_id) ?? [];
      tokens.push(row.expo_push_token);
      tokensByUser.set(row.user_id, tokens);
    }

    const settingsByUser = new Map<
      string,
      {
        notifications_enabled: boolean;
        low_stock_alerts_enabled: boolean;
        empty_alerts_enabled: boolean;
      }
    >();
    for (const row of settingsRows ?? []) {
      settingsByUser.set(row.user_id, row);
    }

    // Build push messages
    const messages: ExpoPushMessage[] = [];

    for (const t of transitions) {
      const tokens = tokensByUser.get(t.userId);
      if (!tokens || tokens.length === 0) continue;

      const settings = settingsByUser.get(t.userId);
      // Default to enabled if no settings row exists (matches migration defaults)
      const notificationsEnabled = settings?.notifications_enabled ?? true;
      const categoryEnabled =
        t.type === 'empty'
          ? (settings?.empty_alerts_enabled ?? true)
          : (settings?.low_stock_alerts_enabled ?? true);

      if (!notificationsEnabled || !categoryEnabled) continue;

      let title: string;
      let body: string;

      if (t.type === 'empty') {
        title = `${t.petName}'s ${t.productName} is empty`;
        body = 'Restock or remove from pantry';
      } else {
        title = 'Running low';
        if (
          t.servingMode === 'unit' ||
          t.daysRemaining == null
        ) {
          // Unit mode or weight mode without calorie data
          const label =
            t.unitLabel && t.unitLabel !== 'units'
              ? t.unitLabel
              : 'left';
          const qty = Math.floor(t.newRemaining);
          body =
            label === 'left'
              ? `${qty} remaining of ${t.productName} for ${t.petName}`
              : `${qty} ${label} of ${t.productName} remaining for ${t.petName}`;
        } else {
          const days = Math.floor(t.daysRemaining);
          body = `~${days} days of ${t.productName} remaining for ${t.petName}`;
        }
      }

      for (const token of tokens) {
        messages.push({
          to: token,
          title,
          body,
          data: { type: t.type },
          sound: 'default',
          priority: 'high',
        });
      }
      notificationsSent++;
    }

    // Send and handle dead tokens
    if (messages.length > 0) {
      const deadTokens = await sendExpoPush(messages);

      if (deadTokens.length > 0) {
        const { error: deactivateError } = await supabase
          .from('push_tokens')
          .update({ is_active: false })
          .in('expo_push_token', deadTokens);

        if (deactivateError) {
          console.error(
            '[auto-deplete] Failed to deactivate tokens:',
            deactivateError,
          );
        } else {
          console.log(
            `[auto-deplete] Deactivated ${deadTokens.length} dead token(s)`,
          );
        }
      }
    }
  }

  // ── 6. Response ──

  return jsonResponse({
    items_deducted: itemsDeducted,
    notifications_sent: notificationsSent,
    duration_ms: Date.now() - startTime,
  });
});
