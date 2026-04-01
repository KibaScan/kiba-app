# M8: Kiba Index Implementation Plan

The goal is to implement the Kiba Index feature described in `KIBA_INDEX_SECTION_SPEC.md` using the project's current aesthetic and architectural patterns. The Kiba Index establishes a community-driven feedback loop directly embedded into the Scan Result screen, allowing users to log "Taste" and "Tummy" feedback.

## User Review Required

> [!IMPORTANT]
> The original spec describes creating a `community_feedback` table. However, since `kiba_index_votes` was already established in the `001_initial_schema.sql` migration, I propose updating the existing table rather than creating a duplicate. 
> 
> I also propose using an **RPC function (Postgres function)** to aggregate the votes efficiently, instead of querying raw rows on the client. Please confirm this database approach in the **Open Questions** section.

## Mockups

I generated mockups matching our current UI aesthetic (soft dark #1A1A1A background, subtle elevation #242424 cards, SF symbol stylistic lines, modern typography).

````carousel
![Voting State](/Users/stevendiaz/.gemini/antigravity/brain/7f581614-bd28-44fd-9e63-77a30b2fc7b2/kiba_index_voting_mockup_1775018391980.png)
<!-- slide -->
![Results State](/Users/stevendiaz/.gemini/antigravity/brain/7f581614-bd28-44fd-9e63-77a30b2fc7b2/kiba_index_results_mockup_1775018403964.png)
````

## Proposed Changes

---

### Database Layer (Migration 026)

#### [NEW] `supabase/migrations/026_kiba_index.sql`
- **Modify `kiba_index_votes`**: Drop the `NOT NULL` constraint on `taste_vote` and `tummy_vote` to support partial submissions as described in the specs.
- **Add RPC Function**: Create `get_kiba_index_stats(p_product_id UUID, p_species TEXT)` to aggregate stats securely on the backend. This function will return the full JSON count, percentages, and total votes per category to prevent the client from downloading all raw votes. 
- **Mapping Constraint**: The existing table uses slightly different enum strings than the spec (`loved` vs `cleared`, `soft_stool` vs `slight_upset`). We will keep the database schema as-is to avoid ripping out constraints, and map the values to the spec's display strings in the frontend component.

---

### Frontend Services

#### [NEW] `src/services/kibaIndexService.ts`
- Implement `fetchKibaIndexStats(productId, species)` which calls the Supabase RPC.
- Implement `submitKibaIndexVote(productId, petId, voteData)` to UPSERT into `kiba_index_votes`.
- Implement `fetchUserVote(productId, petId)` to check if the current active pet has already voted. 

---

### Frontend Components

#### [MODIFY] `src/screens/ResultScreen.tsx`
- Insert `<KibaIndexSection />` at the bottom of the scroll view, just before the Share button or Insights, per layout requirements. 
- Implement bypass rules: Do not render if the product is a `vet_diet`, `variety_pack`, `recalled`, or if there's a `species_mismatch`.

#### [NEW] `src/components/result/kiba-index/KibaIndexSection.tsx`
- The wrapper component.
- Uses a `CollapsibleSection` titled "Kiba Index".
- Manages local state for data fetching (stats & user vote), loading states, and submitting votes optimistically. 
- Handles the **Picky Eater Approved** badge logic (≥20 votes, ≥85% loved).

#### [NEW] `src/components/result/kiba-index/TasteTestCard.tsx` & `TummyCheckCard.tsx`
- The UI cards displaying either the voting radio list (State 1/2) or the results bar chart (State 3).
- Uses standard color conventions (`Colors.accent` mapped to orange for Taste, blue for Tummy).
- Handles transition to "Voted State" (State 4) upon selection.

#### [NEW] `src/components/result/kiba-index/VoteBarChart.tsx`
- Reusable horizontal bar chart for the community statistics. 
- Implements the solid color fill against the #242424 card background.

## Open Questions

> [!WARNING]
> Please provide your feedback on the following questions before I begin execution:

1. **Table Schema Override**: Are you okay with me altering the existing `kiba_index_votes` table (dropping NOT NULL) instead of creating a brand new `community_feedback` table as described in the spec? 
2. **Aggregations**: Are you okay with an RPC function for aggregations, or would you prefer a materialized view as hinted in the spec? (An RPC is usually more real-time and easier to set up at this stage, while a materialized view is better when data sets get massive).
3. **Picky Eater Badge**: Should the "Picky Eater Approved" badge also be implemented simultaneously on the Safe Swap cards, or should we save that cross-integration for a follow-up task?

## Verification Plan

### Automated Tests
- Create `__tests__/services/kibaIndexService.test.ts` to test vote formatting and submission logic.
- Create `__tests__/components/KibaIndexSection.test.ts` snapshot test and UI state mock test.

### Manual Verification
- Render the Section on the Result Screen and interact with it.
- Verify that submitting a single vote immediately updates the UI with haptic feedback.
- Verify that a 5th vote transitions the state from "Below Threshold" to "Populated".
- Test edge cases (no active pet, vet diet bypass).
