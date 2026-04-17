import { resolveSeeAllDestination } from '../../../src/components/browse/topPicksCarouselHelpers';

describe('resolveSeeAllDestination', () => {
  it('routes supplement to CategoryBrowse (unscored)', () => {
    expect(resolveSeeAllDestination('supplement')).toBe('CategoryBrowse');
  });

  it('routes daily_food to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('daily_food')).toBe('CategoryTopPicks');
  });

  it('routes toppers_mixers to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('toppers_mixers')).toBe('CategoryTopPicks');
  });

  it('routes treat to CategoryTopPicks', () => {
    expect(resolveSeeAllDestination('treat')).toBe('CategoryTopPicks');
  });

  it('defaults to CategoryTopPicks for null (active category fallback)', () => {
    expect(resolveSeeAllDestination(null)).toBe('CategoryTopPicks');
  });
});
