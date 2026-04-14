# Repo Public Cleanup — Design Spec

**Date:** 2026-04-13
**Author:** Steven Diaz (with Claude Code)
**Status:** Approved, ready for implementation plan
**Branch:** `m9-repo-public-cleanup`

---

## Context

Steven is temporarily making the Kiba repository public (~1 week window) so potential employers can evaluate the work. The repo is currently a private active dev workspace and has accumulated root-level scratch docs, stale AI-assistant config, and a few scraping-provenance markers that should not be the first thing a recruiter reads.

The cleanup is presentation-focused, not functional. Source code under `src/`, scoring engine tests, migrations, and design-system documentation stay untouched — those are the signal recruiters should see.

## Goals

- Repo root reads cleanly: no obvious scratch files, no stale config, no ambiguous AI guidance.
- GitHub default branch (`main`) reflects current M9 state, not an M0-era snapshot.
- `README.md` gives a recruiter an honest, useful first impression in ≤2 minutes.
- Scraping provenance is softened in one external-facing file and the public AI briefing. Internal decision logs left as-is.
- No secrets leak. No raw scraped data leaks. (Already true via gitignore; verify.)
- One-week exposure window means no long-lived infra investment (no CI, no issue templates, no CONTRIBUTING).

## Non-Goals

- Rewriting git history for aesthetics (session-by-session commits are honest signal, not noise).
- Squashing, rebasing, or force-pushing any branch.
- Setting up GitHub Actions / CI badges that would require real pipeline work.
- Soliciting open-source contributions (no CONTRIBUTING.md, CODE_OF_CONDUCT, issue templates, SECURITY.md).
- Modifying any code under `src/`, `supabase/migrations/`, `__tests__/`, or `.agent/`.
- Producing screenshots, GIFs, or demo videos (text-only README; slot for screenshots left open for future).
- Scrubbing retailer names across multi-megabyte decision logs (`DECISIONS.md`, `ROADMAP.md`, `CURRENT.md`) — not worth the time, and the engineering-rigor signal those docs carry is more valuable than the provenance softening.

---

## Design

### Section 1 — Cleanup (deletions + softening)

**Delete from git + disk (20 root-level scratch markdown files):**

- `M6_HANDOFF.md`
- `M6_WEIGHT_MANAGEMENT_PROMPT.md`
- `M6_COMPARE_SCREEN_PROMPT.md`
- `M6_HEALTH_CONDITIONS_PART2_PROMPT.md`
- `m9walkthrough.md`
- `m9scorewalkthrough.md`
- `m9pantrywalkthrough.md`
- `m9safewalkthrough.md`
- `m9Mewalkthrough.md`
- `walkthrough3.md`
- `kibawalkthrough.md`
- `implementation_plan.md`
- `implementation_plan_review.md`
- `m9implementation_plan.md`
- `m9homeimplementation_plan.md`
- `m9Safeimplementation_plan.md`
- `kibaindeximplementation_plan.md`
- `KIBA_INDEX_SECTION_SPEC.md`
- `SEARCH_SCREEN_SPEC.md`
- `ui_improvements_review.md`

**Delete from git + disk (2 root-level PNGs):**

- `safe_switch_redesign_1775412634761.png` (362KB)
- `vet_report_page1_v2_1774716694435.png` (526KB)

**Delete from git + disk (1 stale AI config):**

- `.cursorrules` — references M4.5 / M5 Pantry phase while project is on M9. `CLAUDE.md` is the canonical AI briefing; dual guidance files create drift and confusion.

**Delete from git + disk (1 scraping ops playbook):**

- `scripts/import/V7_REIMPORT_INSTRUCTIONS.md` — explicitly documents scraping "Chewy + Amazon + Walmart" as sources. This is a private operations playbook with zero portfolio value and the single most direct retailer-name mention in the repo. Internal version remains recoverable via git history if needed.

**Soften retailer names in 2 remaining tracked files:**

- `docs/references/dataset-field-mapping.md`:
  - Header line 6: "v7 reimport — migration 020, 19,058 products from Chewy + Amazon + Walmart" → "v7 reimport — migration 020, 19,058 products from publicly available retailer product pages"
  - Source section lines 10-12: strip "Chewy, Amazon, Walmart" retailer names and "v6 merged (9,089 records, Chewy only)" → generic "current catalog: 19,058 products" / "previous: v6 merged (9,089 records), fully superseded by v7"
- `CLAUDE.md`:
  - Schema Traps section, `products` bullet: "19,058 products from Chewy + Amazon + Walmart" → "19,058 products"

**Verify untouched:**

- `.env` — not tracked, properly gitignored. No action.
- `.DS_Store` — not tracked, properly gitignored. Delete from disk at root for tidiness before pushing.
- `dataset_kiba_v7_master.json` (57MB scraped JSON) — not tracked. No action.
- `DECISIONS.md` / `ROADMAP.md` / `CURRENT.md` — left as-is (scrubbing cost > benefit for the one-week window).

**Secret rotation (user executes; implementation plan will list commands):**

- Rotate `SUPABASE_SERVICE_ROLE_KEY` via Supabase dashboard → Settings → API
- Rotate `ANTHROPIC_API_KEY` via console.anthropic.com
- Rotate `SCRAPEDO_API_KEY` via scrape.do dashboard
- Leave `SUPABASE_ANON_KEY` + `EXPO_PUBLIC_SUPABASE_URL` (public by design, enforced by RLS)
- Leave `REVENUECAT_API_KEY` (test_ prefix = sandbox)

These keys never hit git but rotation is cheap insurance against any exposure via transcripts, screenshares, or accidental past commit attempts. Implementation plan will prompt Steven to do this before pushing public; it is not blocking for the cleanup PR itself.

### Section 2 — Content additions

**`README.md`** (new, 150-200 lines) — structured for a recruiter's 2-minute skim:

1. **Hero** — small icon (reuse `assets/icon.png`) + product one-liner ("iOS pet food scanner — scan barcode, get ingredient-level, species-specific suitability score") + kibascan.com link.
2. **What makes this interesting** — 3-5 bullets calling out non-obvious engineering:
   - 3-layer scoring engine (Ingredient Quality + Nutritional Profile + Formulation Completeness, with species rules and per-pet personalization)
   - Brand-blind architecture (scoring engine has no awareness of brand names by design)
   - 129-decision log with explicit supersession markers
   - Supabase RLS on every user table + Edge Function-backed batch scoring
   - Offline-first pantry with `PantryOfflineError` boundary
   - Matte Premium design system formalized in `.agent/design.md`
3. **Tech stack** — one line: Expo SDK 55 / React Native 0.83 / TypeScript 5.9 strict / Zustand / Supabase (Postgres + Auth + Storage + RLS) / RevenueCat / Jest.
4. **Architecture at a glance** — ASCII or mermaid diagram of scan → UPC lookup → engine → result flow. Text-only, no image dependency.
5. **Reading list — if you are evaluating this code, start here**:
   - `src/services/scoring/` — the core engine, 3 layers + species rules + personalization
   - `DECISIONS.md` — 129 numbered decisions with rationale and supersessions
   - `docs/references/scoring-rules.md` — authoritative scoring math
   - `.agent/design.md` — design system (tokens, card anatomy, anti-patterns)
   - `supabase/migrations/` — 38 migrations, RLS applied throughout
   - `__tests__/` — 1473 tests, regression anchors documented in `docs/status/CURRENT.md`
6. **Running locally** — honest note that this is primarily for code review, not a bootable demo (requires Supabase project + RevenueCat account not included in the repo). Commands that DO work cold: `npm install`, `npm test`, `npx tsc --noEmit`.
7. **Regression anchors** — Pure Balance (Dog) = 61, Temptations (Cat Treat) = 0, verified in `__tests__/services/scoring/regressionTrace.test.ts`. Signals determinism-first thinking.
8. **Data & IP** — short paragraph: product catalog populated from publicly available retailer product pages, raw datasets gitignored, repo contains only derived aggregate ingredient metadata and pipeline code.
9. **License** — one line pointing to `LICENSE`.
10. **Footer** — author name + email, "temporarily public for portfolio review" note + date.

**`LICENSE`** (new) — source-available / view-only:

```
Copyright (c) 2026 Steven Diaz. All rights reserved.

This repository is made available for portfolio review purposes. You
may view and reference the code. You may not copy, modify, distribute,
fork, or use this code for any commercial or derivative purpose without
prior written permission from the copyright holder.

The scoring engine, product decisions, ingredient taxonomy, and all
associated documentation are proprietary intellectual property of the
Kiba project (kibascan.com).

For inquiries: steven.diaz08@gmail.com
```

**`docs/ARCHITECTURE.md`** (new, 80-120 lines) — one-page tour for reviewers who want to go one level deeper than the README:

- Directory tree with one-line per major folder (`src/screens/`, `src/services/`, `src/components/`, `supabase/functions/`, etc.)
- Scoring pipeline sequence: bypasses (vet diet → species mismatch → variety pack → recalled) → Layer 1 (IQ + NP + FC) → Layer 2 (species rules) → Layer 3 (personalization). Each layer independently testable.
- Data flow: scan → UPC lookup → engine → RLS-protected scan persist → optional pantry add → push notification for recall / feeding / low stock.
- Where to look for specific concerns: paywall (`src/utils/permissions.ts`), design system (`.agent/design.md`), offline boundary (`src/utils/network.ts` + `PantryOfflineError`), batch scoring (`supabase/functions/batch-score/` + `src/services/topMatches.ts`).

**`package.json` metadata additions:**

- `"description"`: "iOS pet food scanner with ingredient-level, species-specific scoring"
- `"author"`: "Steven Diaz <steven.diaz08@gmail.com>"
- `"license"`: `"UNLICENSED"` (correct npm value for all-rights-reserved; signals "not OSS")
- `"repository"`: `{"type": "git", "url": "git+https://github.com/KibaScan/kiba-app.git"}`
- `"private"`: already `true` — keep

**Static badges in README** (shields.io, no CI dependency):

- `typescript 5.9 strict`
- `expo SDK 55`
- `react native 0.83`
- `jest 1473 tests`
- `license UNLICENSED`

All values pulled from `package.json` and `docs/status/CURRENT.md`. No CI required; numbers are honest because they link to sources anyone can check.

**GitHub repo metadata** (via `gh repo edit` or web UI, implementation plan will include commands):

- Description: "iOS pet food scanner with ingredient-level, species-specific scoring engine. 1473 tests, 129 product decisions documented."
- Topics: `react-native`, `expo`, `typescript`, `supabase`, `pet-food`
- Default branch: `main` (see Section 3)

### Section 3 — Branch strategy

**The problem:** `main` has not been updated since M0 era. All M1-M9 work lives on `m5-complete`. A recruiter lands on GitHub and sees `main` by default, reading code that does not reflect current work. This is the worst first impression in the repo.

**The fix:**

1. Cleanup work happens on `m9-repo-public-cleanup` (already created, branched from `m5-complete`).
2. When complete, merge `m9-repo-public-cleanup` → `m5-complete` via PR (standard flow, matches Steven's branch-per-session workflow).
3. Fast-forward `main` to `m5-complete`:
   ```
   git checkout main
   git merge --ff-only m5-complete
   git push origin main
   ```
   Result: `main` reflects current M9 state. GitHub default branch shows the good stuff.
4. Delete merged remote feature branches before the public window opens:
   - `origin/m4.5-cleanup` — superseded long ago (confirmed ancestor of `m5-complete`)
   - `origin/fix/pantry-pet-switch-latency` — merged into m5-complete (session 43)
   - `origin/m9-dry-food-cups` — merged via PR #5
   - `origin/m9-pantry-polish` — merged via PR #4

   **Verification note for the implementation plan:** GitHub's "Squash and merge" strategy rewrites feature-branch commits into a single new commit on the target, so `git merge-base --is-ancestor` returns false for 3 of these 4 branches even though their content is in `m5-complete`. The implementation plan must verify each branch's merged status via `gh pr list --state merged --head <branch>` or by confirming the PR number is closed as merged — not via `is-ancestor`. Do not force-delete any branch without a merged PR on record.
5. Keep `origin/m5-complete` and `origin/m9-repo-public-cleanup` (ephemeral; will be merged before making public).
6. After the public window closes, Steven flips repo back to private via GitHub settings. No code rollback needed.

**What we explicitly do NOT do:**

- No `git filter-repo`, `git filter-branch`, rebase, or force-push. History stays honest.
- No squashing session commits into milestone commits. Per-session commits with thoughtful messages are better signal than artificially-cleaned history.
- No changes to the default branch name (`main` remains `main`).
- No orphan branch or fresh-history approach.

### Final polish (small items bundled into the implementation plan)

- `.gitignore` audit — verify `.expo/`, `coverage/`, `*.log` patterns. Repo's `.gitignore` already handles most of this; spot-check only.
- `.DS_Store` on disk at root — delete from disk before pushing (already gitignored, but untidy to leave dangling).
- Cold-install validation — verify `npm install && npm test` works from scratch without any secrets. (Should already work; tests do not require `.env`.)
- Set GitHub repo description and topics via `gh repo edit`.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Retailer legal team finds the repo via search and sends C&D | Delete explicit scraping playbook (`V7_REIMPORT_INSTRUCTIONS.md`), soften 2 other tracked files. One-week public window reduces practical exposure. Raw scraped data never hit git. |
| Secret leaks via transcripts or screenshares | Rotate 3 high-value keys before going public. Rotation is a user action, not blocking for the PR, but called out in the implementation plan. |
| Recruiter bounces off stale `main` | Fast-forward `main` to `m5-complete` as part of the same cleanup PR flow. |
| Recruiter reads `DECISIONS.md` and sees retailer references | Accepted risk. Scrubbing megabytes of decision logs is not worth the time for a one-week window, and engineering-rigor signal exceeds provenance softening value. |
| `README.md` overclaims or misleads | Keep README tightly grounded in checkable facts (commit hashes, file paths, test count from `docs/status/CURRENT.md`). All numbers link to source. |

## Testing Strategy

This is pure content and file-hygiene work; no runtime behavior changes. Validation is:

- `npm test` continues to pass (1473 passing / 63 suites baseline). Any regression is unacceptable and would indicate an accidental source-file touch.
- `npx tsc --noEmit` clean in `src/` + `__tests__/` (same 79 pre-existing errors in `docs/plans/` and `supabase/functions/batch-score/scoring/` as current baseline — not introduced by this work).
- Manual: `npm install` from a clean clone on a throwaway directory verifies `node_modules` + lock file are coherent.
- Manual: visit the GitHub repo on `main` after the fast-forward and confirm the README renders correctly, the directory root looks clean, and no deleted files 404 on any inbound link from `CLAUDE.md` or `DECISIONS.md`.

## Rollout Sequence (will drive the implementation plan)

1. **Deletions + softening** on branch `m9-repo-public-cleanup`. Commit in logical chunks (scratch markdown deletion, PNG deletion, `.cursorrules` deletion, scraping playbook deletion, retailer-name softening, `.DS_Store` tidy).
2. **`LICENSE`** committed.
3. **`package.json` metadata** additions committed.
4. **`docs/ARCHITECTURE.md`** committed.
5. **`README.md`** committed (last, because it references everything above).
6. **PR `m9-repo-public-cleanup` → `m5-complete`**, normal review cadence.
7. **Steven rotates secrets** (SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, SCRAPEDO_API_KEY) via provider dashboards.
8. **Fast-forward `main`** from `m5-complete`.
9. **Delete merged remote feature branches.**
10. **Set GitHub repo description + topics.**
11. **Flip repo visibility to public** via GitHub settings.
12. (One week later) **Flip back to private**, no cleanup required.

## Open Questions

None. All blocking decisions resolved during brainstorming (approach 2, scrub option A, name + email, screenshots deferred).

---

## Verification Checklist

Before merge:

- [ ] All 20 root scratch markdowns gone from disk and git.
- [ ] 2 root PNGs gone from disk and git.
- [ ] `.cursorrules` gone from disk and git.
- [ ] `scripts/import/V7_REIMPORT_INSTRUCTIONS.md` gone from disk and git.
- [ ] `docs/references/dataset-field-mapping.md` softened, no "Chewy" / "Amazon" / "Walmart" in tracked version.
- [ ] `CLAUDE.md` line 62 softened, no retailer names.
- [ ] `README.md` renders correctly on GitHub.
- [ ] `LICENSE` file present and readable.
- [ ] `docs/ARCHITECTURE.md` present.
- [ ] `package.json` has description / author / license / repository fields.
- [ ] `npm test` passes (1473 / 63 suites baseline).
- [ ] `npx tsc --noEmit` clean in `src/` + `__tests__/`.
- [ ] `main` is fast-forwarded from `m5-complete` on remote.
- [ ] Merged remote feature branches (`m4.5-cleanup`, `fix/pantry-pet-switch-latency`, `m9-dry-food-cups`, `m9-pantry-polish`) deleted.
- [ ] GitHub repo description + topics set.
- [ ] Secrets rotated (Supabase service role, Anthropic, Scrape.do). **User action.**
- [ ] Repo flipped to public via GitHub settings. **User action.**

Post-window:

- [ ] Repo flipped back to private after ~1 week. **User action.**
