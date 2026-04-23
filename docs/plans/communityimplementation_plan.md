# Community Screen Brainstorm & Architecture

This document outlines the proposed feature set, UI layout, and backend architecture for the upcoming Community Tab overhaul.

## User Review Required

> [!IMPORTANT]
> The following open questions need your input before implementation begins. See each feature section and the consolidated **Open Questions** section at the bottom.

---

## 1. Core Features (User Requested)

### Kiba Kitchen (Homemade Meals)
- **UX:** A featured, visually engaging card (using the `Featured Action Card` Matte Premium pattern from `.agent/design.md`) that routes to a dedicated `KibaKitchenScreen`.
- **Features:** 
  - A scrollable, image-rich feed of community-submitted homemade recipes.
  - "Submit a Recipe" action button.
- **Workflow:** Recipes submitted by users are inserted into a new `community_recipes` table with `status = 'pending'`. You review and approve them via Supabase Studio before they appear in the public feed.

> [!WARNING]
> **D-095 (UPVM) compliance concern:** Recipe copy must never say "this meal will help with [condition]" or "feed this to treat [symptom]." Recipes should be presented as community contributions with nutritional information only — no health claims. We should add a submission disclaimer and a display disclaimer: *"Community recipes are not veterinarian-reviewed. Consult your vet before changing your pet's diet."*

### Kiba Blog / Articles
- **UX:** A horizontally scrolling carousel of article cards.
- **Features:** Your authored content on pet food, health, and nutrition topics.
- **Workflow:** A `blog_posts` Supabase table you populate via Studio. The app fetches and renders published posts. Each post needs: `title`, `subtitle`, `cover_image_url`, `body_markdown`, `published_at`, `is_published`.

### Toxic Database
- **UX:** A searchable, filterable directory screen (`ToxicDatabaseScreen`).
- **Features:** Search bar, species toggle (Dog/Cat), and severity color-coding (Red = Toxic, Amber = Caution, Green = Safe).
- **Context:** The toxicity data already exists in `speciesRules.ts` and the compiled toxicity databases referenced in ROADMAP.md (380+ items across dog/cat). This feature surfaces that data as a standalone reference tool.

> [!NOTE]
> The existing toxicity data lives in the scoring engine internals, not in a user-facing table. We'll need to either: (a) create a new `toxic_foods` table with user-friendly descriptions, or (b) build a curated JSON file bundled client-side for offline access. Option (b) is simpler and doesn't require network — good for a "quick reference while cooking" use case.

### Contact Vendor List
- **UX:** A searchable A-Z directory of pet food manufacturers (`VendorDirectoryScreen`).
- **Features:** Quick-action buttons to Email (`Linking.openURL('mailto:...')`) or Visit Website (`Linking.openURL`).
- **Context:** Empowers users to contact brands directly about unnamed ingredients or sourcing transparency.

> [!NOTE]
> No vendor data exists in the codebase today. We'll need a new `vendors` table or a static JSON bundle. Key fields: `brand_name`, `contact_email`, `website_url`, `phone` (optional), `logo_url` (optional). This data would need to be manually curated initially — possibly seeded from the existing `products.brand` distinct values plus manual research.

### Community XP & Contributions (The Gamified Element)
- **UX:** A prominent "Your Impact" dashboard at the top of the Community screen — XP total, level, progress bar toward next level.
- **Points System:** Users earn points *specifically* for actions tied to physical effort. This prevents score inflation via text search. Approved point sources:
  1. **Scanning items via the Camera.** (e.g., +10 XP per scan)
  2. **Discovering new items** — scanning a barcode not yet in the Kiba database. (e.g., +50 XP — higher reward because it grows the catalog)
  3. **Using the Kiba Index** (Taste/Tummy vote) on an item they just scanned via camera. (e.g., +15 XP)
  4. **Contributing accepted recipes** to Kiba Kitchen. (e.g., +100 XP — awarded only upon admin approval)
- **Anti-abuse:** The `scan_history` table already tracks whether a scan came from the camera pipeline (only non-bypass scans from ResultScreen line ~317 insert into `scan_history`). XP grants should be server-side (Supabase RPC or trigger) keyed to `scan_history` inserts, not client-side flags — a client-side `scanned_via_camera=true` flag is trivially spoofable.
- **Leaderboard (Optional):** "Top Contributors" this week.
- **Streaks & Badges:** Cosmetic rewards for consecutive daily scans.

> [!IMPORTANT]
> **Security design decision:** XP should be computed server-side, not granted by client request. A Supabase database trigger on `scan_history` inserts (for scan/discovery XP) and on `kiba_index_votes` inserts (for voting XP) is much harder to game than a client-side API call. Recipe XP can be granted manually when you flip `status = 'approved'` on a `community_recipes` row.

---

## 2. Additional Brainstorming Ideas

### A. Recall & Safety Siren Live Feed
- Show a global "Recent FDA Recalls & Formula Changes" banner on the Community tab.
- You already have `is_recalled` on `products` and the RecallDetailScreen. This would surface that data proactively to all users, not just those with the recalled item in their pantry.

### B. Kiba Index Leaderboards
- "Top Rated for Picky Eaters" / "Best for Sensitive Tummies" based on aggregated `kiba_index_votes` data.
- The `get_kiba_index_stats` RPC already exists. This would be a read-only view of community consensus.

### C. Poll of the Week
- One-click poll (e.g., "Does your cat prefer wet or dry food?"). Reveals results instantly. High engagement, low engineering cost.
- Could be a simple `community_polls` table with `community_poll_votes`.

---

## 3. Proposed Screen Layout (Top to Bottom)

1. **User Dashboard:** Community XP & Impact (Points, Level, Streak counter)
2. **Hero Section:** Kiba Kitchen (Large, vibrant featured card)
3. **Live Feed:** Recent Recalls / Formula changes (Compact scrolling ticker — optional)
4. **Discovery Grid (2x2 layout):**
   - Toxic Database
   - Contact Vendor List
   - Symptom Detective (Placeholder for M11)
   - Kiba Index Highlights
5. **Content Carousel:** Kiba Blog / Articles

---

## 4. Architecture Review — Gaps & Risks

### Navigation
The `CommunityStackParamList` currently only has 4 routes (`CommunityMain`, `Result`, `RecallDetail`, `Compare`). We'll need to add routes for every new screen:
- `KibaKitchen`, `KibaKitchenSubmit`
- `ToxicDatabase`
- `VendorDirectory`
- `BlogDetail`

### New Supabase Tables Needed
| Table | Purpose | RLS |
|-------|---------|-----|
| `community_recipes` | Kiba Kitchen submissions | `user_id = auth.uid()` for writes; public read where `status = 'approved'` |
| `user_xp` | XP ledger (individual events) + denormalized total | `user_id = auth.uid()` |
| `blog_posts` | Your authored blog content | Public read; admin-only writes (via service role in Studio) |
| `vendors` | Brand contact directory | Public read; admin-only writes |
| `toxic_foods` (or static JSON) | Toxicity reference data | Public read |

### Scope Concern
This is a **large feature set** — 5+ new screens, 4-5 new tables, server-side triggers for XP. I'd recommend phasing:

**Phase 1 (ship fast, immediate value):**
- Community Screen layout with the 2x2 discovery grid
- Toxic Database (static JSON, no backend needed)
- Blog carousel (simple table, you populate)
- XP dashboard UI (placeholder/zero state while backend is built)

**Phase 2 (backend-heavy):**
- Kiba Kitchen (submission flow, approval workflow, recipe display)
- XP triggers on scan_history / kiba_index_votes
- Vendor Directory (data curation needed)

**Phase 3 (polish):**
- Leaderboard, streaks, badges
- Poll of the Week
- Recall live feed

---

## Open Questions

1. **Kiba Kitchen recipes — what fields?** Title, ingredients list, prep instructions, species (dog/cat/both), photo, calorie estimate? Should they be tied to the scoring engine at all, or purely informational?
2. **Vendor directory — data source?** Do you have a vendor contact spreadsheet already, or does this need to be built from scratch by researching each brand?
3. **XP point values?** The plan suggests 10/50/15/100 — do those ratios feel right? Discovery (+50) being 5x a regular scan, and an accepted recipe (+100) being the highest reward?
4. **Paywall?** Is any of this premium-gated, or is the entire Community tab free? (D-125 precedent: recall alerts are free. Community features being free makes sense for engagement/retention, but XP leaderboard could be a premium perk.)
5. **Blog content format?** Plain text, markdown rendered in-app, or external URL (opens in WebView/Safari)?

---

## UI Mock Concepts

Here are preliminary visual concepts illustrating the dark mode aesthetic and layout:

````carousel
![Community Dashboard Mockup showing the XP progress and Kiba Kitchen hero card](/Users/stevendiaz/.gemini/antigravity/brain/ae1d07e4-b168-4143-9bb9-77cafbe7082b/community_dashboard_ui_1776957504022.png)
<!-- slide -->
![Discovery Grid Mockup showing Toxic Database, Vendor Directory, and Kiba Index cards](/Users/stevendiaz/.gemini/antigravity/brain/ae1d07e4-b168-4143-9bb9-77cafbe7082b/community_discovery_ui_1776957517831.png)
````
