# Bookmarks & Expanded History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-pet Bookmarks feature (hard cap 20) and expose a full 20-item scan history via new dedicated `BookmarksScreen` and `ScanHistoryScreen`, with a new ResultScreen overflow menu hosting Bookmark / Share / Report issue.

**Architecture:** Client-scoped Supabase table (`bookmarks`) + service (`bookmarkService`) + Zustand store (`useBookmarkStore`) wired into HomeScreen's existing inline scan-row style. Re-uses existing `pet_product_scores` cache for live score display, `SwipeableRow` for delete gestures, `PantryCard`'s recalled treatment, and the app's existing bottom-sheet aesthetic for the new overflow menu. No Android adaptation, no paywall gate, no new scoring logic.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.83, Expo SDK 55, Supabase (Postgres + RLS), Zustand 5, Jest (jest-expo) + `@testing-library/react-native` for render tests, Ionicons, `expo-haptics`, `Linking`.

**Spec:** `docs/superpowers/specs/2026-04-17-bookmarks-and-expanded-history-design.md`

---

## Prerequisites

- Current branch `m9-reduce-score-noise` has pending D-168 work. Cut a **new branch off `m5-complete`** before starting.
- Design spec has been approved.

---

## Task 1: Branch + migration + types

**Files:**
- Create: `supabase/migrations/040_bookmarks.sql`
- Create: `src/types/bookmark.ts`

- [ ] **Step 1: Cut branch off `m5-complete`**

```bash
git fetch origin
git checkout -b m9-bookmarks-history origin/m5-complete
```

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/040_bookmarks.sql` exactly:

```sql
-- Migration 040: Bookmarks (per-pet product watchlist)
-- D-169: Per-pet bookmark list, hard cap 20 enforced client-side.

CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pet_id, product_id)
);

CREATE INDEX idx_bookmarks_pet_created ON bookmarks (pet_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmarks_owner ON bookmarks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 3: Create `src/types/bookmark.ts`**

```typescript
// Bookmarks types + error classes. Mirrors src/types/pantry.ts pattern.

export interface Bookmark {
  id: string;
  user_id: string;
  pet_id: string;
  product_id: string;
  created_at: string;
}

/**
 * Composite view for rendering: bookmark + joined product info + live match score.
 * Mirrors PantryCardData pattern.
 */
export interface BookmarkCardData {
  bookmark: Bookmark;
  product: {
    id: string;
    brand: string;
    name: string;
    image_url: string | null;
    is_recalled: boolean;
    is_vet_diet: boolean;
    is_variety_pack: boolean;
    is_supplemental: boolean;
    target_species: 'dog' | 'cat';
  };
  /** Live score from pet_product_scores cache; null if unscored/bypass */
  final_score: number | null;
}

export const MAX_BOOKMARKS_PER_PET = 20;

export class BookmarkOfflineError extends Error {
  constructor() {
    super('You are offline. Bookmarks cannot be modified.');
    this.name = 'BookmarkOfflineError';
  }
}

export class BookmarksFullError extends Error {
  constructor() {
    super(`Bookmark limit reached (${MAX_BOOKMARKS_PER_PET}). Remove one to save another.`);
    this.name = 'BookmarksFullError';
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/040_bookmarks.sql src/types/bookmark.ts
git commit -m "M9: bookmarks migration + types"
```

---

## Task 2: `bookmarkService` with TDD

**Files:**
- Create: `src/services/bookmarkService.ts`
- Test: `__tests__/services/bookmarkService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/bookmarkService.test.ts`:

```typescript
// Bookmark Service Tests — offline guard + cap enforcement + CRUD.
// Mirrors pantryService.test.ts pattern.

import {
  addBookmark,
  removeBookmark,
  toggleBookmark,
  getBookmarksForPet,
  isBookmarked,
} from '../../src/services/bookmarkService';
import {
  BookmarkOfflineError,
  BookmarksFullError,
  MAX_BOOKMARKS_PER_PET,
} from '../../src/types/bookmark';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn(),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
  },
}));

import { isOnline } from '../../src/utils/network';
import { supabase } from '../../src/services/supabase';

function mockChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'order', 'limit', 'not']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  (isOnline as jest.Mock).mockResolvedValue(true);
});

describe('offline guards', () => {
  beforeEach(() => {
    (isOnline as jest.Mock).mockResolvedValue(false);
  });

  test('addBookmark throws BookmarkOfflineError when offline', async () => {
    await expect(addBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarkOfflineError);
  });

  test('removeBookmark throws BookmarkOfflineError when offline', async () => {
    await expect(removeBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarkOfflineError);
  });

  test('getBookmarksForPet returns [] when offline', async () => {
    await expect(getBookmarksForPet('pet-1')).resolves.toEqual([]);
  });
});

describe('cap enforcement', () => {
  test('addBookmark throws BookmarksFullError when pet has 20 bookmarks', async () => {
    const countChain = mockChain({ data: null, error: null, count: MAX_BOOKMARKS_PER_PET });
    (supabase.from as jest.Mock).mockReturnValueOnce(countChain);

    await expect(addBookmark('pet-1', 'prod-1')).rejects.toBeInstanceOf(BookmarksFullError);
  });

  test('addBookmark succeeds when pet has 19 bookmarks', async () => {
    const countChain = mockChain({ data: null, error: null, count: 19 });
    const insertChain = mockChain({
      data: { id: 'bm-1', user_id: 'user-1', pet_id: 'pet-1', product_id: 'prod-1', created_at: 'now' },
      error: null,
    });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    const result = await addBookmark('pet-1', 'prod-1');
    expect(result.id).toBe('bm-1');
  });
});

describe('CRUD', () => {
  test('removeBookmark deletes row', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await removeBookmark('pet-1', 'prod-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('pet_id', 'pet-1');
  });

  test('isBookmarked returns true when row exists', async () => {
    const chain = mockChain({ data: { id: 'bm-1' }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(isBookmarked('pet-1', 'prod-1')).resolves.toBe(true);
  });

  test('isBookmarked returns false when row missing', async () => {
    const chain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(isBookmarked('pet-1', 'prod-1')).resolves.toBe(false);
  });

  test('toggleBookmark removes when bookmarked', async () => {
    const existsChain = mockChain({ data: { id: 'bm-1' }, error: null });
    const deleteChain = mockChain({ data: null, error: null });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(existsChain)
      .mockReturnValueOnce(deleteChain);

    const result = await toggleBookmark('pet-1', 'prod-1');
    expect(result).toBe(false);
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  test('toggleBookmark adds when not bookmarked', async () => {
    const existsChain = mockChain({ data: null, error: null });
    const countChain = mockChain({ data: null, error: null, count: 0 });
    const insertChain = mockChain({
      data: { id: 'bm-1', user_id: 'user-1', pet_id: 'pet-1', product_id: 'prod-1', created_at: 'now' },
      error: null,
    });
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(existsChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(insertChain);

    const result = await toggleBookmark('pet-1', 'prod-1');
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern=bookmarkService
```

Expected: FAIL — module `../../src/services/bookmarkService` does not exist.

- [ ] **Step 3: Create `src/services/bookmarkService.ts`**

```typescript
// Bookmark Service — Supabase CRUD + 20-cap enforcement + card hydration.
// Follows pantryService.ts patterns. Offline = throw/empty-read.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import { batchScoreHybrid } from './batchScoreOnDevice';
import {
  type Bookmark,
  type BookmarkCardData,
  BookmarkOfflineError,
  BookmarksFullError,
  MAX_BOOKMARKS_PER_PET,
} from '../types/bookmark';
import type { Pet } from '../types/pet';

async function requireOnline(): Promise<void> {
  if (!(await isOnline())) throw new BookmarkOfflineError();
}

async function getActiveUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');
  return session.user.id;
}

/**
 * True if a row exists for (petId, productId).
 */
export async function isBookmarked(petId: string, productId: string): Promise<boolean> {
  if (!(await isOnline())) return false;
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('pet_id', petId)
    .eq('product_id', productId)
    .maybeSingle();
  return data !== null;
}

/**
 * Returns all bookmarks for a pet, newest first.
 * Joins product info. Score is NOT included here — resolve via pet_product_scores cache at the caller.
 */
export async function getBookmarksForPet(petId: string): Promise<Bookmark[]> {
  if (!(await isOnline())) return [];
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(MAX_BOOKMARKS_PER_PET);
  if (error) throw new Error(`Failed to load bookmarks: ${error.message}`);
  return (data ?? []) as Bookmark[];
}

/**
 * Insert a bookmark. Throws BookmarksFullError if pet has already hit cap.
 * Returns the new row.
 */
export async function addBookmark(petId: string, productId: string): Promise<Bookmark> {
  await requireOnline();
  const userId = await getActiveUserId();

  const { count } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId);

  if ((count ?? 0) >= MAX_BOOKMARKS_PER_PET) throw new BookmarksFullError();

  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, pet_id: petId, product_id: productId })
    .select()
    .single();

  if (error) throw new Error(`Failed to add bookmark: ${error.message}`);
  return data as Bookmark;
}

/**
 * Delete by (petId, productId). Idempotent — no error if row missing.
 */
export async function removeBookmark(petId: string, productId: string): Promise<void> {
  await requireOnline();
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('pet_id', petId)
    .eq('product_id', productId);
  if (error) throw new Error(`Failed to remove bookmark: ${error.message}`);
}

/**
 * Toggle: delete if exists, otherwise add. Returns the new state (true = now bookmarked).
 */
export async function toggleBookmark(petId: string, productId: string): Promise<boolean> {
  const currently = await isBookmarked(petId, productId);
  if (currently) {
    await removeBookmark(petId, productId);
    return false;
  }
  await addBookmark(petId, productId);
  return true;
}

/**
 * Hydrated bookmark list — bookmarks joined with product data + live scores.
 * Uses PostgREST nested select for the product join (single round-trip).
 * If any bookmark lacks a cached score, fires `batchScoreHybrid` in the background
 * to hydrate the cache for next render (fire-and-forget).
 */
export async function fetchBookmarkCards(pet: Pet): Promise<BookmarkCardData[]> {
  if (!(await isOnline())) return [];

  const { data, error } = await supabase
    .from('bookmarks')
    .select(
      '*, product:products(id, brand, name, image_url, is_recalled, is_vet_diet, is_variety_pack, is_supplemental, target_species)',
    )
    .eq('pet_id', pet.id)
    .order('created_at', { ascending: false })
    .limit(MAX_BOOKMARKS_PER_PET);

  if (error) throw new Error(`Failed to load bookmark cards: ${error.message}`);
  const rows = (data ?? []) as Array<Bookmark & { product: BookmarkCardData['product'] | null }>;
  const withProduct = rows.filter((r): r is Bookmark & { product: BookmarkCardData['product'] } => r.product !== null);

  const productIds = withProduct.map((r) => r.product.id);
  if (productIds.length === 0) return [];

  const { data: scoreRows } = await supabase
    .from('pet_product_scores')
    .select('product_id, final_score')
    .eq('pet_id', pet.id)
    .in('product_id', productIds);

  const scoreMap = new Map<string, number>(
    (scoreRows ?? []).map((s: { product_id: string; final_score: number }) => [s.product_id, s.final_score]),
  );

  const cards: BookmarkCardData[] = withProduct.map((r) => ({
    bookmark: {
      id: r.id,
      user_id: r.user_id,
      pet_id: r.pet_id,
      product_id: r.product.id,
      created_at: r.created_at,
    },
    product: r.product,
    final_score: scoreMap.get(r.product.id) ?? null,
  }));

  // JIT cache hydration: fire-and-forget if any card is unscored.
  if (cards.some((c) => c.final_score === null)) {
    void batchScoreHybrid(pet.id, pet).catch((err) => {
      console.warn('[fetchBookmarkCards] JIT batchScoreHybrid failed:', err);
    });
  }

  return cards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --testPathPattern=bookmarkService
```

Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/bookmarkService.ts __tests__/services/bookmarkService.test.ts
git commit -m "M9: bookmarkService with 20-cap + offline guards"
```

---

## Task 3: `useBookmarkStore` (Zustand)

**Files:**
- Create: `src/stores/useBookmarkStore.ts`
- Test: `__tests__/stores/useBookmarkStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/stores/useBookmarkStore.test.ts`:

```typescript
// useBookmarkStore Tests — optimistic toggle + rollback on error + pet-switch refetch.

jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/services/bookmarkService', () => ({
  getBookmarksForPet: jest.fn(),
  toggleBookmark: jest.fn(),
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
}));

import { useBookmarkStore } from '../../src/stores/useBookmarkStore';
import * as bookmarkService from '../../src/services/bookmarkService';
import { BookmarksFullError } from '../../src/types/bookmark';

beforeEach(() => {
  jest.clearAllMocks();
  useBookmarkStore.setState({ bookmarks: [], isLoading: false, currentPetId: null });
});

describe('loadForPet', () => {
  test('fetches and sets bookmarks for a pet', async () => {
    (bookmarkService.getBookmarksForPet as jest.Mock).mockResolvedValue([
      { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
    ]);

    await useBookmarkStore.getState().loadForPet('p1');

    expect(useBookmarkStore.getState().bookmarks.length).toBe(1);
    expect(useBookmarkStore.getState().currentPetId).toBe('p1');
  });

  test('clears bookmarks when petId is null', async () => {
    useBookmarkStore.setState({ bookmarks: [{ id: 'b1' } as any] });
    await useBookmarkStore.getState().loadForPet(null);
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});

describe('toggle', () => {
  test('adds bookmark optimistically and confirms on service success', async () => {
    (bookmarkService.toggleBookmark as jest.Mock).mockResolvedValue(true);
    useBookmarkStore.setState({ currentPetId: 'p1', bookmarks: [] });

    const result = await useBookmarkStore.getState().toggle('p1', 'prod-1');

    expect(result).toBe(true);
    expect(bookmarkService.toggleBookmark).toHaveBeenCalledWith('p1', 'prod-1');
  });

  test('rolls back optimistic add on BookmarksFullError', async () => {
    (bookmarkService.toggleBookmark as jest.Mock).mockRejectedValue(new BookmarksFullError());
    useBookmarkStore.setState({ currentPetId: 'p1', bookmarks: [] });

    await expect(
      useBookmarkStore.getState().toggle('p1', 'prod-1'),
    ).rejects.toBeInstanceOf(BookmarksFullError);

    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });
});

describe('isBookmarked', () => {
  test('returns true when product is in store for current pet', () => {
    useBookmarkStore.setState({
      currentPetId: 'p1',
      bookmarks: [
        { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
      ],
    });
    expect(useBookmarkStore.getState().isBookmarked('p1', 'prod-1')).toBe(true);
  });

  test('returns false when petId mismatch', () => {
    useBookmarkStore.setState({
      currentPetId: 'p1',
      bookmarks: [
        { id: 'b1', user_id: 'u1', pet_id: 'p1', product_id: 'prod-1', created_at: 'now' },
      ],
    });
    expect(useBookmarkStore.getState().isBookmarked('p2', 'prod-1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern=useBookmarkStore
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `src/stores/useBookmarkStore.ts`**

```typescript
// useBookmarkStore — per-pet bookmark list + optimistic toggle.
// Mirrors usePantryStore pattern (optimistic update + rollback on error).

import { create } from 'zustand';
import { type Bookmark, MAX_BOOKMARKS_PER_PET, BookmarksFullError } from '../types/bookmark';
import {
  addBookmark as svcAdd,
  removeBookmark as svcRemove,
  getBookmarksForPet as svcLoad,
  toggleBookmark as svcToggle,
} from '../services/bookmarkService';

interface BookmarkState {
  bookmarks: Bookmark[];
  currentPetId: string | null;
  isLoading: boolean;
  loadForPet: (petId: string | null) => Promise<void>;
  toggle: (petId: string, productId: string) => Promise<boolean>;
  isBookmarked: (petId: string, productId: string) => boolean;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  currentPetId: null,
  isLoading: false,

  loadForPet: async (petId) => {
    if (!petId) {
      set({ bookmarks: [], currentPetId: null });
      return;
    }
    set({ isLoading: true, currentPetId: petId });
    try {
      const rows = await svcLoad(petId);
      set({ bookmarks: rows, isLoading: false });
    } catch {
      set({ bookmarks: [], isLoading: false });
    }
  },

  toggle: async (petId, productId) => {
    const existing = get().bookmarks.find(
      (b) => b.pet_id === petId && b.product_id === productId,
    );

    // A-1: synchronous cap check before any optimistic mutation.
    // Prevents a one-frame flash of a 21st row before server rejection.
    if (!existing && get().bookmarks.length >= MAX_BOOKMARKS_PER_PET) {
      throw new BookmarksFullError();
    }

    const optimisticBookmarks = existing
      ? get().bookmarks.filter((b) => b.id !== existing.id)
      : [
          ...get().bookmarks,
          {
            id: `__optimistic_${Date.now()}`,
            user_id: '',
            pet_id: petId,
            product_id: productId,
            created_at: new Date().toISOString(),
          } as Bookmark,
        ];
    set({ bookmarks: optimisticBookmarks });

    try {
      const newState = await svcToggle(petId, productId);
      await get().loadForPet(petId);
      return newState;
    } catch (err) {
      // A-2: resync from server rather than manual re-insert.
      // Avoids breaking the DESC-by-created_at order on rollback.
      await get().loadForPet(petId);
      throw err;
    }
  },

  isBookmarked: (petId, productId) => {
    const state = get();
    if (state.currentPetId !== petId) return false;
    return state.bookmarks.some(
      (b) => b.pet_id === petId && b.product_id === productId,
    );
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --testPathPattern=useBookmarkStore
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useBookmarkStore.ts __tests__/stores/useBookmarkStore.test.ts
git commit -m "M9: useBookmarkStore with optimistic toggle"
```

---

## Task 4: `ResultHeaderMenu` component

**Files:**
- Create: `src/components/result/ResultHeaderMenu.tsx`
- Test: `__tests__/components/result/ResultHeaderMenu.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `__tests__/components/result/ResultHeaderMenu.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ResultHeaderMenu } from '../../../src/components/result/ResultHeaderMenu';

describe('ResultHeaderMenu', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onShare: jest.fn(),
    onReportIssue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Share and Report issue items', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    expect(getByText('Share')).toBeTruthy();
    expect(getByText('Report issue')).toBeTruthy();
  });

  test('fires onShare and closes on tap', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    fireEvent.press(getByText('Share'));
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('fires onReportIssue and closes on tap', () => {
    const { getByText } = render(<ResultHeaderMenu {...baseProps} />);
    fireEvent.press(getByText('Report issue'));
    expect(baseProps.onReportIssue).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern=ResultHeaderMenu
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `src/components/result/ResultHeaderMenu.tsx`**

```typescript
// Overflow menu for ResultScreen header. Bookmark lives in its own header icon
// (visible state); this sheet hosts the secondary actions: Share + Report issue.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onReportIssue: () => void;
}

export function ResultHeaderMenu({
  visible,
  onClose,
  onShare,
  onReportIssue,
}: Props) {
  const handle = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <MenuItem
            icon="share-outline"
            label="Share"
            onPress={handle(onShare)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="flag-outline"
            label="Report issue"
            onPress={handle(onReportIssue)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={Colors.primary} />
      <Text style={styles.itemLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  itemLabel: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hairlineBorder,
    marginHorizontal: Spacing.lg,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --testPathPattern=ResultHeaderMenu
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/result/ResultHeaderMenu.tsx __tests__/components/result/ResultHeaderMenu.test.tsx
git commit -m "M9: ResultHeaderMenu overflow sheet"
```

---

## Task 5: Wire the header — bookmark icon + ellipsis menu into `ResultScreen`

**Files:**
- Modify: `src/screens/ResultScreen.tsx` — replace the single share icon at lines ~488–496 with two icons (bookmark + ellipsis); add state, handlers, and render the `ResultHeaderMenu`

- [ ] **Step 1: Read the current share button block**

Open `src/screens/ResultScreen.tsx`. Find the share TouchableOpacity (around line 488–496). The surrounding code uses `shareCardRef`, `displayName`, `score`, and `captureAndShare` from `../utils/shareCard`. Also `captureAndShare` takes `(ref, name, score)`.

- [ ] **Step 2: Add imports + state + handlers**

Near the top of the file (with the other React imports), add:

```typescript
import { Alert, Linking } from 'react-native';
```
(Only the new symbols — check existing imports to avoid duplicates.)

Add imports:

```typescript
import { ResultHeaderMenu } from '../components/result/ResultHeaderMenu';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { BookmarksFullError } from '../types/bookmark';
```

Inside the `ResultScreen` component body, near the other `useState`/`useRef` declarations (alongside `shareCardRef`):

```typescript
const [menuVisible, setMenuVisible] = useState(false);
const isBookmarked = useBookmarkStore((s) =>
  petId ? s.isBookmarked(petId, productId) : false,
);
const toggleBookmark = useBookmarkStore((s) => s.toggle);

const handleToggleBookmark = async () => {
  if (!petId) {
    Alert.alert('Select a pet', 'Choose an active pet before bookmarking.');
    return;
  }
  try {
    await toggleBookmark(petId, productId);
  } catch (err) {
    if (err instanceof BookmarksFullError) {
      Alert.alert('Bookmarks full', 'Remove one to save another.');
    } else {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    }
  }
};

const handleShare = () => {
  captureAndShare(shareCardRef, displayName, score);
};

const handleReportIssue = async () => {
  const subject = encodeURIComponent(`Report issue — ${product?.brand ?? ''} ${product?.name ?? ''}`.trim());
  const body = encodeURIComponent(
    `Product: ${productId}\nPet: ${petId ?? '(none)'}\nPlatform: ${Platform.OS} ${Platform.Version}\n\nDescribe the issue:\n`,
  );
  const url = `mailto:support@kibascan.com?subject=${subject}&body=${body}`;
  const ok = await Linking.canOpenURL(url);
  if (ok) {
    await Linking.openURL(url);
  } else {
    Alert.alert(
      'No email client configured',
      'Email support@kibascan.com directly with the product name and what went wrong.',
    );
  }
};
```

Also add `Platform` to the `react-native` import at the top of the file:

```typescript
import { Alert, Linking, Platform } from 'react-native';
```

- [ ] **Step 3: Replace the single share TouchableOpacity with a two-icon header group**

At the current share-button location (around lines 488–496), replace the block:

```tsx
<TouchableOpacity
  onPress={() => captureAndShare(shareCardRef, displayName, score)}
  style={styles.shareButton}
  accessibilityRole="button"
  accessibilityLabel="Share"
>
  <Ionicons name="share-outline" size={22} color={Colors.textSecondary} />
</TouchableOpacity>
```

with a wrapping `View` that renders both icons:

```tsx
<View style={styles.headerActions}>
  <TouchableOpacity
    onPress={handleToggleBookmark}
    style={styles.headerIconButton}
    accessibilityRole="button"
    accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
  >
    <Ionicons
      name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
      size={22}
      color={isBookmarked ? Colors.primary : Colors.textSecondary}
    />
  </TouchableOpacity>
  <TouchableOpacity
    onPress={() => setMenuVisible(true)}
    style={styles.headerIconButton}
    accessibilityRole="button"
    accessibilityLabel="More actions"
  >
    <Ionicons name="ellipsis-horizontal-circle" size={22} color={Colors.textSecondary} />
  </TouchableOpacity>
</View>
```

Add styles to the StyleSheet at the bottom of the file:

```typescript
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.sm,
},
headerIconButton: {
  padding: Spacing.xs,
},
```

(If `styles.shareButton` was referenced elsewhere, update those references. The original single-button style is effectively replaced by `headerActions + headerIconButton`.)

- [ ] **Step 4: Render the `ResultHeaderMenu`**

At the end of the screen's JSX (alongside the off-screen PetShareCard block around line 1029), add:

```tsx
<ResultHeaderMenu
  visible={menuVisible}
  onClose={() => setMenuVisible(false)}
  onShare={handleShare}
  onReportIssue={handleReportIssue}
/>
```

Note: Bookmark is NOT in this menu — it has its own header icon (Step 3). The overflow now hosts only the secondary actions (Share, Report issue).

- [ ] **Step 5: Run tests + typecheck**

```bash
npx jest
npx tsc --noEmit
```

Expected: all tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ResultScreen.tsx
git commit -m "M9: ResultScreen header bookmark icon + overflow menu (Share/Report)"
```

---

## Task 6: HomeScreen Bookmarks section

**Files:**
- Modify: `src/screens/HomeScreen.tsx` — insert new Bookmarks block between lines 617 (end of Pantry row) and 620 (Recent Scans)

- [ ] **Step 1: Add store subscription**

Near the top of `HomeScreen.tsx` imports, add:

```typescript
import { useBookmarkStore } from '../stores/useBookmarkStore';
```

Inside the `HomeScreen` component (alongside existing `useActivePetStore` reads around line 99), add:

```typescript
const bookmarks = useBookmarkStore((s) => s.bookmarks);
const loadBookmarks = useBookmarkStore((s) => s.loadForPet);
```

Add a `useEffect` to load bookmarks on active-pet change (near existing `useFocusEffect` / data-load hooks):

```typescript
useEffect(() => {
  loadBookmarks(activePetId);
}, [activePetId, loadBookmarks]);
```

- [ ] **Step 2: Fetch bookmark cards via the service**

Add alongside the existing data-load hooks:

```typescript
const [bookmarkCards, setBookmarkCards] = useState<BookmarkCardData[]>([]);

useEffect(() => {
  if (!activePet) {
    setBookmarkCards([]);
    return;
  }
  void fetchBookmarkCards(activePet).then((cards) => setBookmarkCards(cards.slice(0, 3)));
}, [activePet, bookmarks]);
```

Add imports at the top of `HomeScreen.tsx`:

```typescript
import { fetchBookmarkCards } from '../services/bookmarkService';
import type { BookmarkCardData } from '../types/bookmark';
```

Note: reruns whenever `bookmarks` store slice changes (add/remove propagates automatically).

- [ ] **Step 3: Insert the Bookmarks section JSX**

Between line 617 (end of Pantry row's closing `</TouchableOpacity>` and the blank line) and line 619 (the `{/* 7. Recent Scans */}` comment), insert:

```tsx
{/* 6.5 Bookmarks (hidden when empty) */}
{bookmarkCards.length > 0 && activePet && (
  <View style={styles.bookmarksSection}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.recentScansTitle}>Bookmarks</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Bookmarks')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="See all bookmarks"
      >
        <Text style={styles.seeAllLink}>See all ›</Text>
      </TouchableOpacity>
    </View>
    {bookmarkCards.map((card) => {
      const scoreColor =
        card.final_score != null
          ? getScoreColor(card.final_score, card.product.is_supplemental)
          : null;
      return (
        <TouchableOpacity
          key={card.bookmark.id}
          style={[styles.scanRow, card.product.is_recalled && styles.rowRecalled]}
          onPress={() => {
            if (card.product.is_recalled) {
              navigation.navigate('RecallDetail', { productId: card.product.id });
            } else {
              navigation.navigate('Result', {
                productId: card.product.id,
                petId: activePetId,
              });
            }
          }}
          activeOpacity={0.7}
          accessibilityLabel={
            card.final_score != null && activePet
              ? `${card.final_score}% match for ${activePet.name}`
              : undefined
          }
        >
          {card.product.image_url ? (
            <Image source={{ uri: card.product.image_url }} style={styles.scanRowImage} />
          ) : (
            <View style={styles.scanRowImagePlaceholder}>
              <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
            </View>
          )}
          <View style={styles.scanRowInfo}>
            <Text style={styles.scanRowBrand} numberOfLines={1}>
              {sanitizeBrand(card.product.brand)}
            </Text>
            <Text style={styles.scanRowName} numberOfLines={2}>
              {stripBrandFromName(card.product.brand, card.product.name)}
            </Text>
          </View>
          {scoreColor ? (
            <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
              <Text style={[styles.scorePillText, { color: scoreColor }]}>
                {card.final_score}%
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          )}
        </TouchableOpacity>
      );
    })}
  </View>
)}
```

- [ ] **Step 4: Add new styles to the HomeScreen StyleSheet**

At the bottom of the file's `StyleSheet.create({ ... })` block, add:

```typescript
bookmarksSection: {
  marginTop: Spacing.lg,
  marginBottom: Spacing.sm,
},
sectionHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: Spacing.sm,
},
seeAllLink: {
  color: Colors.primary,
  fontSize: 15,
  fontWeight: '500',
},
rowRecalled: {
  borderLeftWidth: 3,
  borderLeftColor: Colors.danger,
  paddingLeft: Spacing.md - 3,
},
```

(Reuses the `cardRecalled` visual pattern from `PantryCard.tsx:473` — red left border. Verify `Colors.danger` exists in `src/utils/constants.ts`; fall back to whatever color `PantryCard.cardRecalled` reads on if absent.)

- [ ] **Step 5: Typecheck + test**

```bash
npx tsc --noEmit
npx jest
```

Expected: no type errors; tests unchanged pass (navigation route is missing — see Task 11; that's expected TS fail for now, so defer typecheck until Task 11).

**If typecheck fails on `navigation.navigate('Bookmarks')`, that's expected** — Task 11 adds the route. Proceed.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "M9: HomeScreen Bookmarks section (hidden when empty)"
```

---

## Task 7: HomeScreen Recent Scans `See all` link

**Files:**
- Modify: `src/screens/HomeScreen.tsx` — lines 619–638 (Recent Scans section header)

- [ ] **Step 1: Replace the `recentScansHeader` block with a stacked layout**

Current (lines 622–638):

```tsx
<View style={styles.recentScansHeader}>
  <Text style={styles.recentScansTitle}>Recent Scans</Text>
  {!premium && scanWindowInfo ? (
    <View style={styles.scanCounterRow}>
      <View style={[styles.scanCounterPill, { backgroundColor: `${scanCounterColor}20` }]}>
        <Text style={[styles.scanCounterText, { color: scanCounterColor }]}>
          {scanWindowInfo.count}/{Limits.freeScansPerWeek} this week
        </Text>
      </View>
      <InfoTooltip text={scanTooltipText} size={14} />
    </View>
  ) : (
    <Text style={styles.recentScansWeekly}>
      {weeklyCount} this week
    </Text>
  )}
</View>
```

Replace with:

```tsx
<View style={styles.recentScansHeader}>
  <Text style={styles.recentScansTitle}>Recent Scans</Text>
  <View style={styles.recentScansHeaderRight}>
    {!premium && scanWindowInfo ? (
      <View style={styles.scanCounterRow}>
        <View style={[styles.scanCounterPill, { backgroundColor: `${scanCounterColor}20` }]}>
          <Text style={[styles.scanCounterText, { color: scanCounterColor }]}>
            {scanWindowInfo.count}/{Limits.freeScansPerWeek} this week
          </Text>
        </View>
        <InfoTooltip text={scanTooltipText} size={14} />
      </View>
    ) : (
      <Text style={styles.recentScansWeekly}>{weeklyCount} this week</Text>
    )}
    <TouchableOpacity
      onPress={() => navigation.navigate('ScanHistory')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="See all recent scans"
    >
      <Text style={styles.seeAllLink}>See all ›</Text>
    </TouchableOpacity>
  </View>
</View>
```

- [ ] **Step 2: Add the `recentScansHeaderRight` style**

In the StyleSheet block, add:

```typescript
recentScansHeaderRight: {
  alignItems: 'flex-end',
  gap: 4,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "M9: HomeScreen Recent Scans See-all link"
```

---

## Task 8: Long-press entry point on scan rows

**Files:**
- Modify: `src/screens/HomeScreen.tsx` — scan row `TouchableOpacity` at lines 646–703
- Modify: `src/screens/HomeScreen.tsx` — add local `LongPressMenu` state reusing `ResultHeaderMenu`

- [ ] **Step 1: Add state + handlers for long-press menu**

Inside `HomeScreen` component body, add:

```typescript
const [longPressTarget, setLongPressTarget] = useState<{ productId: string } | null>(null);

const longPressIsBookmarked = useBookmarkStore((s) =>
  longPressTarget && activePetId ? s.isBookmarked(activePetId, longPressTarget.productId) : false,
);

const longPressToggle = useBookmarkStore((s) => s.toggle);

const handleLongPressToggle = async () => {
  if (!activePetId || !longPressTarget) return;
  try {
    await longPressToggle(activePetId, longPressTarget.productId);
  } catch (err) {
    if (err instanceof BookmarksFullError) {
      Alert.alert('Bookmarks full', 'Remove one to save another.');
    }
  }
};
```

Add imports at the top (with existing imports):

```typescript
import { Alert } from 'react-native';
import { BookmarksFullError } from '../types/bookmark';
import { ResultHeaderMenu } from '../components/result/ResultHeaderMenu';
import * as Haptics from 'expo-haptics';
```

- [ ] **Step 2: Add `onLongPress` to each scan row TouchableOpacity**

In the scan row `<TouchableOpacity>` (line 646), add these props:

```tsx
onLongPress={() => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  setLongPressTarget({ productId: scan.product_id });
}}
delayLongPress={400}
```

- [ ] **Step 3: Create a tight long-press sheet**

Create `src/components/common/BookmarkToggleSheet.tsx` (long-press only shows Bookmark/Unbookmark — keep the 3-item ResultHeaderMenu for ResultScreen where Share and Report issue also belong):

```typescript
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../utils/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  isBookmarked: boolean;
  onToggle: () => void;
}

export function BookmarkToggleSheet({ visible, onClose, isBookmarked, onToggle }: Props) {
  const handle = () => {
    onToggle();
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.item} onPress={handle}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={Colors.primary}
            />
            <Text style={styles.label}>{isBookmarked ? 'Unbookmark' : 'Bookmark'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '500',
  },
});
```

At the end of HomeScreen's JSX (near the ScrollView close), add:

```tsx
{longPressTarget && (
  <BookmarkToggleSheet
    visible={longPressTarget !== null}
    onClose={() => setLongPressTarget(null)}
    isBookmarked={longPressIsBookmarked}
    onToggle={handleLongPressToggle}
  />
)}
```

Add import at the top of HomeScreen:

```typescript
import { BookmarkToggleSheet } from '../components/common/BookmarkToggleSheet';
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: only the `navigation.navigate('Bookmarks' | 'ScanHistory')` errors remain (Task 11 resolves).

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx src/components/common/BookmarkToggleSheet.tsx
git commit -m "M9: long-press scan row to toggle bookmark"
```

---

## Task 9: `BookmarksScreen`

**Files:**
- Create: `src/screens/BookmarksScreen.tsx`

- [ ] **Step 1: Create the screen**

```typescript
// BookmarksScreen — dedicated list of up to 20 per-pet bookmarks.
// Row style mirrors HomeScreen's inline scan rows; delete via SwipeableRow.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing } from '../utils/constants';
import type { HomeStackParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { fetchBookmarkCards, removeBookmark } from '../services/bookmarkService';
import { getScoreColor } from '../utils/constants';
import { sanitizeBrand, stripBrandFromName } from '../utils/productName';
import SwipeableRow from '../components/ui/SwipeableRow';
import type { BookmarkCardData } from '../types/bookmark';
import { MAX_BOOKMARKS_PER_PET } from '../types/bookmark';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../types/navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Bookmarks'>,
  BottomTabNavigationProp<TabParamList>
>;

export default function BookmarksScreen() {
  const navigation = useNavigation<Nav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loadForPet = useBookmarkStore((s) => s.loadForPet);
  const [cards, setCards] = useState<BookmarkCardData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!activePet) return;
    setRefreshing(true);
    await loadForPet(activePet.id);
    const next = await fetchBookmarkCards(activePet);
    setCards(next);
    setRefreshing(false);
  }, [activePet, loadForPet]);

  useEffect(() => {
    if (!activePet) {
      setCards([]);
      return;
    }
    void fetchBookmarkCards(activePet).then(setCards);
  }, [activePet, bookmarks]);

  const handleDelete = async (productId: string) => {
    if (!activePetId) return;
    try {
      await removeBookmark(activePetId, productId);
      await loadForPet(activePetId);
    } catch (err) {
      Alert.alert('Could not remove', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (!activePet) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Select a pet to see bookmarks</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookmarks</Text>
        <Text style={styles.subtitle}>
          {activePet.name} · {cards.length}/{MAX_BOOKMARKS_PER_PET}
        </Text>
      </View>
      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="bookmark-outline"
            size={48}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the menu on any product page, or long-press a recent scan.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a product"
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.background} />
            <Text style={styles.ctaLabel}>Scan a product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.bookmark.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <SwipeableRow
              onDelete={() => handleDelete(item.product.id)}
              deleteConfirmMessage={`Remove ${item.product.brand} ${item.product.name} from bookmarks?`}
              deleteLabel="Remove"
            >
              <BookmarkRow card={item} petName={activePet.name} petId={activePetId!} navigation={navigation} />
            </SwipeableRow>
          )}
        />
      )}
    </View>
  );
}

function BookmarkRow({
  card,
  petName,
  petId,
  navigation,
}: {
  card: BookmarkCardData;
  petName: string;
  petId: string;
  navigation: Nav;
}) {
  const scoreColor =
    card.final_score != null ? getScoreColor(card.final_score, card.product.is_supplemental) : null;
  return (
    <TouchableOpacity
      style={[styles.row, card.product.is_recalled && styles.rowRecalled]}
      onPress={() => {
        if (card.product.is_recalled) {
          navigation.navigate('RecallDetail', { productId: card.product.id });
        } else {
          navigation.navigate('Result', { productId: card.product.id, petId });
        }
      }}
      activeOpacity={0.7}
      accessibilityLabel={
        card.final_score != null ? `${card.final_score}% match for ${petName}` : undefined
      }
    >
      {card.product.image_url ? (
        <Image source={{ uri: card.product.image_url }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {sanitizeBrand(card.product.brand)}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {stripBrandFromName(card.product.brand, card.product.name)}
        </Text>
      </View>
      {scoreColor ? (
        <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
          <Text style={[styles.pillText, { color: scoreColor }]}>{card.final_score}%</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    paddingLeft: Spacing.lg - 3,
  },
  image: { width: 40, height: 40, borderRadius: 8 },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  brand: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.lg,
  },
  ctaLabel: { color: Colors.background, fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/BookmarksScreen.tsx
git commit -m "M9: BookmarksScreen with swipe-delete and pull-to-refresh"
```

---

## Task 10: `ScanHistoryScreen`

**Files:**
- Create: `src/screens/ScanHistoryScreen.tsx`

- [ ] **Step 1: Create the screen**

```typescript
// ScanHistoryScreen — up to 20 deduped recent scans per pet. Immutable (no delete).
// Long-press row → BookmarkToggleSheet.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, getScoreColor } from '../utils/constants';
import type { HomeStackParamList } from '../types/navigation';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { getRecentScans } from '../services/scanHistoryService';
import { sanitizeBrand, stripBrandFromName } from '../utils/productName';
import { BookmarkToggleSheet } from '../components/common/BookmarkToggleSheet';
import { BookmarksFullError } from '../types/bookmark';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../types/navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'ScanHistory'>,
  BottomTabNavigationProp<TabParamList>
>;

type ScanRow = Awaited<ReturnType<typeof getRecentScans>>[number];

export default function ScanHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [longPressTarget, setLongPressTarget] = useState<{ productId: string } | null>(null);

  const toggle = useBookmarkStore((s) => s.toggle);
  const isBookmarked = useBookmarkStore((s) =>
    longPressTarget && activePetId ? s.isBookmarked(activePetId, longPressTarget.productId) : false,
  );

  const refresh = useCallback(async () => {
    if (!activePetId) return;
    setRefreshing(true);
    const rows = await getRecentScans(activePetId, 20);
    setScans(rows);
    setRefreshing(false);
  }, [activePetId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLongPressToggle = async () => {
    if (!activePetId || !longPressTarget) return;
    try {
      await toggle(activePetId, longPressTarget.productId);
    } catch (err) {
      if (err instanceof BookmarksFullError) {
        Alert.alert('Bookmarks full', 'Remove one to save another.');
      }
    }
  };

  if (!activePet) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Select a pet to see history</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Scans</Text>
        <Text style={styles.subtitle}>
          {activePet.name} · {scans.length} recent
        </Text>
      </View>
      {scans.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="barcode-outline"
            size={48}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySubtitle}>Your scan history appears here.</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Scan')}
            accessibilityRole="button"
            accessibilityLabel="Scan a product"
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.background} />
            <Text style={styles.ctaLabel}>Scan a product</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const scoreColor =
              item.final_score != null
                ? getScoreColor(item.final_score, item.product.is_supplemental)
                : null;
            return (
              <TouchableOpacity
                style={[styles.row, item.product.is_recalled && styles.rowRecalled]}
                onPress={() => {
                  if (item.product.is_recalled) {
                    navigation.navigate('RecallDetail', { productId: item.product_id });
                  } else {
                    navigation.navigate('Result', { productId: item.product_id, petId: activePetId });
                  }
                }}
                onLongPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setLongPressTarget({ productId: item.product_id });
                }}
                delayLongPress={400}
                activeOpacity={0.7}
                accessibilityLabel={
                  item.final_score != null ? `${item.final_score}% match for ${activePet.name}` : undefined
                }
              >
                {item.product.image_url ? (
                  <Image source={{ uri: item.product.image_url }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.brand} numberOfLines={1}>
                    {sanitizeBrand(item.product.brand)}
                  </Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {stripBrandFromName(item.product.brand, item.product.name)}
                  </Text>
                </View>
                {scoreColor ? (
                  <View style={[styles.pill, { backgroundColor: `${scoreColor}1A` }]}>
                    <Text style={[styles.pillText, { color: scoreColor }]}>{item.final_score}%</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
      {longPressTarget && (
        <BookmarkToggleSheet
          visible={longPressTarget !== null}
          onClose={() => setLongPressTarget(null)}
          isBookmarked={isBookmarked}
          onToggle={handleLongPressToggle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: Spacing.sm },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    paddingLeft: Spacing.lg - 3,
  },
  image: { width: 40, height: 40, borderRadius: 8 },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  brand: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.lg,
  },
  ctaLabel: { color: Colors.background, fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ScanHistoryScreen.tsx
git commit -m "M9: ScanHistoryScreen with long-press bookmark"
```

---

## Task 11: Navigation registration

**Files:**
- Modify: `src/types/navigation.ts` — line 25 (HomeStackParamList)
- Modify: `src/navigation/index.tsx` — lines 60–72 (HomeStack.Navigator)

- [ ] **Step 1: Add routes to `HomeStackParamList`**

In `src/types/navigation.ts`, update `HomeStackParamList` (line 25):

```typescript
export type HomeStackParamList = {
  HomeMain: undefined;
  CategoryBrowse: { category: import('./categoryBrowse').BrowseCategory; petId: string; subFilter?: string };
  CategoryTopPicks: { category: import('./categoryBrowse').BrowseCategory; petId: string; subFilter?: string };
  Result: { productId: string; petId: string | null; pantryItemIdHint?: string };
  RecallDetail: { productId: string };
  AppointmentDetail: { appointmentId: string };
  Compare: { productAId: string; productBId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
  Bookmarks: undefined;
  ScanHistory: undefined;
};
```

- [ ] **Step 2: Register screens in the navigator**

In `src/navigation/index.tsx`, add screen imports near the existing ones:

```typescript
import BookmarksScreen from '../screens/BookmarksScreen';
import ScanHistoryScreen from '../screens/ScanHistoryScreen';
```

Inside `HomeStack.Navigator` (line 63), append the two new screens before `</HomeStack.Navigator>`:

```tsx
<HomeStack.Screen name="Bookmarks" component={BookmarksScreen} />
<HomeStack.Screen name="ScanHistory" component={ScanHistoryScreen} />
```

- [ ] **Step 3: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest
```

Expected: no type errors; all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/types/navigation.ts src/navigation/index.tsx
git commit -m "M9: register Bookmarks + ScanHistory routes in HomeStack"
```

---

## Task 12: DECISIONS.md + status docs

**Files:**
- Modify: `DECISIONS.md` — append new decision D-169
- Modify: `CLAUDE.md` — add bookmarks entry to Schema Traps
- Modify: `docs/status/CURRENT.md` — bump numbers
- Modify: `ROADMAP.md` — add completed M9 item

- [ ] **Step 1: Add D-169 to DECISIONS.md**

Append to `DECISIONS.md` (after D-168), update the header count, and add a supersession note:

```markdown

### D-169: Bookmarks — Per-Pet Watchlist
**Status:** LOCKED
**Date:** April 17, 2026
**Milestone:** M9
**Decision:** Add a per-pet `bookmarks` table (migration 040) with `UNIQUE(pet_id, product_id)` and a hard client-side cap of 20 bookmarks per pet. No paywall gate; bookmarks are free. Scores displayed on bookmark rows are *live* reads from `pet_product_scores`, not snapshots at save time. Scan history is expanded to 20 on a dedicated `ScanHistoryScreen` but scans remain immutable (no delete). Entry points: overflow menu on ResultScreen (ellipsis icon replaces share) and long-press on any scan row. `mailto:support@kibascan.com` is the MVP Report-issue destination.

**Rationale:**
- **Per-pet scoping** matches every other list in the app (scans, pantry, top picks). User-scoped bookmarks would require awkward score-display decisions when the score shifts on pet switch.
- **Hard cap vs. paywall** preserves the free-tier ethos (pantry, recalls, scan rate limit are the only gates). 20 is generous enough that most users never hit it.
- **Live score, not snapshot** reflects the current pet's profile accurately. A saved 97% that no longer fits after a life-stage change would mislead; the live score is honest.
- **mailto: for Report issue** ships today with zero new UI and gives us direct signal for the first N reports; a dedicated pipeline can replace it post-launch.

**Out of scope (may revisit):** cross-pet sharing of bookmarks, filter/sort on dedicated screens, scan deletion, premium bump above 20.

**Files:** `supabase/migrations/040_bookmarks.sql`, `src/types/bookmark.ts`, `src/services/bookmarkService.ts`, `src/stores/useBookmarkStore.ts`, `src/screens/{Bookmarks,ScanHistory}Screen.tsx`, `src/components/result/ResultHeaderMenu.tsx`, `src/components/common/BookmarkToggleSheet.tsx`.
```

Update the header line (around line 4) count from `130 decisions, D-001 through D-168` to `131 decisions, D-001 through D-169`, and append `D-169: Bookmarks feature — per-pet, 20 cap, no paywall.` to the decision summary.

- [ ] **Step 2: Update CLAUDE.md Schema Traps**

In the `## Schema Traps` section of `CLAUDE.md`, add a new bullet near the pantry entries:

```markdown
- `bookmarks` — per-pet watchlist, UNIQUE(pet_id, product_id), 20-item client cap, RLS via user_id. Live score from `pet_product_scores` cache. Migration 040 (D-169).
```

- [ ] **Step 3: Update `docs/status/CURRENT.md`**

Update the `## Numbers` block:

```markdown
- **Tests:** <NEW_TEST_COUNT> passing / <NEW_SUITE_COUNT> suites
- **Decisions:** 131
- **Migrations:** 40 (001–040)
- **Products:** 19,058 (483 vet diets, 1716 supplemental-flagged)
```

Replace `<NEW_TEST_COUNT>` and `<NEW_SUITE_COUNT>` with actual values from `npx jest` output. Update the session log stub at the bottom.

- [ ] **Step 4: Update ROADMAP.md M9 list**

In `ROADMAP.md`, under `## M9: UI Polish & Search (In Progress)`, add the completed item:

```markdown
- [x] **Bookmarks + expanded history** — per-pet bookmarks (migration 040, cap 20), dedicated `BookmarksScreen` + `ScanHistoryScreen`, ResultScreen overflow menu (Bookmark / Share / Report issue via `mailto:`), long-press entry on scan rows. D-169.
```

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md CLAUDE.md docs/status/CURRENT.md ROADMAP.md
git commit -m "M9: D-169 bookmarks decision + doc updates"
```

---

## Task 13: Verification and PR

- [ ] **Step 1: Run full test suite**

```bash
npx jest
```

Expected: all suites pass. Record new test/suite counts.

- [ ] **Step 2: Run regression anchors**

```bash
npx jest --testPathPattern=regressionAnchors
```

Expected: Pure Balance (Dog) = 61, Temptations (Cat Treat) = 0.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the app on device / simulator and walk the E2E checklist**

From the spec, verify each:

1. Scan product → tap header bookmark icon → icon fills, row appears in HomeScreen Bookmarks section
2. Save 20 distinct products → try to save 21st → icon tap triggers Alert: `"Bookmarks full"`; icon does NOT flash-fill before the error (sync cap check working)
3. Long-press a Recent Scan row → BookmarkToggleSheet → Bookmark → row appears
4. Swipe-left on a bookmark row in BookmarksScreen → confirm → row removed
5. Switch active pet → Bookmarks section re-renders for new pet (hidden if empty)
6. Bookmark a recalled product → red left border on the row in all three surfaces (Home, Bookmarks, ScanHistory)
7. Bookmark a vet diet product → no score pill (bypass)
8. Ellipsis menu → Share → existing share sheet opens
9. Ellipsis menu → Report issue → Mail app opens with pre-filled subject/body including Platform info
10. Tap `See all ›` on Bookmarks → BookmarksScreen
11. Tap `See all ›` on Recent Scans → ScanHistoryScreen (no delete)
12. Pull-to-refresh on BookmarksScreen → scores refresh
13. VoiceOver: focus each score pill → announces `"X% match for <petName>"`

- [ ] **Step 5: Open PR**

```bash
git push -u origin m9-bookmarks-history
gh pr create --base m5-complete --title "M9: Bookmarks + expanded scan history" --body "$(cat <<'EOF'
## Summary
- New per-pet bookmarks feature (cap 20, free)
- Dedicated BookmarksScreen + ScanHistoryScreen (20 each)
- ResultScreen ellipsis overflow menu replacing share-only icon
- Long-press scan row → toggle bookmark
- Migration 040, D-169

## Test plan
- [ ] Full jest suite passes
- [ ] Regression anchors green (PB=61, Temptations=0)
- [ ] VoiceOver QA on bookmark rows (D-168 compliance)
- [ ] 13-item manual E2E (see plan doc)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes (check before executing)

**Spec coverage:**
- ✅ Data model → Task 1
- ✅ HomeScreen Bookmarks section → Task 6
- ✅ HomeScreen See-all link → Task 7
- ✅ ResultScreen overflow menu → Tasks 4, 5
- ✅ Long-press entry → Task 8
- ✅ BookmarksScreen → Task 9
- ✅ ScanHistoryScreen → Task 10
- ✅ Navigation registration → Task 11
- ✅ D-169 + doc updates → Task 12
- ✅ Verification → Task 13

**Type consistency:**
- `useBookmarkStore.toggle(petId, productId)` signature matches across Tasks 3, 5, 8, 10 ✅
- `BookmarkCardData` shape is hydrated in one place — `fetchBookmarkCards(pet: Pet)` in `bookmarkService` (Task 2). HomeScreen (Task 6) and BookmarksScreen (Task 9) both import it. ✅
- `BookmarkOfflineError` / `BookmarksFullError` from `src/types/bookmark.ts` used consistently in service (Task 2), store (Task 3), and screen handlers (Tasks 5, 8) ✅

**Placeholder scan:**
- No TBD/TODO markers.
- All code blocks complete.
- Actual commands with expected output.

**Known gap (intentional):** Toast utility does not exist in the codebase; the plan uses `Alert.alert` for overflow and error messaging. A proper toast can be added post-M9.

**Gemini review adoptions (2026-04-17):**
- `fetchBookmarkCards` extracted to service (DRY across Home + Bookmarks screens)
- PostgREST nested select for product join (single round-trip)
- Fire-and-forget `batchScoreHybrid` for null-score bookmark cards (JIT cache hydration)
- Synchronous cap check in `useBookmarkStore.toggle` (prevents 21st-item UI flash)
- Rollback path resyncs via `loadForPet` (preserves DESC sort)
- Recalled red-left-border on all three row surfaces (D-158 safety, not deferred)
- CTA "Scan a product" button in Bookmarks + ScanHistory empty states
- `Platform.OS` / `Platform.Version` injected into Report-issue mailto body

**Gemini review — UX-1 adoption (post-confirmation):**
- Bookmark is split out to its own header icon — `bookmark-outline` (default) / `bookmark` filled (active). Visible state, single-tap toggle.
- Share stays in the ellipsis overflow (still a legitimate but secondary action — the off-screen PetShareCard capture flow is an existing UX we don't want to duplicate as a header icon).
- Report issue stays in the ellipsis overflow (low frequency).

**Gemini review pushback:**
- Long-press discoverability concern acknowledged — primary entry remains the visible ResultScreen header bookmark icon; long-press on scan rows is the power-user secondary path. Adding a swipe gesture to SwipeableRow would require overloading its delete/edit semantics for a small discoverability gain.
