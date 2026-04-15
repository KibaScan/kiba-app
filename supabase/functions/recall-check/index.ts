// supabase/functions/recall-check/index.ts
// M5 Recall Siren: Daily FDA recall detection pipeline.
// Triggered daily at 6:00 AM UTC by pg_cron via pg_net.
// Fetches FDA animal food recall RSS, matches against products DB,
// flags HIGH-confidence matches, queues MEDIUM for review, pushes affected pantry users.
// D-125: No premium checks — recall alerts are always free.
// D-084: Zero emoji in push notifications.
// D-095: Factual tone — "has been recalled by the FDA."

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH = 100;
const QUERY_PAGE = 1000;

// Default FDA animal/veterinary recall RSS feed
const DEFAULT_FDA_RSS_URL =
  'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml';

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Matching Algorithm Constants ──────────────────────────────

const STOPWORDS = new Set([
  'recipe', 'formula', 'for', 'with', 'adult', 'puppy', 'kitten',
  'senior', 'dog', 'cat', 'dogs', 'cats', 'food', 'the', 'and',
  'a', 'an', 'in', 'of', 'complete', 'nutrition', 'pet',
]);

const COMPANY_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'corp', 'corporation', 'ltd',
  'company', 'co', 'foods', 'packing', 'animal', 'group',
  'industries', 'enterprises', 'manufacturing', 'mfg',
]);

const GENERIC_SINGLE_WORDS = new Set([
  'natural', 'premium', 'best', 'original', 'classic', 'pure',
  'healthy', 'wholesome', 'select', 'choice', 'good',
]);

/**
 * Known parent company → subsidiary brand mappings.
 * Enables MEDIUM-confidence matching when FDA names a parent company
 * but the DB stores products under the subsidiary brand.
 * Expandable as new relationships emerge.
 */
const PARENT_BRAND_MAP: Record<string, string[]> = {
  'midwestern pet foods': [
    'sportmix', 'splash', 'nunn better', 'pro pac', 'unrefined',
  ],
  'sunshine mills': ['nurture farms', 'family pet'],
  'diamond pet foods': [
    'diamond', 'diamond naturals', 'taste of the wild', '4health',
  ],
  'ainsworth pet nutrition': ['rachael ray nutrish'],
  'carnivore meat company': ['vital essentials'],
  'american nutrition': ['heart to tail', 'paws happy life'],
  'bravo packing': ['bravo'],
};

const SEGMENT_SEPARATORS = /\s*[—–:\/]\s*/;

// ─── RSS Parsing ───────────────────────────────────────────────

interface FdaRecallItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  lotNumbers: string[] | null;
}

/**
 * Extract text content between XML tags.
 * Simple regex approach — RSS 2.0 is flat enough that a full XML parser is unnecessary.
 */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return (match[1] ?? match[2] ?? '').trim();
}

/**
 * Parse lot numbers from description text.
 * FDA descriptions often include "Lot numbers: X, Y, Z" or "Lot #: X".
 */
function parseLotNumbers(description: string): string[] | null {
  const regex = /lot\s*(?:numbers?|#|nos?\.?)\s*[:\s]*([\w\-,\s]+)/i;
  const match = description.match(regex);
  if (!match) return null;
  const lots = match[1]
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 50);
  return lots.length > 0 ? lots : null;
}

/**
 * Parse FDA recall RSS feed XML into structured items.
 */
function parseRssFeed(xml: string): FdaRecallItem[] {
  const items: FdaRecallItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate') || null;

    if (!title) continue;

    // Filter for animal/pet food related entries
    const combined = `${title} ${description}`.toLowerCase();
    const isPetRelated =
      combined.includes('pet') ||
      combined.includes('dog') ||
      combined.includes('cat') ||
      combined.includes('animal food') ||
      combined.includes('animal feed') ||
      combined.includes('pet food') ||
      combined.includes('kibble') ||
      combined.includes('treat');

    if (!isPetRelated) continue;

    items.push({
      title,
      link,
      description,
      pubDate,
      lotNumbers: parseLotNumbers(description),
    });
  }

  return items;
}

// ─── Matching Algorithm ────────────────────────────────────────

type MatchConfidence = 'high' | 'medium' | 'low';

interface ProductMatch {
  productId: string;
  productBrand: string;
  productName: string;
  confidence: MatchConfidence;
}

interface ProductRow {
  id: string;
  brand: string;
  name: string;
}

/**
 * Tokenize a string into lowercase words.
 * Preserves dots within words (for "L.I.D.") and apostrophes (for "Hill's").
 * Strips other punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[&]/g, ' ')
    .replace(/[,;()"!?]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9.'+]+$/g, ''))
    .filter((w) => w.length > 0);
}

/**
 * Check if `needle` appears in `haystack` as a whole-word substring (case-insensitive).
 */
function containsBrand(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  const idx = h.indexOf(n);
  if (idx < 0) return false;

  // Check word boundary before
  if (idx > 0) {
    const charBefore = h[idx - 1];
    if (/[a-z0-9]/.test(charBefore)) return false;
  }
  // Check word boundary after
  const afterIdx = idx + n.length;
  if (afterIdx < h.length) {
    const charAfter = h[afterIdx];
    if (/[a-z0-9]/.test(charAfter)) return false;
  }

  return true;
}

/**
 * Match a single FDA recall entry against all products.
 * Returns all matches with confidence levels.
 *
 * Algorithm (5 steps per product):
 *   1. Segment brand check — FDA title split by separators, exact segment match → HIGH
 *   2. Parent company check — known parent→subsidiary mapping → MEDIUM
 *   3. Substring brand check — brand appears in FDA title → proceed to word overlap
 *   4. Generic guard — single generic word brand → LOW
 *   5. Word overlap — ≥60% → HIGH, <60% → MEDIUM
 */
function matchFdaEntry(
  fdaTitle: string,
  products: ProductRow[],
): ProductMatch[] {
  const matches: ProductMatch[] = [];

  // Pre-compute segments from FDA title
  const segments = fdaTitle
    .split(SEGMENT_SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Pre-compute parent company matches for this FDA title
  const fdaTitleLower = fdaTitle.toLowerCase();
  const parentMatched = new Set<string>();
  for (const [parentCo, subsidiaries] of Object.entries(PARENT_BRAND_MAP)) {
    if (fdaTitleLower.includes(parentCo)) {
      for (const sub of subsidiaries) {
        parentMatched.add(sub);
      }
    }
  }

  for (const product of products) {
    const brandLower = product.brand.toLowerCase();

    // Step 1: Segment brand check
    const segmentMatch = segments.some(
      (seg) => seg.toLowerCase() === brandLower,
    );
    if (segmentMatch) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'high',
      });
      continue;
    }

    // Step 2: Parent company check
    if (parentMatched.has(brandLower)) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'medium',
      });
      continue;
    }

    // Step 3: Substring brand check
    if (!containsBrand(fdaTitle, product.brand)) {
      continue; // No brand match at all — skip
    }

    // Step 4: Generic guard
    if (
      !product.brand.includes(' ') &&
      GENERIC_SINGLE_WORDS.has(brandLower)
    ) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'low',
      });
      continue;
    }

    // Step 5: Word overlap
    const brandTokens = new Set(tokenize(product.brand));

    // FDA words: title tokens minus brand, company suffixes, stopwords
    const fdaWords = tokenize(fdaTitle).filter(
      (w) =>
        !brandTokens.has(w) &&
        !COMPANY_SUFFIXES.has(w) &&
        !STOPWORDS.has(w),
    );

    // DB words: product name tokens minus brand, stopwords
    const dbWords = new Set(
      tokenize(product.name).filter(
        (w) => !brandTokens.has(w) && !STOPWORDS.has(w),
      ),
    );

    // Brand-only recall (no product-specific words in FDA entry)
    if (fdaWords.length === 0) {
      matches.push({
        productId: product.id,
        productBrand: product.brand,
        productName: product.name,
        confidence: 'high',
      });
      continue;
    }

    // Compute overlap
    const overlapCount = fdaWords.filter((w) => dbWords.has(w)).length;
    const overlapRatio = overlapCount / fdaWords.length;

    matches.push({
      productId: product.id,
      productBrand: product.brand,
      productName: product.name,
      confidence: overlapRatio >= 0.6 ? 'high' : 'medium',
    });
  }

  return matches;
}

// ─── Notification Helpers ──────────────────────────────────────

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
          `[recall-check] Expo push failed: ${res.status} ${res.statusText}`,
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
      console.error('[recall-check] Expo push error:', err);
    }
  }
  return deadTokens;
}

// ─── Main Handler ──────────────────────────────────────────────

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

  // ── 1. Fetch FDA RSS feed ──

  const rssUrl =
    Deno.env.get('FDA_RECALL_RSS_URL') ?? DEFAULT_FDA_RSS_URL;

  let rssXml: string;
  try {
    const rssRes = await fetch(rssUrl);
    if (!rssRes.ok) {
      console.error(
        `[recall-check] RSS fetch failed: ${rssRes.status} ${rssRes.statusText}`,
      );
      return jsonResponse({
        error: 'RSS fetch failed',
        status: rssRes.status,
        duration_ms: Date.now() - startTime,
      }, 502);
    }
    rssXml = await rssRes.text();
  } catch (err) {
    console.error('[recall-check] RSS fetch error:', err);
    return jsonResponse({
      error: 'RSS fetch error',
      duration_ms: Date.now() - startTime,
    }, 502);
  }

  // ── 2. Parse RSS entries ──

  const fdaItems = parseRssFeed(rssXml);
  if (fdaItems.length === 0) {
    return jsonResponse({
      fda_entries: 0,
      new_entries: 0,
      products_flagged: 0,
      reviews_queued: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // ── 3. Deduplicate against existing recall_log ──

  const fdaUrls = fdaItems.map((item) => item.link).filter(Boolean);
  const { data: existingRecalls } = await supabase
    .from('recall_log')
    .select('fda_url')
    .in('fda_url', fdaUrls);

  const processedUrls = new Set(
    (existingRecalls ?? []).map((r: { fda_url: string }) => r.fda_url),
  );

  // Also check review queue to avoid re-queuing
  const { data: existingReviews } = await supabase
    .from('recall_review_queue')
    .select('fda_entry_url')
    .in('fda_entry_url', fdaUrls);

  const reviewedUrls = new Set(
    (existingReviews ?? []).map(
      (r: { fda_entry_url: string }) => r.fda_entry_url,
    ),
  );

  const newItems = fdaItems.filter(
    (item) => !processedUrls.has(item.link) && !reviewedUrls.has(item.link),
  );

  if (newItems.length === 0) {
    return jsonResponse({
      fda_entries: fdaItems.length,
      new_entries: 0,
      products_flagged: 0,
      reviews_queued: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // ── 4. Load products for matching (paginated) ──

  const products: ProductRow[] = [];
  let productFrom = 0;
  while (true) {
    const { data: page, error: pageErr } = await supabase
      .from('products')
      .select('id, brand, name')
      .eq('is_recalled', false)
      .range(productFrom, productFrom + QUERY_PAGE - 1);

    if (pageErr) {
      console.error('[recall-check] Products query failed:', pageErr);
      return jsonResponse({
        error: 'Products query failed',
        duration_ms: Date.now() - startTime,
      }, 500);
    }
    if (!page || page.length === 0) break;
    products.push(...(page as ProductRow[]));
    if (page.length < QUERY_PAGE) break;
    productFrom += QUERY_PAGE;
  }

  if (products.length === 0) {
    console.error('[recall-check] No products found');
    return jsonResponse({
      error: 'No products found',
      duration_ms: Date.now() - startTime,
    }, 500);
  }

  // ── 5. Match FDA entries against products ──

  let productsFlagged = 0;
  let reviewsQueued = 0;
  const newlyRecalledProductIds: string[] = [];

  for (const item of newItems) {
    const matches = matchFdaEntry(item.title, products as ProductRow[]);

    // Parse recall date from pubDate
    const recallDate = item.pubDate
      ? new Date(item.pubDate).toISOString().split('T')[0]
      : null;

    // Process HIGH confidence matches — auto-flag
    const highMatches = matches.filter((m) => m.confidence === 'high');
    for (const match of highMatches) {
      // Flag product as recalled
      const { error: updateError } = await supabase
        .from('products')
        .update({ is_recalled: true })
        .eq('id', match.productId);

      if (updateError) {
        console.error(
          `[recall-check] Failed to flag product ${match.productId}:`,
          updateError,
        );
        continue;
      }

      // Insert recall log entry
      const { error: logError } = await supabase
        .from('recall_log')
        .insert({
          product_id: match.productId,
          recall_date: recallDate,
          reason: item.description || null,
          fda_url: item.link || null,
          lot_numbers: item.lotNumbers,
        });

      if (logError) {
        console.error(
          `[recall-check] Failed to log recall for ${match.productId}:`,
          logError,
        );
      } else {
        productsFlagged++;
        newlyRecalledProductIds.push(match.productId);
      }
    }

    // Process MEDIUM confidence matches — queue for review
    const mediumMatches = matches.filter((m) => m.confidence === 'medium');
    for (const match of mediumMatches) {
      const { error: queueError } = await supabase
        .from('recall_review_queue')
        .insert({
          fda_entry_title: item.title,
          fda_entry_url: item.link || null,
          matched_product_id: match.productId,
          match_confidence: 'medium',
        });

      if (queueError) {
        console.error(
          `[recall-check] Failed to queue review for ${match.productId}:`,
          queueError,
        );
      } else {
        reviewsQueued++;
      }
    }

    // LOW confidence matches — skip (no action)
  }

  // ── 6. Push notifications to affected pantry users ──

  let notificationsSent = 0;

  if (newlyRecalledProductIds.length > 0) {
    // Find pantry users with newly recalled products who haven't been notified
    const { data: affectedUsers, error: pantryError } = await supabase
      .from('pantry_items')
      .select('user_id, product_id, products(name, brand)')
      .in('product_id', newlyRecalledProductIds)
      .eq('is_active', true);

    if (pantryError) {
      console.error(
        '[recall-check] Pantry query failed:',
        pantryError,
      );
    } else if (affectedUsers && affectedUsers.length > 0) {
      // Filter out already-notified users
      const { data: existingNotifs } = await supabase
        .from('recall_notifications')
        .select('user_id, product_id')
        .in(
          'product_id',
          newlyRecalledProductIds,
        );

      const notifiedSet = new Set(
        (existingNotifs ?? []).map(
          (n: { user_id: string; product_id: string }) =>
            `${n.user_id}:${n.product_id}`,
        ),
      );

      // Group by user to batch-check settings
      const userProductPairs: Array<{
        userId: string;
        productId: string;
        productName: string;
        productBrand: string;
      }> = [];

      for (const row of affectedUsers as Array<{
        user_id: string;
        product_id: string;
        products: { name: string; brand: string };
      }>) {
        const key = `${row.user_id}:${row.product_id}`;
        if (notifiedSet.has(key)) continue;

        userProductPairs.push({
          userId: row.user_id,
          productId: row.product_id,
          productName: row.products.name,
          productBrand: row.products.brand,
        });
      }

      if (userProductPairs.length > 0) {
        const uniqueUserIds = [
          ...new Set(userProductPairs.map((p) => p.userId)),
        ];

        // Fetch push tokens and settings
        const { data: tokenRows } = await supabase
          .from('push_tokens')
          .select('user_id, expo_push_token')
          .in('user_id', uniqueUserIds)
          .eq('is_active', true);

        const { data: settingsRows } = await supabase
          .from('user_settings')
          .select(
            'user_id, notifications_enabled, recall_alerts_enabled',
          )
          .in('user_id', uniqueUserIds);

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
            recall_alerts_enabled: boolean;
          }
        >();
        for (const row of settingsRows ?? []) {
          settingsByUser.set(row.user_id, row);
        }

        // Build push messages
        const messages: ExpoPushMessage[] = [];
        const notifInserts: Array<{
          user_id: string;
          product_id: string;
        }> = [];

        for (const pair of userProductPairs) {
          const settings = settingsByUser.get(pair.userId);
          // D-125: default to enabled — recall alerts should reach users
          const notificationsEnabled =
            settings?.notifications_enabled ?? true;
          const recallEnabled =
            settings?.recall_alerts_enabled ?? true;

          if (!notificationsEnabled || !recallEnabled) continue;

          const tokens = tokensByUser.get(pair.userId);
          if (!tokens || tokens.length === 0) continue;

          const shortName = truncate(
            stripBrandFromName(pair.productBrand, pair.productName),
            40,
          );

          // D-084: no emoji. D-095: factual tone.
          const title = 'Recall Alert';
          const body = `${pair.productBrand} ${shortName} has been recalled by the FDA. Tap for details.`;

          for (const token of tokens) {
            messages.push({
              to: token,
              title,
              body,
              data: {
                type: 'recall',
                product_id: pair.productId,
              },
              sound: 'default',
              priority: 'high',
            });
          }

          notifInserts.push({
            user_id: pair.userId,
            product_id: pair.productId,
          });
          notificationsSent++;
        }

        // Send push notifications
        if (messages.length > 0) {
          const deadTokens = await sendExpoPush(messages);

          if (deadTokens.length > 0) {
            const { error: deactivateError } = await supabase
              .from('push_tokens')
              .update({ is_active: false })
              .in('expo_push_token', deadTokens);

            if (deactivateError) {
              console.error(
                '[recall-check] Failed to deactivate tokens:',
                deactivateError,
              );
            } else {
              console.log(
                `[recall-check] Deactivated ${deadTokens.length} dead token(s)`,
              );
            }
          }
        }

        // Record notifications for dedup (ignore conflicts — UNIQUE constraint)
        if (notifInserts.length > 0) {
          const { error: notifError } = await supabase
            .from('recall_notifications')
            .upsert(notifInserts, {
              onConflict: 'user_id,product_id',
              ignoreDuplicates: true,
            });

          if (notifError) {
            console.error(
              '[recall-check] Failed to record notifications:',
              notifError,
            );
          }
        }
      }
    }
  }

  // ── 7. Response ──

  return jsonResponse({
    fda_entries: fdaItems.length,
    new_entries: newItems.length,
    products_flagged: productsFlagged,
    reviews_queued: reviewsQueued,
    notifications_sent: notificationsSent,
    duration_ms: Date.now() - startTime,
  });
});
