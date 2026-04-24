# Supabase Migrations

49 migrations applied to the Kiba Supabase project in sequence. Each
file represents one deployed schema change: numbered, dated via git,
reviewable in isolation. RLS policies live inside the migration that
creates the table they protect — no cross-cutting auth migrations.

## How to read this directory

- Files are applied in numeric order by `supabase db push`.
- Each migration is idempotent within its own scope (uses `IF NOT EXISTS`
  where appropriate) but the *sequence* is not reorderable — later
  migrations assume earlier ones ran.
- Decision numbers (e.g. `D-152`) in commit messages and migration
  comments map to `DECISIONS.md` entries.
- User-data tables always add RLS (`auth.uid() = user_id` or equivalent
  join-based policy) in the same migration that creates them.

## Milestone map

Not all 49 are equally interesting. The ones below are the load-bearing
schema moments; the rest are incremental additions (columns, indexes,
backfills) that sit on top of these foundations.

### Foundation (M0–M2)

| Migration | What |
|-----------|------|
| `001_initial_schema.sql` | products, product_upcs, ingredients_dict, product_ingredients, pets, scans |
| `002_m2_pet_profiles.sql` | pet_conditions + pet_allergens (D-097 many-to-many) |

### Data pipeline (M3–M4.5)

| Migration | What |
|-----------|------|
| `004_m3_community_products.sql` | Community contributions with `needs_review` moderation flag |
| `006_ingredient_content_columns.sql` | D-105 ingredient taxonomy (display_name, tldr, detail_body, citations) |
| `007_m4_supplemental.sql` | D-136 `is_supplemental` routing to 65/35/0 scoring |
| `009_m45_pulse_flags.sql` | D-137 DCM pulse framework (`is_pulse`, `is_pulse_protein`) |
| `010_product_form.sql` | dry / wet / raw / freeze-dried / dehydrated classification |

### Pantry + notifications (M5)

| Migration | What |
|-----------|------|
| `011_pantry_tables.sql` | **pantry_items + pantry_pet_assignments** (D-152, D-154, D-155). Per-pet serving config. |
| `012_pet_product_scores.sql` | Batch-scoring cache with invalidation anchors. Powers Top Matches + Category Browse. |
| `013_push_tokens.sql` | Per-device Expo push tokens (unique per user+device) |
| `014_user_settings.sql` | Per-category notification prefs + global kill switch |
| `015_auto_deplete_cron.sql` | **pg_cron + pg_net** schedule: every 30 min pantry depletion. Low-stock + empty push alerts. |
| `016_recall_tables.sql` | D-125 recall siren. Free for all users (no paywall gate). |
| `017_appointments.sql` | D-103 pet appointments with recurring + reminders |
| `018_digest_cron.sql` | D-130 weekly + daily digest scheduled via pg_cron |

### v7 enrichment + health scoring (M5–M6)

| Migration | What |
|-----------|------|
| `020_v7_enrichment_columns.sql` | **DMB pre-computation**, AAFCO inference audit trail, retailer dedup IDs, images, feeding guidelines |
| `021_condition_details_medications.sql` | Condition severity details + medication tracking |
| `022_weight_management.sql` | **D-160 weight_goal_level** (slider), **D-161 caloric_accumulator** (auto-deplete estimates), **D-162 bcs_score** (educational) |

### Safe Switch (M7 → M9)

| Migration | What |
|-----------|------|
| `025_safe_switches.sql` | 7-day transition guide with partial-unique-index enforcement of one-active-per-pet |
| `031_safe_switch_pantry_coupling.sql` | `complete_safe_switch_with_pantry_swap` atomic RPC |

### Community (M8)

| Migration | What |
|-----------|------|
| `026_kiba_index.sql` | Taste + tummy community voting (D-032). SECURITY DEFINER aggregation RPC for species-filtered stats. |

### M9 rework

| Migration | What |
|-----------|------|
| `028_medication_reminders.sql` | D-167 reminder times + duration presets |
| `029_category_browse.sql` | `is_variety_pack` + `get_browse_counts` RPC |
| `034_behavioral_feeding.sql` | **Behavioral feeding rewrite.** `feeding_style` + `feeding_role` (base / rotational) replacing the rigid slot/meal-fraction system. Wet Reserve Engine + completeness engine refactor. `feeding_log` table + `log_wet_feeding_atomic` / `undo_wet_feeding_atomic` RPCs for log-driven wet feedings. |
| `038_fuzzy_search_rpc.sql` | `pg_trgm` fuzzy search for HomeScreen product text search |
| `039_wet_intent_resolved_at.sql` | **Wet food extras path.** Nullable `wet_intent_resolved_at` TIMESTAMPTZ on `pets` gates the new `FeedingIntentSheet` one-time intercept. Backfill marks existing non-dry_only pets and pets with active cross-format pantry items as already-resolved so the intercept only fires for net-new dry_only state. Uses `ADD COLUMN IF NOT EXISTS` for re-run safety (pets-table convention per 022/028/029/031/035). |
| `040_bookmarks.sql` | **D-169 bookmarks.** Per-pet product watchlist with `UNIQUE(pet_id, product_id)`. Hard cap of 20 enforced client-side. RLS pinned to `user_id = auth.uid()`. |

### M9 Community (041–049)

Last big pre-launch scope: Community tab rebuild — XP engine, Kiba
Kitchen (UGC recipes with auto-validators), Vendor Directory, Toxic
Database, Blog (Studio CMS), and D-072 community safety flags. Triggers
fire on existing tables (`scan_history`, `kiba_index_votes`, `products`)
so the XP system retroactively rewards every new scan/vote/contribution
from the moment 046 lands.

| Migration | What |
|-----------|------|
| `041_community_recipes.sql` | UGC recipe submissions. **Client-supplied UUID** (no `DEFAULT gen_random_uuid()`) — needed because the storage path `{userId}/{recipeId}.jpg` must be deterministic before the INSERT. RLS WITH CHECK pins inserts to `status='pending'`, `is_killed=false`, `rejection_reason=NULL`, `reviewed_at=NULL` so users can't self-approve. `is_killed` boolean is the emergency killswitch (Studio-flippable; instantly hides from feed + detail). |
| `042_user_xp.sql` | `user_xp_events` (immutable ledger) + `user_xp_totals` (denormalized counters + streak state). **SELECT-only RLS** — all writes happen via the SECURITY DEFINER triggers in 046. Writing client-side is denied by policy. |
| `043_blog_posts.sql` | Admin-authored blog posts. Public read where `is_published=true`. Writes via service role (Steven authors in Supabase Studio's row editor). |
| `044_vendors.sql` | Brand contact directory. `brand_slug TEXT UNIQUE` joins to a normalized form of `products.brand`. Public read where `is_published=true`. Seeded from `docs/data/vendors.json` via `npm run seed:vendors`, which also writes `src/data/published_vendor_slugs.json` for offline-safe ResultScreen overflow checks. `parent_company` collected for analytics but never displayed in UI. |
| `045_score_flags.sql` | **D-072 community safety flags.** Per-user reports on score quality, ingredient gaps, suspected recalls, etc. RLS WITH CHECK pins inserts to `status='open'`, `admin_note=NULL`, `reviewed_at=NULL` (mirrors 041's pattern — prevents queue poisoning). `scan_id` FK → `scan_history(id)` ON DELETE SET NULL. UPDATE service-role only (Studio triage). |
| `046_xp_triggers.sql` | **Five SECURITY DEFINER trigger functions** owned by `postgres` (so SELECT-only RLS on `user_xp_*` doesn't roll back the originating INSERT): `process_scan_xp` on `scan_history` (+10 + discovery bonus + calendar-day streak with 1-day grace, gap=2 preserves), `process_vote_xp` on `kiba_index_votes` (+15 only if user has prior `scan_history` for that product — anti-search-farm), `process_recipe_approval_xp` on `community_recipes` (+100, idempotent via `NOT EXISTS` guard so approve→un-approve→re-approve doesn't double-grant), `process_missing_product_approval_xp` on `products` (same pattern keyed on `product_id`). Helper `upsert_user_xp_totals` rolls totals + counters + streak in one shot. |
| `047_storage_buckets.sql` | Two public buckets: `recipe-images` (per-user folder RLS — `auth.uid()` must match the first `/`-segment of `name` for INSERT/DELETE) and `blog-images` (writes service-role only). Public SELECT on both. **First migration in this repo to provision storage buckets via SQL** — `pet-photos` was created in Studio manually. |
| `048_xp_summary_rpc.sql` | `get_user_xp_summary()` SECURITY DEFINER returns the 7 columns the XPRibbon needs (totals + streak + computed `weekly_xp`). Weekly window uses `(date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')` — the trailing `AT TIME ZONE` re-anchors the timestamp-without-tz back to TIMESTAMPTZ so the comparison against `created_at` doesn't drift with session timezone. ISO-week boundary = Monday 00:00 UTC. |
| `049_score_flag_aggregate_rpc.sql` | `get_score_flag_activity_counts()` SECURITY DEFINER returns reason + count over the last 7 days for the SafetyFlagsScreen "Community Activity" tab. Counts only — no PII surfaced. |

### Data integrity fixes

Migrations that exist to clean up side effects of earlier work:

- `008_product_metadata_backfill.sql` — restore `feeding_guidelines`, `is_vet_diet`, `image_url` etc. dropped during an earlier pipeline pass
- `024_fix_supplemental_data.sql` — flag 124 products missed by the enrichment pipeline (toppers, mixers, lickables)
- `027_restore_vet_diet_flags.sql` — 483 `is_vet_diet` flags lost during the v7 reimport; **bypass pattern broke** until patched
- `030_normalize_jammed_ingredient_canonicals.sql` — canonicalization drift from v7 import (`meatbyproducts` vs `meat_by_products`). Collision-safe renames + merges.

## Non-negotiable rules for new migrations

1. **RLS on every user-data table.** `auth.uid() = user_id` directly or through a join to the owning table. No migration without RLS is merged.
2. **Invalidate `pet_product_scores` when the scoring engine changes.** Either bump `CURRENT_SCORING_VERSION` in `src/services/topMatches.ts` or wipe the affected cache rows in the migration itself.
3. **Ordering matters for FK-heavy tables.** Child tables first in TRUNCATE / DELETE blocks; see `020` and `008` for the canonical `product_ingredients → product_upcs → products` pattern.
4. **Idempotency where possible.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. Repeatable runs should not error.
5. **Reference the decision.** Migration comments cite the D-number that motivated the change.
