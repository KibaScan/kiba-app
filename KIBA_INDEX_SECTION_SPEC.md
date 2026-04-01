# Kiba Index — Result Screen Section Spec

## Position & Container

**Location:** Last collapsible section on Result Screen, below Advisories.
**Default state:** Collapsed.
**Section title:** "Kiba Index"
**Subtitle (collapsed):** Shows vote count when available — e.g., "42 dogs weighed in" or "New — be the first!"

---

## States

### State 1: Zero Votes (Cold Start)

Triggers when `product_index_stats` returns 0 votes for the pet's species on this product.

```
┌─────────────────────────────────────────────┐
│                                             │
│   🐾  How does your pet like this food?     │
│                                             │
│   No [dogs/cats] have reviewed this         │
│   product yet. Be the first to share        │
│   [Pet Name]'s experience!                  │
│                                             │
│  ┌───────────────┐  ┌───────────────────┐   │
│  │ 🍽 Taste Test │  │ 🩺 Tummy Check   │   │
│  │               │  │                   │   │
│  │ How did       │  │ How's digestion   │   │
│  │ [Pet Name]    │  │ been?             │   │
│  │ like it?      │  │                   │   │
│  │               │  │ ○ Perfect Poops   │   │
│  │ ○ Cleared     │  │ ○ Slight Upset    │   │
│  │   the Bowl    │  │ ○ Hard Pass       │   │
│  │ ○ Picky       │  │                   │   │
│  │ ○ Refused     │  │                   │   │
│  └───────────────┘  └───────────────────┘   │
│                                             │
│   Submit one or both — no rush.             │
│                                             │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Orange card (left): Taste Test. Blue card (right): Tummy Check.
- Radio-style selection, 1-tap per card.
- User can submit just Taste, just Tummy, or both — partial submission supported (D-locked: taste Day 1, digestion Day 7).
- After submitting either card, that card transitions to "Your Vote" state (State 4) immediately with haptic feedback.
- Pet name pulled from active pet profile context.
- Copy uses species name: "No dogs have reviewed" / "No cats have reviewed."

---

### State 2: Below Threshold (1–4 Votes)

Triggers when 1–4 votes exist for this species. Percentages are NOT shown — too small a sample to be meaningful.

```
┌─────────────────────────────────────────────┐
│                                             │
│   🐾  Early results for [dogs/cats]         │
│                                             │
│   [N] [dogs/cats] have shared so far.       │
│   Community stats unlock at 5 reviews.      │
│                                             │
│  ┌───────────────┐  ┌───────────────────┐   │
│  │ 🍽 Taste Test │  │ 🩺 Tummy Check   │   │
│  │               │  │                   │   │
│  │  [voting UI   │  │  [voting UI       │   │
│  │   same as     │  │   same as         │   │
│  │   State 1]    │  │   State 1]        │   │
│  └───────────────┘  └───────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Same voting cards as State 1 (if user hasn't voted yet).
- If user has already voted, show State 4 cards instead.
- Progress indicator: "3 of 5 reviews to unlock stats" — subtle encouragement without being pushy.

---

### State 3: Populated (5+ Votes)

Triggers when 5+ votes exist for the pet's species. Community stats are now shown.

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌─ 🍽 Taste Test ────────────────────────┐ │
│  │                                        │ │
│  │  Cleared the Bowl  ████████████░  88%  │ │
│  │  Picky             ██░░░░░░░░░░░   8%  │ │
│  │  Refused           █░░░░░░░░░░░░   4%  │ │
│  │                                        │ │
│  │  Based on 42 dogs         Rate it →    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ 🩺 Tummy Check ──────────────────────┐ │
│  │                                        │ │
│  │  Perfect Poops     ██████████░░░  76%  │ │
│  │  Slight Upset      ███░░░░░░░░░░  20%  │ │
│  │  Hard Pass         █░░░░░░░░░░░░   4%  │ │
│  │                                        │ │
│  │  Based on 38 dogs         Rate it →    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  🏆 Picky Eater Approved                   │
│  85%+ of dogs cleared the bowl              │
│                                             │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Horizontal bar chart per option, with percentage labels right-aligned.
- Taste card uses orange fill bars. Tummy card uses blue fill bars.
- Vote counts can differ between Taste and Tummy (partial submissions) — show actual count per card: "Based on 42 dogs" vs "Based on 38 dogs."
- Species-filtered: if user's pet is a dog, only dog votes shown. Cat stats are completely separate.
- "Rate it →" CTA if the current pet hasn't voted on that card yet. Tapping opens inline voting (radio options replace the bar chart temporarily).
- **Picky Eater Approved badge** shown ONLY when: ≥20 votes AND ≥85% "Cleared the Bowl" for this species. Orange accent. This badge also appears on Safe Swap cards (M6) for this product.
- If user has already voted on a card, "Rate it →" is replaced with "Your vote: Cleared the Bowl ✓" (muted, not editable — one vote per pet per product, locked decision).

---

### State 4: User Has Voted (Per-Card)

Each card independently tracks whether the active pet has voted. A card the user has voted on shows their selection; a card they haven't voted on still shows the voting UI or bar chart with CTA.

**Voted card (inline, replaces voting options):**

```
┌─ 🍽 Taste Test ────────────────────────────┐
│                                             │
│  ✓ You said: Cleared the Bowl               │
│                                             │
│  [community bar chart if 5+ votes,          │
│   or "Waiting for more reviews" if <5]      │
│                                             │
│  Based on 42 dogs (incl. [Pet Name])        │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Checkmark + "You said: [option]" in the card's accent color (orange for Taste, blue for Tummy).
- Community stats shown below if threshold met, confirming their vote counted.
- No edit/undo — vote is final per pet_profile_id + product_id. This is a locked decision.
- If user switches active pet and the new pet hasn't voted, voting UI reappears.

---

### State 5: No Active Pet Profile

Edge case — user hasn't created a pet profile yet.

```
┌─────────────────────────────────────────────┐
│                                             │
│   Add a pet profile to share your           │
│   pet's experience with this food.          │
│                                             │
│   [ Add Pet → ]                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Minimal. Don't overdesign this — users without pet profiles are in a broken state anyway (the score ring says "match for ?" which is already guiding them to add a pet).
- CTA navigates to pet profile creation flow.

---

## Voting Flow

1. User taps a radio option on either card.
2. Haptic feedback (medium impact).
3. Option highlights in card accent color.
4. 1-second delay, then card transitions to State 4 (voted) with a subtle fade.
5. Optimistic write — POST to `community_feedback` immediately. If network fails, show toast "Vote saved offline — we'll sync when you're back" and queue for retry.
6. The other card remains in its current state (voting or already voted).

**Data model refresh:**
```
community_feedback
├── id (UUID, PK)
├── user_id (FK → auth.users)
├── pet_profile_id (FK → pets)
├── product_id (FK → products)
├── taste_score ('cleared' | 'picky' | 'refused' | NULL)
├── digestion_score ('perfect' | 'slight_upset' | 'hard_pass' | NULL)
├── created_at
├── updated_at
└── UNIQUE(product_id, pet_profile_id)
```

**RLS:** Users can INSERT/UPDATE their own rows. Everyone can SELECT (community stats are public). No DELETE — votes are permanent.

**Aggregation view:** `product_index_stats` groups by `product_id` + species (via JOIN to `pets`), counts per option, filters by species. At scale, consider materialized view refreshed via pg_cron.

---

## Bypass Interactions

- **Vet diet products:** Kiba Index section is HIDDEN. Vet diets aren't scored — community votes would be misleading without a score for context.
- **Species mismatch:** Kiba Index section is HIDDEN. If a dog owner scans cat food, community cat votes aren't useful to them.
- **Variety packs:** Kiba Index section is HIDDEN. Can't meaningfully rate a pack of 12 different flavors as one product.
- **Recalled products:** Kiba Index section is HIDDEN. Don't encourage engagement with recalled products.
- **Supplemental products:** Kiba Index section is SHOWN. Toppers/mixers have valid taste/digestion feedback.
- **Treats:** Kiba Index section is SHOWN. Taste Test is especially relevant for treats.

---

## Milestone Scope Note

The Kiba Index was originally scoped for M18 in the roadmap. This spec documents the locked design decisions for when it's built. If we're building it earlier, that's a scope decision for Steven.
