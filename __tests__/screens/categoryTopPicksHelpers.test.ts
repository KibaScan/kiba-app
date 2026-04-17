import { getTopPicksTitle, getCategoryTitle, getFilterLabel } from '../../src/screens/categoryTopPicksHelpers';

describe('getCategoryTitle', () => {
  it('maps categories', () => {
    expect(getCategoryTitle('daily_food')).toBe('Daily Food');
    expect(getCategoryTitle('toppers_mixers')).toBe('Toppers & Mixers');
    expect(getCategoryTitle('treat')).toBe('Treats');
    expect(getCategoryTitle('supplement')).toBe('Supplements');
  });
});

describe('getFilterLabel', () => {
  it('returns sub-filter label if found', () => {
    expect(getFilterLabel('daily_food', 'dry')).toBe('Dry');
    expect(getFilterLabel('daily_food', 'freeze_dried')).toBe('Freeze-Dried');
    expect(getFilterLabel('treat', 'jerky_chews')).toBe('Jerky & Chews');
    expect(getFilterLabel('toppers_mixers', 'wet')).toBe('Wet');
  });
  it('returns null for unknown filter', () => {
    expect(getFilterLabel('daily_food', 'nonsense')).toBeNull();
    expect(getFilterLabel('daily_food', null)).toBeNull();
  });
});

describe('getTopPicksTitle', () => {
  it('uses category title when no sub-filter', () => {
    expect(getTopPicksTitle('daily_food', null, 'Troy')).toBe('Top Daily Food for Troy');
    expect(getTopPicksTitle('treat', null, 'Troy')).toBe('Top Treats for Troy');
  });
  it('uses sub-filter + "Food" suffix for daily_food', () => {
    expect(getTopPicksTitle('daily_food', 'dry', 'Troy')).toBe('Top Dry Food for Troy');
    expect(getTopPicksTitle('daily_food', 'freeze_dried', 'Troy')).toBe('Top Freeze-Dried Food for Troy');
  });
  it('uses "Wet Toppers" pattern for toppers_mixers', () => {
    expect(getTopPicksTitle('toppers_mixers', 'wet', 'Troy')).toBe('Top Wet Toppers for Troy');
  });
  it('uses sub-filter label directly for treats', () => {
    expect(getTopPicksTitle('treat', 'jerky_chews', 'Troy')).toBe('Top Jerky & Chews for Troy');
  });
});
