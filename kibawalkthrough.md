# M8: Kiba Index — Walkthrough

Community-driven taste and digestion feedback, embedded directly into the Result Screen.

## Files Changed

| Status | File | Purpose |
|--------|------|---------|
| NEW | [026_kiba_index.sql](file:///Users/stevendiaz/kiba-antigravity/supabase/migrations/026_kiba_index.sql) | Schema migration: partial-vote support + RPC aggregation |
| NEW | [kibaIndexService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/kibaIndexService.ts) | Service layer: fetch stats, fetch user vote, submit vote |
| NEW | [VoteBarChart.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/result/kiba-index/VoteBarChart.tsx) | Animated horizontal bar chart component |
| NEW | [FeedbackCard.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/result/kiba-index/FeedbackCard.tsx) | Unified stats + voting card (no mode switching) |
| NEW | [KibaIndexSection.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/result/KibaIndexSection.tsx) | Orchestrator: data fetching, optimistic updates, badge logic |
| MOD | [ResultScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/ResultScreen.tsx) | Import + inject `<KibaIndexSection>` above portion cards |

---

## What Was Built

### 1. Database (Migration 026)

```diff:026_kiba_index.sql
===
-- M8: Kiba Index schema updates
-- 1. Support partial submissions for Kiba Index (drop NOT NULL constraints)
-- 2. Add secure aggregation RPC function

ALTER TABLE kiba_index_votes
  ALTER COLUMN taste_vote DROP NOT NULL,
  ALTER COLUMN tummy_vote DROP NOT NULL;

-- Aggregation function (Security Definer to bypass RLS and read community votes)
CREATE OR REPLACE FUNCTION get_kiba_index_stats(p_product_id UUID, p_species TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_votes', COUNT(v.id),
    'taste', json_build_object(
      'total', COALESCE(SUM(CASE WHEN v.taste_vote IS NOT NULL THEN 1 ELSE 0 END), 0),
      'loved', COALESCE(SUM(CASE WHEN v.taste_vote = 'loved' THEN 1 ELSE 0 END), 0),
      'picky', COALESCE(SUM(CASE WHEN v.taste_vote = 'picky' THEN 1 ELSE 0 END), 0),
      'refused', COALESCE(SUM(CASE WHEN v.taste_vote = 'refused' THEN 1 ELSE 0 END), 0)
    ),
    'tummy', json_build_object(
      'total', COALESCE(SUM(CASE WHEN v.tummy_vote IS NOT NULL THEN 1 ELSE 0 END), 0),
      'perfect', COALESCE(SUM(CASE WHEN v.tummy_vote = 'perfect' THEN 1 ELSE 0 END), 0),
      'soft_stool', COALESCE(SUM(CASE WHEN v.tummy_vote = 'soft_stool' THEN 1 ELSE 0 END), 0),
      'upset', COALESCE(SUM(CASE WHEN v.tummy_vote = 'upset' THEN 1 ELSE 0 END), 0)
    )
  )
  INTO v_result
  FROM kiba_index_votes v
  JOIN pets p ON v.pet_id = p.id
  WHERE v.product_id = p_product_id AND p.species = p_species;

  -- PostgreSQL returns null for aggregate functions over zero rows.
  -- COALESCE handles individual columns; this block handles the whole-object fallback.
  IF (v_result->>'total_votes')::int = 0 THEN
    v_result := json_build_object(
      'total_votes', 0,
      'taste', json_build_object('total', 0, 'loved', 0, 'picky', 0, 'refused', 0),
      'tummy', json_build_object('total', 0, 'perfect', 0, 'soft_stool', 0, 'upset', 0)
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key decisions:**
- Dropped `NOT NULL` on `taste_vote` and `tummy_vote` in the existing `kiba_index_votes` table (from migration 001) to support partial submissions — taste today, tummy later.
- Created `get_kiba_index_stats(product_id, species)` as a `SECURITY DEFINER` RPC. This bypasses RLS to aggregate community votes without exposing individual rows. Returns a clean JSON object with counts per option.
- Uses `COALESCE` for null-safe aggregation over zero-row results.

> [!IMPORTANT]
> **Deploy action required:** Run migration 026 against production Supabase before shipping.

---

### 2. Service Layer

[kibaIndexService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/kibaIndexService.ts) — three typed functions:

| Function | Purpose |
|----------|---------|
| `fetchKibaIndexStats` | Calls the RPC, returns `KibaIndexStats` |
| `fetchUserVote` | Queries `kiba_index_votes` for the active pet's existing vote |
| `submitKibaIndexVote` | UPSERT via `onConflict: 'user_id, pet_id, product_id'` |

All functions return typed results (`KibaIndexStats`, `KibaIndexVote`, `boolean`) with `console.error`/`console.warn` logging on failure.

---

### 3. UI: Unified Stats + Voting Cards

The core UX principle: **no mode switching.** Stats and voting coexist in the same card.

#### Card states:

| Condition | What renders |
|-----------|-------------|
| 0 votes | Voting radios + "No dogs have reviewed this yet" nudge |
| 1–4 votes | Voting radios + "3 dogs shared so far. Stats unlock at 5." |
| ≥5 votes, not voted | Bar chart on top → divider → "How did Buster like it?" → radios |
| ≥5 votes, voted | Bar chart on top → "Based on 43 dogs (incl. Buster)" → "✓ You said: Cleared the Bowl" |

#### After tapping a radio:
1. Haptic fires (medium impact)
2. Radios collapse out
3. Bar chart updates instantly (optimistic local stat bump via `structuredClone`)
4. Vote count bumps from N → N+1
5. Footer updates to "Based on 43 dogs (incl. Buster)"
6. "✓ You said: Cleared the Bowl" confirmation appears
7. Background re-fetch corrects any server-side drift

#### Prompt text is contextual:
- Taste: "How did Buster like it?"
- Tummy: "How's Buster's digestion been?"

---

### 4. Bypass Rules

The Kiba Index section is **completely hidden** for:
- Vet diets (`is_vet_diet`)
- Species mismatches
- Recalled products
- Variety packs

It **is shown** for treats and supplemental products.

### 5. Picky Eater Approved Badge

Renders when a product has ≥20 taste votes AND ≥85% "Cleared the Bowl" (`loved`). Amber accent with `medal-outline` icon.

---

## Mockups

````carousel
![Voting State](/Users/stevendiaz/.gemini/antigravity/brain/7f581614-bd28-44fd-9e63-77a30b2fc7b2/kiba_index_voting_mockup_1775018391980.png)
<!-- slide -->
![Results State](/Users/stevendiaz/.gemini/antigravity/brain/7f581614-bd28-44fd-9e63-77a30b2fc7b2/kiba_index_results_mockup_1775018403964.png)
````

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Zero new errors (pre-existing Edge Function `.ts` extension issues only) |
| Jest (`npx jest --silent`) | ✅ 58 suites, 1278 tests, 2 snapshots — all passing |
| Rule compliance | ✅ No scoring engine changes, no paywall outside `permissions.ts`, no `any` types, no emoji in UI |
| Regression anchors | ✅ Pure Balance = 62, Temptations = 9 (unchanged) |

---

## Next Steps

1. **Apply Migration 026** to production Supabase
2. **Test end-to-end** on iOS simulator: scan a product → scroll to Kiba Index → vote → verify bar chart update
3. **Consider** adding Picky Eater Approved badge to Safe Swap cards (cross-feature integration, separate task)
