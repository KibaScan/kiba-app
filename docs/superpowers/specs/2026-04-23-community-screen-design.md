# Community Screen — Design Specification

**Date:** 2026-04-23
**Status:** Approved — moving to implementation plan
**Milestone:** M9 (last pre-launch feature scope)
**Author:** Claude Code + Steven
**Related roadmap:** M10 Community Points (Lite), M11 Symptom Detective (deferred)

---

## 1. Context & Goals

The Community tab is currently a placeholder hub with five "coming soon" cards (Kitchen, Health Blog, Kiba Index, Symptom Detective, Contributions). This spec turns it into the last big user-facing scope before App Store launch.

**Goals:**

- Give the Community tab genuine utility so it justifies a tab slot at launch.
- Ship a lightweight XP engine (per M10 roadmap) that rewards physical scan effort, not text-search gaming.
- Surface three reference content types (toxic foods, vendor contacts, blog articles) that help owners make better food decisions without requiring a new scan.
- Add a trust-in-data surface (community safety flags per D-072).
- Enable user-submitted homemade recipes (Kiba Kitchen) with auto-validators so moderation scales.

**Non-goals (explicit):**

- Symptom Detective — M11 major post-launch update, not a pre-launch tile.
- Top-contributor leaderboard — M10 roadmap explicitly defers this.
- Cosmetic rewards (badges, profile borders) — deferred.
- Forum / replies / likes — not in scope, never has been.
- In-app content-authoring UI for admin — Supabase Studio is the CMS.

---

## 2. Architecture & Navigation

`CommunityStackParamList` expands from 4 → 11 routes:

```
Existing: CommunityMain, Result, RecallDetail, Compare
New:      KibaKitchenFeed, KibaKitchenSubmit, KibaKitchenRecipeDetail,
          ToxicDatabase, VendorDirectory, BlogList, BlogDetail, SafetyFlags
```

Deep-links into the Community stack from elsewhere:

- `ResultScreen` overflow menu → "Contact {brand}" → `VendorDirectory` with `initialBrand` param (only shown when `vendors` has a matching `is_published=true` row for that brand_slug).
- `ResultScreen` overflow menu → "Flag this score" → Safety Flag bottom sheet (stays on ResultScreen; inserts into `score_flags`).

---

## 3. Community Screen Layout (top → bottom)

```
┌─────────────────────────────────────┐
│  Your Impact                        │  ← XP ribbon
│  Lv. 7 · 2,340 XP · 🔥 12-day streak│    Flame = SF Symbol `flame.fill`,
│  +450 XP this week                  │    NOT emoji (D-084)
├─────────────────────────────────────┤
│  [ Featured Recipe — Kiba Kitchen ] │  ← hero card
├─────────────────────────────────────┤
│  ⚠ 2 recent recalls — tap to review │  ← Recall banner (hidden if 0)
├─────────────────────────────────────┤
│  Discover                           │
│  ┌─────────┬─────────┐              │
│  │ Toxic   │ Vendors │              │
│  │ Database│         │              │
│  ├─────────┼─────────┤              │
│  │ Kiba    │ Safety  │              │
│  │ Index   │ Flags   │              │
│  └─────────┴─────────┘              │
├─────────────────────────────────────┤
│  From Kiba — Monthly Articles      │
│  [ blog carousel →                ] │
├─────────────────────────────────────┤
│  r/kibascan — Join the subreddit →  │  ← footer link (D-071)
└─────────────────────────────────────┘
```

**Card frames:** all use Matte Premium `cardSurface` + `hairlineBorder` tokens (`.agent/design.md`).

**Empty-state rules:**

- XP ribbon: always shown. New user: "Scan your first product to start earning XP."
- Kitchen hero: no approved recipes yet → "Submit the first recipe" CTA card.
- Recall banner: hidden when zero recalls in last 30 days.
- Discovery grid: always shown.
- Blog carousel: hidden entirely when zero published posts (no "coming soon" placeholder).
- Subreddit link: always shown.

---

## 4. Data Model

### 4.1 New tables + buckets (migrations 041–047)

```sql
-- 041_community_recipes.sql
CREATE TABLE community_recipes (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  species TEXT NOT NULL CHECK (species IN ('dog','cat','both')),
  life_stage TEXT NOT NULL CHECK (life_stage IN ('puppy','adult','senior','all')),
  ingredients JSONB NOT NULL,        -- [{name, quantity, unit}]
  prep_steps JSONB NOT NULL,         -- ordered array of strings
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','auto_rejected','pending_review','approved','rejected')),
  rejection_reason TEXT,
  is_killed BOOLEAN NOT NULL DEFAULT false,  -- emergency killswitch
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
-- RLS:
--   INSERT: user_id = auth.uid()
--   SELECT: (user_id = auth.uid()) OR (status = 'approved' AND is_killed = false)
--   UPDATE: service role only (moderation via Studio)

-- 042_user_xp.sql
CREATE TABLE user_xp_events (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('scan','discovery','vote_verified','missing_product_approved','recipe_approved')),
  xp_delta INT NOT NULL,
  product_id UUID NULL REFERENCES products,
  recipe_id UUID NULL REFERENCES community_recipes,
  vote_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON user_xp_events (user_id, created_at DESC);
-- RLS: SELECT where user_id = auth.uid()

CREATE TABLE user_xp_totals (
  user_id UUID PK REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  scans_count INT NOT NULL DEFAULT 0,
  discoveries_count INT NOT NULL DEFAULT 0,
  contributions_count INT NOT NULL DEFAULT 0,  -- scan-verified votes + approved subs + approved recipes
  streak_current_days INT NOT NULL DEFAULT 0,
  streak_longest_days INT NOT NULL DEFAULT 0,
  streak_last_scan_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: SELECT where user_id = auth.uid()
-- Weekly XP computed on read (not stored), see §5.

-- 043_blog_posts.sql
CREATE TABLE blog_posts (
  id UUID PK DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_image_url TEXT,
  body_markdown TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON blog_posts (published_at DESC) WHERE is_published = true;
-- RLS: SELECT where is_published = true; writes service role only

-- 044_vendors.sql
CREATE TABLE vendors (
  id UUID PK DEFAULT gen_random_uuid(),
  brand_slug TEXT UNIQUE NOT NULL,    -- normalized from products.brand
  brand_name TEXT NOT NULL,
  contact_email TEXT,
  website_url TEXT,
  parent_company TEXT,                -- analytics-only, NOT displayed in UI
  headquarters_country TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: SELECT where is_published = true; writes service role only

-- 045_score_flags.sql
CREATE TABLE score_flags (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets,
  product_id UUID NOT NULL REFERENCES products,
  scan_id UUID NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('score_wrong','ingredient_missing','recalled','data_outdated','recipe_concern','other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewed','resolved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX ON score_flags (status, created_at DESC) WHERE status = 'open';
-- RLS: own rows by user_id = auth.uid() for SELECT/INSERT; UPDATE service role only

-- 046_xp_triggers.sql
-- See §5 for full trigger definitions (scans, votes, products, recipes).
-- ALL trigger functions must be declared SECURITY DEFINER and owned by postgres.

-- 047_storage_buckets.sql — missed in initial cut
-- Provisions recipe-images and blog-images public buckets plus owner-scoped RLS.
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- recipe-images RLS: writers can only touch their own {userId}/... path
CREATE POLICY "Users can upload to own recipe folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete their own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Public read of recipe images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'recipe-images');

-- blog-images: service role only for writes (no auth.uid() folder convention)
CREATE POLICY "Public read of blog images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'blog-images');
-- Writes allowed by service role only; no public policy.
```

### 4.2 Static data

`src/data/toxic_foods.json` — curated, bundled client-side:

```ts
{
  id: string;                       // 'xylitol', 'chocolate', etc.
  name: string;                     // 'Xylitol'
  alt_names: string[];              // ['birch sugar', 'wood sugar']
  category: 'food' | 'plant' | 'medication' | 'household';
  species_severity: {
    dog: 'toxic' | 'caution' | 'safe';
    cat: 'toxic' | 'caution' | 'safe';
  };
  symptoms: string[];               // ['vomiting', 'hypoglycemia', 'liver failure']
  safe_threshold_note: string | null;
  references: { label: string; url: string }[];
}
```

Single source of truth — reused by Toxic Database UI **and** Kiba Kitchen's `validate-recipe` Edge Function.

---

## 5. XP Engine

### 5.1 Sources + amounts

| Event | XP | Trigger |
|---|---|---|
| Camera scan | +10 | AFTER INSERT on `scans` |
| Discovery (new UPC) | +50 (bonus, total 60) | same trigger, conditional on first scan of that UPC anywhere |
| Kiba Index vote (scan-verified) | +15 | AFTER INSERT on `kiba_index_votes`, IF EXISTS scan_history row for same (user_id, product_id) |
| Missing-product submission approved | +100 | AFTER UPDATE on `products` when `needs_review` flips true → false |
| Recipe approved | +100 | AFTER UPDATE on `community_recipes` when `status` → `'approved'` |

**Anti-abuse:**

- Triggers only read server state; client cannot grant XP.
- Vote XP requires prior scan_history row — search+vote farms yield 0 XP.
- Discovery bonus uses `NOT EXISTS (SELECT 1 FROM scans WHERE product_id = NEW.product_id AND id <> NEW.id)` — exactly one user per UPC gets the bonus (racy for near-simultaneous first scans, acceptable edge case).
- `needs_review` flip is service-role only — users cannot self-approve their own submission.

**SECURITY DEFINER required:** every trigger function that writes to `user_xp_events` or `user_xp_totals` MUST be declared `SECURITY DEFINER` and owned by `postgres`. RLS only allows SELECT on those tables for `auth.uid()`; an INSERT from a trigger running as the invoking user would hit the RLS wall and roll back the entire scan/vote/recipe transaction. Pattern matches existing `get_kiba_index_stats` in `026_kiba_index.sql`.

**Idempotency on approval triggers:** the `missing_product_approved` and `recipe_approved` triggers fire on `AFTER UPDATE` whenever the relevant flag/status flips toward "approved." A moderator who approves → un-approves → re-approves would otherwise grant XP twice. Each grant must be guarded:

```sql
IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
  IF NOT EXISTS (
    SELECT 1 FROM user_xp_events
    WHERE recipe_id = NEW.id AND event_type = 'recipe_approved'
  ) THEN
    -- Grant XP
  END IF;
END IF;
```

Same pattern for `missing_product_approved` keyed on `product_id`.

### 5.2 Level curve

Deterministic pure function in `src/utils/xpLevel.ts`:

```ts
// L1=0, L2=100, L3=250, L4=500, L5=1000, Lₙ = round(Lₙ₋₁ × 1.8) for n≥6
export function levelForXP(totalXP: number): { level: number; progress: number; nextThreshold: number }
```

Easy to retune without migration — thresholds live in code.

### 5.3 Streak logic (1-day grace = miss at most 1 calendar day)

**Semantic refinement:** earlier draft framed this as "48h grace window" measured in hours. Switched to **calendar-day math** to avoid the time-of-day paradox (scan Mon 11:59 PM → Wed 1:00 AM = 25h elapsed but the stored DATE measures 49h from Mon-midnight to Wed-1am, breaking what should be a preserved one-day-skip). Final semantic: **you can skip at most one calendar day and keep your streak.**

Executed inside the scan trigger:

```sql
-- Pseudocode (real impl uses PL/pgSQL inside SECURITY DEFINER function)
on AFTER INSERT on scans:
  totals = SELECT FROM user_xp_totals WHERE user_id = NEW.user_id;
  today = (NOW() AT TIME ZONE 'UTC')::DATE;
  gap_days = today - totals.streak_last_scan_date;  -- integer days

  IF totals IS NULL THEN
    INSERT row with streak_current_days = 1, streak_last_scan_date = today;
  ELSIF gap_days = 0 THEN
    -- same-day scan, no-op for streak
  ELSIF gap_days <= 2 THEN
    -- gap of 1 calendar day (gap_days=1) or 1 missed day (gap_days=2) = preserve
    UPDATE streak_current_days = streak_current_days + 1, streak_last_scan_date = today;
  ELSE
    -- 2+ missed days = reset
    UPDATE streak_current_days = 1, streak_last_scan_date = today;
  END IF;
  UPDATE streak_longest_days = GREATEST(streak_longest_days, streak_current_days);
```

Pure-function helper `src/utils/streakGap.ts` mirrors the logic for unit testing and client-side preview. Test cases must include the day-boundary edge: scan at 23:59 then next scan at 00:01 next day = `gap_days=1` = preserve.

### 5.4 Weekly XP (computed on read)

Not stored. Query:

```sql
SELECT COALESCE(SUM(xp_delta), 0) AS weekly_xp
FROM user_xp_events
WHERE user_id = $1
  AND created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC');
```

Tradeoff: PostgreSQL's `date_trunc('week', ...)` uses ISO 8601 (week starts Monday 00:00). So weekly XP resets Monday 00:00 UTC. Some users in distant timezones see reset at an unnatural local time. Accepted MVP limitation — user-TZ timestamp column can be added post-launch without data migration.

### 5.5 XP ribbon client contract

`src/services/xpService.ts`:

```ts
export async function getUserXPSummary(): Promise<{
  total_xp: number;
  level: number;
  progress_pct: number;             // 0.0–1.0 toward next level
  next_threshold: number;
  weekly_xp: number;
  streak_current_days: number;
  streak_longest_days: number;
  counts: { scans, discoveries, contributions };
}>
```

Single RPC `get_user_xp_summary()` SECURITY DEFINER returns all fields. Offline: cached via AsyncStorage, falls back to last-known values.

---

## 6. Kiba Kitchen

### 6.1 Submit flow

**`KibaKitchenSubmit` screen fields:**

- Title (required, 4–80 chars)
- Subtitle (optional, ≤ 140 chars)
- Species toggle (`dog` | `cat` | `both`, required)
- Life stage (`puppy` | `adult` | `senior` | `all`, required)
- Ingredients: dynamic rows, each `{ name, quantity, unit }` (min 2, max 20)
- Prep steps: ordered text list (min 1, max 15)
- Cover photo: single upload to Storage `recipe-images` public bucket (path: `{userId}/{recipeId}.jpg`)
- AAFCO acknowledgment checkbox (required) — text: *"I understand this recipe is not a complete-and-balanced AAFCO diet and should only be fed as an occasional supplement, not as my pet's primary food."*

**Submission order — critical sequencing:**

1. Client generates `recipeId` locally via `Crypto.randomUUID()` (Expo `expo-crypto`). Database `id` column drops `DEFAULT gen_random_uuid()` so server doesn't override.
2. Client uploads image to Storage at `{userId}/{recipeId}.jpg`. Cover URL is now deterministic.
3. Client INSERTs row with the explicit `id` and the cover URL. RLS allows insert because `user_id = auth.uid()`.
4. Edge Function `validate-recipe` is called immediately with `recipeId`. Validators run; row UPDATEs to `auto_rejected` or `pending_review`.

**Why this order:** if the database auto-generated `id`, the client wouldn't know the storage path until after insert — but `validate-recipe` would already have fired. Reversing to client-generated UUID makes upload + insert atomic from the client's view.

**Orphan cleanup:** if step 3 fails after step 2 succeeded, the storage object is orphaned. A weekly pg_cron job (`cleanup-orphan-recipe-images`) deletes objects in `recipe-images` whose `{recipeId}` doesn't exist in `community_recipes`. Out of MVP scope — flag for post-launch.

### 6.2 Auto-validators (Edge Function `validate-recipe`)

Reads a deploy-time copy of `toxic_foods.json` co-located in `supabase/functions/validate-recipe/toxic_foods.json` (Edge Functions can't import from outside their function directory). Sync mechanism: `scripts/seedVendors.ts` plus a `scripts/syncToxicFoods.ts` that copies `src/data/toxic_foods.json` → `supabase/functions/validate-recipe/toxic_foods.json` and is invoked in CI before `supabase functions deploy`. Single canonical source remains `src/data/toxic_foods.json`; Edge copy is a build artifact.

1. **Toxic-ingredient scan:** normalize each submitted ingredient name (lowercase, strip punctuation) → fuzzy-match against each toxic-food entry (`name` + `alt_names`) → if `species_severity[recipe.species] === 'toxic'`, reject with reason `"Contains {ingredient}, which is toxic to {species}."`
2. **UPVM regex (D-095):** run regex over concatenated `title + subtitle + prep_steps`:
   ```
   /\b(cure|prevent|diagnose|((helps with|good for|treats) .+ (disease|condition|allergy|arthritis|kidney|liver|cancer|diabetes|seizure)))\b/i
   ```
   Any match → reject with reason `"Community recipes cannot include health or medical claims."`

   **Why not standalone `treat`:** "treat" is a noun in this domain ("Peanut Butter Dog Treats"). Banning it would auto-reject legitimate treat recipes. The grouping `(helps with|good for|treats) .+ (disease|condition|...)` correctly applies the condition tail to all three prefixes — "treats arthritis" matches but "Peanut Butter Treat" does not. Borderline phrasing ("good for shedding") falls through to human review per the design's safety-net intent — the auto-validator catches the obvious; Studio review handles nuance.
3. **Required-field presence** — duplicate of client-side validation; server is source of truth.

Pass → `status='pending_review'`, notification not yet sent (wait for Studio approval).

### 6.3 Moderation (Supabase Studio)

Steven reviews `community_recipes WHERE status='pending_review' ORDER BY created_at` in Studio. Per recipe:

- Flip `status='approved'` → post goes live, XP trigger fires (+100 to `user_id`), push notification sent ("Your recipe is live on Kiba Kitchen").
- Flip `status='rejected'` + set `rejection_reason` → submitter gets notified with reason.

**Killswitch:** if a recipe is ever linked to reported harm, flip `is_killed=true` → instantly hides from feed and detail. Detail-route-by-ID returns a "Recipe removed" placeholder card.

### 6.4 Display

**`KibaKitchenFeed`:**

- Image-forward vertical FlatList, card per recipe: cover image + title + species badge + life-stage badge.
- Top: always-visible disclaimer banner (text in §15 Appendix).
- Sort: `reviewed_at DESC` (set when flipped to approved).

**`KibaKitchenRecipeDetail`:**

- Hero cover image + title + subtitle + species/life-stage badges.
- Ingredients table (name · quantity · unit).
- Prep steps numbered list.
- Persistent disclaimer **top AND bottom** (§15).
- Overflow: "Report issue" → opens `score_flags`-style bottom sheet (new `reason='recipe_concern'` value added to enum).

---

## 7. Vendor Directory

### 7.1 Import pipeline

`scripts/seedVendors.ts`:

- Reads `docs/data/vendors.json` (committed, user-maintained).
- Normalizes `brand_name` → `brand_slug` via `brandSlugify()` (`src/utils/brandSlugify.ts`): lowercase, replace non-alphanum with `-`, collapse repeats, trim.
- Upserts by `brand_slug` (INSERT ... ON CONFLICT (brand_slug) DO UPDATE SET ...).
- Logs count of inserted vs updated.
- Safe to re-run idempotently.

### 7.2 Screen

**`VendorDirectory`:**

- Header: search bar, accepts `initialBrand` param to pre-filter.
- Body: A-Z sectioned SectionList of cards per published vendor. Each card: brand name + quick-action row (email button via `mailto:`, website button via `Linking.openURL`).
- Tap card → expands inline (no separate detail screen) to show HQ country + larger action buttons.

### 7.3 Deep-link from ResultScreen — bundled-slug check (offline-safe)

`ResultScreen` is offline-tolerant; an `await supabase.from('vendors').select(...)` in the overflow menu would hang on poor connection (grocery-store WiFi, basement). Instead, the published vendor slug list is bundled into the client at build time:

- `scripts/seedVendors.ts` writes two artifacts after each seed run:
  1. Database upsert (existing).
  2. `src/data/published_vendor_slugs.json` — flat array `["pure-balance", "wellness", ...]` of `is_published=true` slugs only.
- `ResultScreen` overflow check is purely synchronous:
  ```ts
  import publishedVendors from '@/data/published_vendor_slugs.json';
  const slug = brandSlugify(product.brand);
  const showContactBrand = publishedVendors.includes(slug);
  ```
- Tap → navigate to `VendorDirectory` with `{ initialBrand: product.brand }`. The destination screen then makes the network call to fetch full vendor details; if offline at that point, it falls back to a cached subset (per pantry-pattern).

**Tradeoff:** vendor publish state in the deep-link is bundle-pinned. A vendor newly flipped to `is_published=true` only appears in the menu after the next app build. Acceptable for the launch cadence; document as known limitation.

---

## 8. Toxic Database

### 8.1 Data

`src/data/toxic_foods.json` — curated static list (schema in §4.2). Bundled client-side for offline access. **Single source of truth** reused by Kiba Kitchen validator.

### 8.2 Screen

**`ToxicDatabase`:**

- Header: species toggle (Dog/Cat), search bar, category filter chips (food/plant/medication/household/all).
- Body: sectioned list grouped by severity color using `SEVERITY_COLORS` from `src/utils/constants.ts` (red = toxic, amber = caution, green = safe).
- Tap entry → bottom sheet expanding to show symptoms + safe_threshold_note + references (tappable URLs via `Linking.openURL`).

---

## 9. Blog

### 9.1 CMS workflow

- Write posts directly in Supabase Studio's `blog_posts` row editor.
- Upload cover images via Studio's storage browser → new public bucket `blog-images`. Paste URL into `cover_image_url`.
- Set `is_published=true` + `published_at=NOW()` → post goes live immediately on next app fetch. No app-store resubmission.

### 9.2 Rendering

- **Library:** `react-native-markdown-display` (confirm version at implementation time; fallback to equivalent if it doesn't support RN 0.83).
- Inline images via public HTTPS URLs, lazy-loaded via standard RN `Image`.

### 9.3 Screens

- **Community carousel:** 3-item horizontal scroll of most-recent `is_published=true` posts. "See all →" link.
- **`BlogList`:** vertical FlatList, reverse-chronological.
- **`BlogDetail`:** cover image (full-width), title, subtitle, body via markdown renderer. Header share button → `Share.share({ url: 'kibascan.com/blog/{id}' })` — web URL is stretch goal; can ship with copy-to-clipboard fallback.

---

## 10. Community Safety Flags (D-072)

### 10.1 Entry points

- **`ResultScreen` overflow menu** → "Flag this score" → bottom sheet with reason picker (radio list of 5 options) + optional detail text (≤ 500 chars) + Submit. Insert into `score_flags` with `scan_id` from current scan if available.
- **2x2 grid tile** → `SafetyFlags` screen.

### 10.2 `SafetyFlags` screen

Two tabs via segmented control:

- **My Flags:** list of user's own `score_flags` rows, with status chip (Open/Reviewed/Resolved/Rejected) and admin_note when present.
- **Community Activity:** aggregate count only — "Reports submitted this week: 47" + category breakdown bar chart. No user info per RLS, no PII risk.

### 10.3 Review queue

- Steven reviews in Studio: `score_flags WHERE status='open' ORDER BY created_at`.
- Flip `status` + optional `admin_note`. Submitter sees updated status next time they open `SafetyFlags` → My Flags.

---

## 11. Recall Live Feed (banner)

- Query: `SELECT brand, name FROM products WHERE is_recalled = true ORDER BY updated_at DESC LIMIT 5`.
- Hidden when zero results, or when most recent recall is > 30 days old.
- Banner shows count + most-recent brand. Tap → `RecallDetailScreen` (existing route) for most recent product; if multiple, intermediate list screen (reuse `BrowseProductRow`).
- **Not redundant with HomeScreen:** HomeScreen's recall banner is pantry-scoped. Community's is global.

---

## 12. Error / Empty / Loading / Offline

| Surface | Empty | Offline | Loading |
|---|---|---|---|
| XP ribbon | New user: "Scan your first product to start earning XP." | Cached totals + "offline" indicator | Shimmer |
| Kitchen hero | No approved recipes: "Submit the first recipe" CTA | Cached if available else empty card | Shimmer |
| Recall banner | Hidden | Hidden | Hidden |
| Discovery grid | Always shown; tiles tappable | Toxic DB works (bundled); others show per-screen offline state | N/A |
| Blog carousel | Hidden | Hidden | Shimmer |
| Safety Flags (My) | "No flags yet. Tap Flag this score on any product." | Cached | Shimmer |
| Vendor Directory | Impossible (seed is required) | "Offline — cached directory" banner, full list still browsable from cache | Shimmer |

**Pantry-pattern writes:** recipe submission and flag submission throw `OfflineError` when offline; reads degrade to `[]` gracefully.

---

## 13. Testing Strategy

### 13.1 Pure helpers (`.test.ts`)

- `xpLevel.ts` — level curve boundaries (exactly at thresholds, between, floor at 0).
- `streakGap.ts` — 47h gap preserves, 49h resets, same-day no-op.
- `weeklyXPWindow.ts` — window boundaries at Sunday 00:00 UTC.
- `validateRecipeSubmission.ts` — toxic match (positive, negative, alt_name), UPVM regex (all 6 prohibited terms), required-field validation.
- `brandSlugify.ts` — special chars, Unicode, consecutive spaces, leading/trailing whitespace.

### 13.2 Render tests (`.test.tsx`)

- `CommunityScreen` — empty (new user) + populated states; recall banner visibility logic; blog carousel hidden when 0 posts.
- `ToxicDatabase` — species toggle filters list; search query filters both `name` and `alt_names`; category chips narrow results.
- `VendorDirectory` — search filter; email button calls `Linking.openURL('mailto:...')`; website button calls `Linking.openURL('https://...')`.
- `SafetyFlagSheet` — reason required before submit; submit button disabled without reason; offline state.

### 13.3 Integration

- `validate-recipe` Edge Function: fixture corpus of 10 safe recipes, 10 toxic-ingredient recipes (covering each species rule), 10 UPVM-violating recipes. Assert correct status + rejection_reason.

### 13.4 DB triggers

- pgTAP-style tests in `supabase/tests/`:
  - Scan → XP +10; second scan same day → XP +10 but streak unchanged.
  - First scan of a UPC → discovery bonus; second scan (different user) of same UPC → no bonus.
  - Vote without prior scan → XP 0; vote with prior scan → XP +15.
  - Recipe status flip to approved → +100 to author; further flips no-op.

### 13.5 Regression

- Pure Balance = 61, Temptations = 0 (unchanged — no scoring engine work).

---

## 14. Constraints & Rules Compliance

| Rule | Compliance |
|---|---|
| D-070 (XP positioning: cosmetic, not primary hook) | Subtle ribbon, not hero card; flame icon subordinate to level+XP. ✓ |
| D-071 (r/kibascan link day-one) | Footer link. ✓ |
| D-072 (Community Safety Flags) | 4th Discovery tile + ResultScreen entry. ✓ |
| D-084 (zero emoji) | SF Symbols only. Flame = `flame.fill`. Explicitly documented in copy pass. ✓ |
| D-091 (miss flow) | Existing `contributed_by` flow wires into XP trigger when `needs_review` flips false. ✓ |
| D-095 (UPVM — no "treat/cure/prevent/diagnose") | Auto-validator regex in `validate-recipe`. Applies to recipe submissions and (by author discipline) blog posts. ✓ |
| D-125 (recall alerts free) | Recall banner has no paywall gate. ✓ |
| D-127 (API keys server-side) | All XP grants via DB triggers; validators in Edge Function with service-role reads. ✓ |
| D-130 (weekly digest) | `weekly_xp` available as payload for future digest template update. ✓ |
| D-168 (score framing) | Not applicable — no new scored rows. |
| Rule 3 (paywall only in permissions.ts) | No Community feature is paywalled. N/A. |
| Rule 7 (RLS on every user-data table) | All 5 new tables carry RLS. ✓ |
| Rule 8 (no `any` types in core entities) | TypeScript types live in `src/types/community.ts`. ✓ |
| Rule 13 (recall alerts free) | ✓ per above |

**MVP scope memory alignment:** this *is* the last big pre-launch scope.

---

## 15. Copy Appendix

### 15.1 Kiba Kitchen disclaimer (both top + bottom of detail, plus submission modal)

> **Community recipe.** Not veterinarian-reviewed. Not a complete-and-balanced AAFCO diet — feed as an **occasional supplement only**, not as your pet's primary food. Consult your veterinarian before making dietary changes.

### 15.2 XP ribbon

- Empty state: *"Scan your first product to start earning XP."*
- Populated headline: *"Lv. 7 · 2,340 XP · 12-day streak"*
- Sub-line: *"+450 XP this week"*
- Level-up toast: *"Level {N}. Thanks for contributing to Kiba."*

### 15.3 Auto-reject reasons (shown to submitter)

- Toxic: *"This recipe contains {ingredient}, which is toxic to {species}. Please remove it and resubmit."*
- UPVM: *"Community recipes can't include health or medical claims. Remove language about treating, curing, or preventing conditions and resubmit."*

### 15.4 Recipe-approved notification

Title: *"Your Kiba Kitchen recipe is live"*
Body: *"{recipe.title} — thanks for contributing. Earned +100 XP."*

### 15.5 Recipe-rejected notification

Title: *"Recipe submission update"*
Body: *"{recipe.title} — {rejection_reason}"*

---

## 16. Timeline Estimate

| Day | Work |
|---|---|
| W1 D1 | Migrations 041–045, 047 (storage buckets + RLS). Drop pgTAP scaffolding OR Deno test harness. RLS policies + tests. |
| W1 D2 | Migration 046 (XP triggers — all `SECURITY DEFINER`, idempotent approval checks). Trigger tests. Pure-helper utilities (xpLevel, streakGap, weeklyXPWindow, brandSlugify, validateRecipeSubmission). |
| W1 D3 | `toxic_foods.json` curated seed. `validate-recipe` Edge Function + fixture tests. Seeder script. |
| W1 D4 | `xpService.ts` + `communityService.ts`. CommunityScreen XP ribbon + Recall banner + subreddit link. |
| W1 D5 | `ToxicDatabase` screen + `VendorDirectory` screen + deep-link from `ResultScreen`. |
| W2 D1 | Kiba Kitchen submit flow (form, upload, validator call, error states). |
| W2 D2 | Kiba Kitchen feed + detail + killswitch rendering. |
| W2 D3 | Blog carousel, `BlogList`, `BlogDetail` with markdown renderer. Empty-state hide logic. |
| W2 D4 | Safety Flags sheet + `SafetyFlags` screen + ResultScreen overflow wiring. |
| W2 D5 | Render tests, polish, on-device QA, fix-forward. |

**Total: 10 working days.**

**Risks:**

- Recipe image upload + offline guard: +0.5 day if edge cases hit.
- Markdown renderer RN 0.83 compat: +0.5 day if primary library needs fallback.
- pgTAP setup if not already wired: +0.5 day.
- Worst case: 11.5–12 days. Flag early if slippage hits D3.

---

## 17. Open Questions / Known Risks

1. **User-TZ weekly reset** — computed-on-read uses UTC. Users in UTC+12 see Sunday reset mid-Sunday-morning. Acceptable for MVP; revisit post-launch with `user_settings.timezone` column.
2. **Discovery bonus race** — two users scan a new UPC within the same millisecond. Both might pass the `NOT EXISTS` check. Acceptable edge; costs 50 XP per incident.
3. **Recipe submission rate limit** — none specced. Post-launch: add per-user throttle (e.g., 5/day) if spam appears.
4. **Blog markdown XSS** — Steven is sole author + service-role-only writes, so the XSS surface is self-inflicted. Sanitization deferred; if multi-author ever added, inject DOMPurify-equivalent.
5. **Vendor deep-link miss** — `brandSlugify('Purina Pro Plan')` vs manually-entered `brand_slug='purina-pro-plan'` must agree. Seed script enforces `brandSlugify` normalization on import to prevent drift.
6. **Kitchen moderation operational debt** — if submissions spike, review queue grows. Mitigate with weekly cadence + explicit SLA ("reviewed within 7 days") in submission confirmation toast.
7. **Discovery XP for bypassed products** — scans with `result.bypass=true` (vet diet, variety pack, species mismatch, recalled) do NOT insert into `scan_history` per current ResultScreen:317 logic. This means vet-diet scans yield 0 XP. Intentional: bypasses are non-scored, so no XP reward. Document in trigger test.

8. **Optimistic offline XP display** — client shows cached `total_xp` when offline. When the user scans offline, the scan itself fails (scans table write requires network); XP doesn't advance. On reconnect, next `get_user_xp_summary` refresh catches up. No optimistic client-side XP increment — accepted MVP limitation, not a correctness bug.

9. **Vendor slug rename edge** — if a brand renames (producing a different `brandSlugify` output), `seedVendors.ts` upsert by slug will create a NEW row rather than update the old. Both could be `is_published=true` simultaneously, which orphans the old row. For MVP, document that slug renames require manual cleanup in Studio (delete or unpublish the old row).

10. **Storage orphan cleanup** — recipe-images bucket can accumulate orphan images when step 3 of submission (§6.1) fails after step 2 succeeds. Out of MVP scope; add a `cleanup-orphan-recipe-images` pg_cron job post-launch.

11. **Second-pass review notes** — this spec incorporates fixes from a second-pass review that caught: (a) trigger RLS crash without `SECURITY DEFINER`, (b) streak math paradox from mixing DATE/TIMESTAMP, (c) UPVM regex banning the word "treat" (noun) and misgrouped "helps with", (d) double-grant XP via repeated approval flips, (e) chicken-and-egg image upload with server-generated UUID, (f) offline-breaking vendor-deep-link network call, (g) missing storage bucket provisioning migration.

---

## 18. Files Touched (high-level)

**New:**
- `supabase/migrations/041_community_recipes.sql`
- `supabase/migrations/042_user_xp.sql`
- `supabase/migrations/043_blog_posts.sql`
- `supabase/migrations/044_vendors.sql`
- `supabase/migrations/045_score_flags.sql`
- `supabase/migrations/046_xp_triggers.sql` (all functions `SECURITY DEFINER` + idempotent)
- `supabase/migrations/047_storage_buckets.sql` (recipe-images + blog-images + RLS)
- `supabase/functions/validate-recipe/index.ts`
- `supabase/tests/` (pgTAP trigger tests)
- `src/data/toxic_foods.json`
- `src/data/published_vendor_slugs.json` (build artifact from `scripts/seedVendors.ts`; offline-safe ResultScreen check)
- `src/types/community.ts`, `src/types/xp.ts`
- `src/utils/xpLevel.ts`, `src/utils/streakGap.ts`, `src/utils/weeklyXPWindow.ts`, `src/utils/brandSlugify.ts`, `src/utils/validateRecipeSubmission.ts`
- `src/services/xpService.ts`, `src/services/communityService.ts`, `src/services/recipeService.ts`, `src/services/vendorService.ts`, `src/services/blogService.ts`, `src/services/scoreFlagService.ts`
- `src/screens/KibaKitchenFeedScreen.tsx`, `KibaKitchenSubmitScreen.tsx`, `KibaKitchenRecipeDetailScreen.tsx`
- `src/screens/ToxicDatabaseScreen.tsx`, `VendorDirectoryScreen.tsx`
- `src/screens/BlogListScreen.tsx`, `BlogDetailScreen.tsx`
- `src/screens/SafetyFlagsScreen.tsx`
- `src/components/community/` (subcomponents: XPRibbon, DiscoveryGrid, RecallBanner, SubredditFooter, KiIndexHighlights, etc.)
- `scripts/seedVendors.ts` (database upsert + regenerate `src/data/published_vendor_slugs.json`)
- `scripts/syncToxicFoods.ts` (copies `src/data/toxic_foods.json` → `supabase/functions/validate-recipe/toxic_foods.json` pre-deploy)
- `docs/data/vendors.json` (placeholder; Steven fills)
- Tests for all of the above.

**Modified:**
- `src/screens/CommunityScreen.tsx` (full rebuild)
- `src/screens/ResultScreen.tsx` (overflow menu: "Contact brand", "Flag this score")
- `src/types/navigation.ts` (new routes)
- `App.tsx` (register new routes)
- `CLAUDE.md` (new schema traps + pre-launch scope note)
- `DECISIONS.md` (new decisions D-170..D-1XX as needed)
- `ROADMAP.md` (mark M10 lite pieces as shipped under M9)
- `docs/status/CURRENT.md` (session handoff)
