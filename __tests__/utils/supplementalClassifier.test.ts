import { isSupplementalProduct } from '../../src/utils/supplementalClassifier';

describe('isSupplementalProduct (D-136)', () => {
  describe('positive matches — supplemental feeding language', () => {
    it('detects standard AAFCO intermittent/supplemental statement', () => {
      expect(
        isSupplementalProduct(
          'Intended for intermittent or supplemental feeding'
        )
      ).toBe(true);
    });

    it('detects "for supplemental feeding only"', () => {
      expect(isSupplementalProduct('For supplemental feeding only')).toBe(true);
    });

    it('detects "not intended as a sole diet"', () => {
      expect(isSupplementalProduct('Not intended as a sole diet')).toBe(true);
    });

    it('detects "mix with" manufacturer variants', () => {
      expect(
        isSupplementalProduct(
          "Mix with Evanger's Dry Dinners for a balanced meal"
        )
      ).toBe(true);
    });

    it('detects "serve alongside"', () => {
      expect(
        isSupplementalProduct('Serve alongside a complete and balanced diet')
      ).toBe(true);
    });

    it('detects "not complete and balanced"', () => {
      expect(
        isSupplementalProduct('This product is not complete and balanced')
      ).toBe(true);
    });

    it('detects "not a complete"', () => {
      expect(
        isSupplementalProduct('This is not a complete diet for your pet')
      ).toBe(true);
    });

    it('detects "intermittent" alone', () => {
      expect(
        isSupplementalProduct('For intermittent feeding purposes')
      ).toBe(true);
    });
  });

  describe('negative matches — daily food / treats / supplements', () => {
    it('returns false for standard complete-and-balanced statement', () => {
      expect(
        isSupplementalProduct('Complete and balanced for adult dogs')
      ).toBe(false);
    });

    it('returns false for basic feeding instructions', () => {
      expect(
        isSupplementalProduct('Feed 1 cup per 10 lbs body weight')
      ).toBe(false);
    });

    it('returns false for null', () => {
      expect(isSupplementalProduct(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSupplementalProduct('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isSupplementalProduct('   ')).toBe(false);
    });
  });

  describe('critical edge cases — D-096 vs D-136 axis separation', () => {
    it('"This supplement supports..." does NOT match — word "supplement" alone is not a trigger', () => {
      expect(
        isSupplementalProduct('This supplement supports joint health in dogs')
      ).toBe(false);
    });

    it('"A complete dietary supplement for adult dogs" does NOT match — D-096 supplement, not D-136 supplemental', () => {
      expect(
        isSupplementalProduct('A complete dietary supplement for adult dogs')
      ).toBe(false);
    });

    it('"Daily supplement" does NOT match', () => {
      expect(
        isSupplementalProduct('Daily supplement for hip and joint support')
      ).toBe(false);
    });
  });
});
