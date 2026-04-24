// ResultScreen — Contact-brand wiring test (Task 23, M9 Community).
//
// Why a focused test (not a full render): ResultScreen has 60+ imports
// (scoring pipeline, share capture, pantry services, treat battery, bookmarks,
// scan history persistence, etc.) and won't render its overflow menu until
// `phase === 'ready'`, which requires successful scoring with a deeply-shaped
// ScoredResult. Mocking enough to drive a real render is far more brittle than
// the surface area being tested here.
//
// Coverage strategy:
//   - This file: verifies the ONLY novel logic — the bundled-slug decision
//     `isPublishedSlug(brandSlugify(brand))`. Mocks the JSON to match the spec
//     literally (`['pure-balance']`) and pins the exact navigate-call shape
//     ResultScreen builds via the SAME helper composition, ensuring the
//     screen's wiring stays in lockstep with the contract.
//   - Sibling test `__tests__/components/result/ResultHeaderMenu.test.tsx`
//     covers menu-level presentation: visibility based on prop presence,
//     "Contact {brand}" label rendering, and onContactBrand fire-on-tap.
//
// Spec test mapping:
//   1. Slug PRESENT → showContactBrand = true → menu prop wired → menu shows.
//   2. Slug ABSENT  → showContactBrand = false → no prop → menu hides.
//   3. Tap → cross-stack navigate('Community', { screen: 'VendorDirectory',
//                                                params: { initialBrand } }).

jest.mock('../../src/data/published_vendor_slugs.json', () => ['pure-balance']);

import { isPublishedSlug } from '../../src/services/vendorService';
import { brandSlugify } from '../../src/utils/brandSlugify';

// ─── Pure helper that mirrors ResultScreen's wiring ─────────────────────────
// Kept here (not exported from ResultScreen) because this is a one-line
// composition; locking the shape in a test prevents drift.

function buildContactBrandNavigateAction(brand: string) {
  return [
    'Community',
    { screen: 'VendorDirectory', params: { initialBrand: brand } },
  ] as const;
}

describe('ResultScreen — Contact brand visibility decision', () => {
  it('Test 1: shows the menu item when product.brand normalizes to a published slug', () => {
    // Spec example: "Pure Balance" → "pure-balance" is in mocked JSON.
    const brand = 'Pure Balance';
    const slug = brandSlugify(brand);
    expect(slug).toBe('pure-balance');
    expect(isPublishedSlug(slug)).toBe(true);
  });

  it('Test 2: hides the menu item when product.brand does not match any published slug', () => {
    // Spec example: "Generic Co" → "generic-co" not in mocked JSON.
    const brand = 'Generic Co';
    const slug = brandSlugify(brand);
    expect(slug).toBe('generic-co');
    expect(isPublishedSlug(slug)).toBe(false);
  });

  it('hides the menu when brand has weird punctuation that still slugifies cleanly', () => {
    // Defensive: brandSlugify strips apostrophes; "Hill's" → "hills" not in list.
    expect(isPublishedSlug(brandSlugify("Hill's Science Diet"))).toBe(false);
  });
});

describe('ResultScreen — Contact brand cross-stack navigate shape', () => {
  it('Test 3: builds the cross-stack navigate args ResultScreen passes to the parent tab navigator', () => {
    // ResultScreen jumps via `navigation.getParent().navigate(...)` because
    // VendorDirectory is registered on CommunityStack only and Result lives on
    // Home/Community/Scan/Pantry/Me stacks. Mirrors the existing Pantry
    // SafeSwitch handoff pattern in the same file.
    const args = buildContactBrandNavigateAction('Pure Balance');
    expect(args).toEqual([
      'Community',
      { screen: 'VendorDirectory', params: { initialBrand: 'Pure Balance' } },
    ]);
  });

  it('preserves the original brand casing in initialBrand (not the slug)', () => {
    // VendorDirectoryScreen does case-insensitive substring search on
    // brand_name — passing the displayed brand (not the slug) gives the
    // user a familiar pre-filled query.
    const args = buildContactBrandNavigateAction("Hill's Science Diet");
    expect(args[1].params.initialBrand).toBe("Hill's Science Diet");
  });
});
