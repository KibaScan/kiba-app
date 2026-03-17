// Ingredient Canonical Name Normalizer Tests
// Covers: FD&C colorant alias normalization, non-colorant passthrough

import { normalizeCanonicalName } from '../../src/utils/ingredientNormalizer';

describe('normalizeCanonicalName', () => {
  // ─── Blue 1 aliases ───────────────────────────────────

  it('fd&c_blue_no._1 → blue_1', () => {
    expect(normalizeCanonicalName('fd&c_blue_no._1')).toBe('blue_1');
  });

  it('fd&c_blue_1 → blue_1', () => {
    expect(normalizeCanonicalName('fd&c_blue_1')).toBe('blue_1');
  });

  it('fd&c_blue_#1 → blue_1', () => {
    expect(normalizeCanonicalName('fd&c_blue_#1')).toBe('blue_1');
  });

  it('fd&c_blue#1 → blue_1', () => {
    expect(normalizeCanonicalName('fd&c_blue#1')).toBe('blue_1');
  });

  it('blue_#1 → blue_1', () => {
    expect(normalizeCanonicalName('blue_#1')).toBe('blue_1');
  });

  it('blue_no._1 → blue_1', () => {
    expect(normalizeCanonicalName('blue_no._1')).toBe('blue_1');
  });

  it('blue_no_1 → blue_1', () => {
    expect(normalizeCanonicalName('blue_no_1')).toBe('blue_1');
  });

  it('blue_1_lake → blue_1', () => {
    expect(normalizeCanonicalName('blue_1_lake')).toBe('blue_1');
  });

  it('blue_lake_1 → blue_1 (reordered lake)', () => {
    expect(normalizeCanonicalName('blue_lake_1')).toBe('blue_1');
  });

  it('blue_1_b410922 → blue_1 (batch code stripped)', () => {
    expect(normalizeCanonicalName('blue_1_b410922')).toBe('blue_1');
  });

  // ─── Blue 2 aliases ───────────────────────────────────

  it('blue_2 → blue_2 (already canonical)', () => {
    expect(normalizeCanonicalName('blue_2')).toBe('blue_2');
  });

  it('blue_2_lake → blue_2', () => {
    expect(normalizeCanonicalName('blue_2_lake')).toBe('blue_2');
  });

  it('fd&c_blue_no._2 → blue_2', () => {
    expect(normalizeCanonicalName('fd&c_blue_no._2')).toBe('blue_2');
  });

  it('blue_#2 → blue_2', () => {
    expect(normalizeCanonicalName('blue_#2')).toBe('blue_2');
  });

  it('blue_2_a386323 → blue_2 (batch code)', () => {
    expect(normalizeCanonicalName('blue_2_a386323')).toBe('blue_2');
  });

  it('blue_2_d412420 → blue_2 (batch code)', () => {
    expect(normalizeCanonicalName('blue_2_d412420')).toBe('blue_2');
  });

  // ─── Red 40 aliases ───────────────────────────────────

  it('fd_and_c_red_40 → red_40', () => {
    expect(normalizeCanonicalName('fd_and_c_red_40')).toBe('red_40');
  });

  it('red_40_lake → red_40', () => {
    expect(normalizeCanonicalName('red_40_lake')).toBe('red_40');
  });

  it('fd&c_red_40_lake → red_40', () => {
    expect(normalizeCanonicalName('fd&c_red_40_lake')).toBe('red_40');
  });

  it('fd&c_red#40 → red_40', () => {
    expect(normalizeCanonicalName('fd&c_red#40')).toBe('red_40');
  });

  it('red_40_f411319 → red_40 (batch code)', () => {
    expect(normalizeCanonicalName('red_40_f411319')).toBe('red_40');
  });

  // ─── Yellow 5 aliases ─────────────────────────────────

  it('fd&c_yellow_no._5 → yellow_5', () => {
    expect(normalizeCanonicalName('fd&c_yellow_no._5')).toBe('yellow_5');
  });

  it('yellow_5_lake → yellow_5', () => {
    expect(normalizeCanonicalName('yellow_5_lake')).toBe('yellow_5');
  });

  it('fd&c_yellow_5 → yellow_5', () => {
    expect(normalizeCanonicalName('fd&c_yellow_5')).toBe('yellow_5');
  });

  it('fd&c_yellow_5_lake → yellow_5', () => {
    expect(normalizeCanonicalName('fd&c_yellow_5_lake')).toBe('yellow_5');
  });

  // ─── Yellow 6 aliases ─────────────────────────────────

  it('yellow_6 → yellow_6 (already canonical)', () => {
    expect(normalizeCanonicalName('yellow_6')).toBe('yellow_6');
  });

  it('yellow_6_lake → yellow_6', () => {
    expect(normalizeCanonicalName('yellow_6_lake')).toBe('yellow_6');
  });

  it('fd&c_yellow_6 → yellow_6', () => {
    expect(normalizeCanonicalName('fd&c_yellow_6')).toBe('yellow_6');
  });

  it('fd&c_yellow#6 → yellow_6', () => {
    expect(normalizeCanonicalName('fd&c_yellow#6')).toBe('yellow_6');
  });

  // ─── Red 3 ────────────────────────────────────────────

  it('red_3 → red_3 (already canonical)', () => {
    expect(normalizeCanonicalName('red_3')).toBe('red_3');
  });

  // ─── Titanium dioxide ─────────────────────────────────

  it('titanium_dioxide → titanium_dioxide (already canonical)', () => {
    expect(normalizeCanonicalName('titanium_dioxide')).toBe('titanium_dioxide');
  });

  it('titanium_dioxide_color → titanium_dioxide', () => {
    expect(normalizeCanonicalName('titanium_dioxide_color')).toBe('titanium_dioxide');
  });

  // ─── Wave 2: OCR artifacts / typos / extra separators ──

  it('fd_&_c_yellow_no._5 → yellow_5 (space-variant prefix)', () => {
    expect(normalizeCanonicalName('fd_&_c_yellow_no._5')).toBe('yellow_5');
  });

  it('fd*c_red_#40 → red_40 (asterisk OCR artifact)', () => {
    expect(normalizeCanonicalName('fd*c_red_#40')).toBe('red_40');
  });

  it('fd&c_red_#_40 → red_40 (extra underscore after hash)', () => {
    expect(normalizeCanonicalName('fd&c_red_#_40')).toBe('red_40');
  });

  it('yellow_#5._prime_rib → yellow_5 (parsing artifact)', () => {
    expect(normalizeCanonicalName('yellow_#5._prime_rib')).toBe('yellow_5');
  });

  it('fd&c_red_no._3 → red_3', () => {
    expect(normalizeCanonicalName('fd&c_red_no._3')).toBe('red_3');
  });

  it('fd&c_red_no._40 → red_40', () => {
    expect(normalizeCanonicalName('fd&c_red_no._40')).toBe('red_40');
  });

  // ─── Already-canonical colorants returned unchanged ───

  it('red_40 → red_40 (already canonical)', () => {
    expect(normalizeCanonicalName('red_40')).toBe('red_40');
  });

  it('yellow_5 → yellow_5 (already canonical)', () => {
    expect(normalizeCanonicalName('yellow_5')).toBe('yellow_5');
  });

  // ─── Edge cases ──────────────────────────────────────

  it('empty string → empty string', () => {
    expect(normalizeCanonicalName('')).toBe('');
  });

  it('caramel_color → caramel_color (NOT FD&C — stays at caution per D-142)', () => {
    expect(normalizeCanonicalName('caramel_color')).toBe('caramel_color');
  });

  // ─── Non-colorant passthrough ─────────────────────────

  it('chicken_meal → chicken_meal (unchanged)', () => {
    expect(normalizeCanonicalName('chicken_meal')).toBe('chicken_meal');
  });

  it('mixed_tocopherols → mixed_tocopherols (unchanged)', () => {
    expect(normalizeCanonicalName('mixed_tocopherols')).toBe('mixed_tocopherols');
  });

  it('blueberry → blueberry (not a colorant despite "blue")', () => {
    expect(normalizeCanonicalName('blueberry')).toBe('blueberry');
  });

  it('blue_whiting → blue_whiting (fish, not a colorant)', () => {
    expect(normalizeCanonicalName('blue_whiting')).toBe('blue_whiting');
  });

  it('whole_blueberries → whole_blueberries (unchanged)', () => {
    expect(normalizeCanonicalName('whole_blueberries')).toBe('whole_blueberries');
  });

  it('red_lentils → red_lentils (not a colorant)', () => {
    expect(normalizeCanonicalName('red_lentils')).toBe('red_lentils');
  });
});
