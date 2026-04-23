jest.mock('../../src/data/toxic_foods.json', () => ({
  toxics: [
    {
      id: 'chocolate',
      name: 'chocolate',
      alt_names: ['cocoa', 'cacao'],
      species_severity: { dog: 'toxic', cat: 'toxic' },
    },
  ],
}), { virtual: true });

import { validateRecipe } from '../../src/utils/validateRecipeSubmission';

const baseRecipe = {
  title: 'Peanut Butter Dog Treat',
  subtitle: undefined,
  species: 'dog' as const,
  prep_steps: ['Mix peanut butter and oats.', 'Bake at 350F.'],
  ingredients: [{ name: 'peanut butter', quantity: 1, unit: 'cup' }],
};

describe('validateRecipe', () => {
  it('passes a clean dog treat recipe', () => {
    expect(validateRecipe(baseRecipe)).toEqual({ valid: true });
  });
  it('rejects a recipe with chocolate (toxic to dog)', () => {
    const result = validateRecipe({
      ...baseRecipe,
      ingredients: [{ name: 'milk chocolate chips', quantity: 0.5, unit: 'cup' }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/chocolate.*toxic to dog/i);
  });
  it('rejects when title contains "treats arthritis"', () => {
    const result = validateRecipe({
      ...baseRecipe,
      title: 'Wonder Stew that treats arthritis',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/medical claims/i);
  });
  it('does NOT reject the word "treat" alone (noun usage)', () => {
    expect(validateRecipe({ ...baseRecipe, title: 'Crunchy Beef Treat' }).valid).toBe(true);
  });
  it('rejects "helps with kidney disease"', () => {
    const result = validateRecipe({
      ...baseRecipe,
      subtitle: 'helps with kidney disease',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/medical claims/i);
  });
  it('rejects when ingredients array is empty', () => {
    const result = validateRecipe({ ...baseRecipe, ingredients: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/at least one ingredient/i);
  });
});
