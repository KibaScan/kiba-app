import { fetchCategoryTopPicks } from '../../src/services/categoryBrowseService';
import { supabase } from '../../src/services/supabase';

jest.mock('../../src/services/supabase');

describe('fetchCategoryTopPicks', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('returns TopPickEntry[] with joined macros + AAFCO + preservative + top_ingredients', async () => {
    const scoredRows = [
      {
        product_id: 'p1',
        final_score: 90,
        is_supplemental: false,
        category: 'daily_food',
        products: {
          name: 'Premium Kibble',
          brand: 'BrandA',
          image_url: 'https://example.com/a.jpg',
          product_form: 'dry',
          is_vet_diet: false,
          is_recalled: false,
          target_species: 'dog',
          is_supplemental: false,
          is_variety_pack: false,
          needs_review: false,
          ga_protein_pct: 28,
          ga_fat_pct: 16,
          ga_moisture_pct: 10,
          ga_protein_dmb_pct: null,
          ga_fat_dmb_pct: null,
          preservative_type: 'natural',
          aafco_statement: 'Adult Maintenance',
          life_stage_claim: 'Adult Maintenance',
        },
      },
    ];

    const ingredientRows = [
      { product_id: 'p1', position: 1, canonical_name: 'chicken', ingredients_dict: { allergen_group: 'chicken' } },
      { product_id: 'p1', position: 2, canonical_name: 'brown_rice', ingredients_dict: { allergen_group: null } },
    ];

    // First call: pet_product_scores
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: scoredRows, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    // Second call: product_ingredients
    mockFrom.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          lte: () => ({
            order: () => Promise.resolve({ data: ingredientRows, error: null }),
          }),
        }),
      }),
    });

    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      product_id: 'p1',
      product_name: 'Premium Kibble',
      brand: 'BrandA',
      final_score: 90,
      ga_protein_pct: 28,
      ga_fat_pct: 16,
      preservative_type: 'natural',
      life_stage_claim: 'Adult Maintenance',
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
        { position: 2, canonical_name: 'brown_rice', allergen_group: null },
      ],
    });
  });

  it('returns empty array when pet_product_scores query errors', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);
    expect(result).toEqual([]);
  });

  it('excludes vet_diet / recalled / variety_pack / needs_review / species-mismatch products', async () => {
    const scoredRows = [
      {
        product_id: 'p1', final_score: 90, is_supplemental: false, category: 'daily_food',
        products: { name: 'vet diet', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: true, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p2', final_score: 85, is_supplemental: false, category: 'daily_food',
        products: { name: 'recalled', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: true, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p3', final_score: 80, is_supplemental: false, category: 'daily_food',
        products: { name: 'variety', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: true, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p4', final_score: 75, is_supplemental: false, category: 'daily_food',
        products: { name: 'needs review', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'dog',
          is_supplemental: false, is_variety_pack: false, needs_review: true,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
      {
        product_id: 'p5', final_score: 70, is_supplemental: false, category: 'daily_food',
        products: { name: 'cat food', brand: 'X', image_url: null, product_form: 'dry',
          is_vet_diet: false, is_recalled: false, target_species: 'cat',
          is_supplemental: false, is_variety_pack: false, needs_review: false,
          ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
          ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
          preservative_type: null, aafco_statement: null, life_stage_claim: null },
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: scoredRows, error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    // No 2nd call because no rows survive filtering
    const result = await fetchCategoryTopPicks('pet-1', 'daily_food', null, 'dog', 20);
    expect(result).toEqual([]);
  });

  it('returns [] for supplement category (defensive — caller should route elsewhere)', async () => {
    const result = await fetchCategoryTopPicks('pet-1', 'supplement', null, 'dog', 20);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
