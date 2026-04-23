import { brandSlugify } from '../../src/utils/brandSlugify';

describe('brandSlugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(brandSlugify('Pure Balance')).toBe('pure-balance');
  });
  it('strips punctuation', () => {
    expect(brandSlugify("Hill's Science Diet")).toBe('hills-science-diet');
  });
  it('collapses repeated separators', () => {
    expect(brandSlugify('Wellness   CORE  &  More')).toBe('wellness-core-more');
  });
  it('trims leading/trailing whitespace', () => {
    expect(brandSlugify('  Purina Pro Plan  ')).toBe('purina-pro-plan');
  });
  it('handles unicode by stripping non-ASCII alphanum', () => {
    expect(brandSlugify('Café Naturé')).toBe('caf-natur');
  });
  it('returns empty string for empty input', () => {
    expect(brandSlugify('')).toBe('');
    expect(brandSlugify('   ')).toBe('');
  });
});
