import { generateTopPickInsights, type InsightContext } from '../../src/services/topPickInsights';
import type { TopPickEntry } from '../../src/types/categoryBrowse';

function makeEntry(overrides: Partial<TopPickEntry> = {}): TopPickEntry {
  return {
    product_id: 'p1',
    product_name: 'Example Food',
    brand: 'Example Brand',
    image_url: null,
    product_form: 'dry',
    final_score: 80,
    is_supplemental: false,
    is_vet_diet: false,
    ga_protein_pct: null,
    ga_fat_pct: null,
    ga_moisture_pct: null,
    ga_protein_dmb_pct: null,
    ga_fat_dmb_pct: null,
    preservative_type: null,
    aafco_statement: null,
    life_stage_claim: null,
    top_ingredients: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    lifeStage: 'adult',
    weightGoalLevel: 0,
    activityLevel: 'moderate',
    allergens: [],
    category: 'daily_food',
    petName: 'Troy',
    ...overrides,
  };
}

describe('generateTopPickInsights — allergen_safe', () => {
  it('emits bullet when pet has 1 allergen and no top-10 ingredient matches', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'deboned_beef', allergen_group: 'beef' },
        { position: 2, canonical_name: 'brown_rice', allergen_group: null },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: 'Free of chicken' });
  });

  it('emits combined bullet for 2 clean allergens', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'salmon', allergen_group: 'fish' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken', 'beef'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: 'Free of chicken and beef' });
  });

  it('emits count-form bullet for 3+ clean allergens', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'salmon', allergen_group: 'fish' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken', 'beef', 'dairy'], petName: 'Troy' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'allergen_safe', text: "Free of 3 of Troy's allergens" });
  });

  it('omits bullet when any top-10 ingredient matches a pet allergen', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
      ],
    });
    const ctx = makeCtx({ allergens: ['chicken'] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'allergen_safe')).toBeUndefined();
  });

  it('omits bullet when pet has no allergens on record', () => {
    const entry = makeEntry({
      top_ingredients: [
        { position: 1, canonical_name: 'chicken', allergen_group: 'chicken' },
      ],
    });
    const ctx = makeCtx({ allergens: [] });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'allergen_safe')).toBeUndefined();
  });
});

describe('generateTopPickInsights — life_stage', () => {
  it('emits "AAFCO Adult Maintenance" for adult pet + adult claim', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO Adult Maintenance' });
  });

  it('emits for all-life-stages claim regardless of pet stage', () => {
    const entry = makeEntry({ life_stage_claim: 'All Life Stages' });
    const ctx = makeCtx({ lifeStage: 'senior' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO All Life Stages' });
  });

  it('falls through to aafco_statement when life_stage_claim is null', () => {
    const entry = makeEntry({ life_stage_claim: null, aafco_statement: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets).toContainEqual({ kind: 'life_stage', text: 'AAFCO Adult Maintenance' });
  });

  it('omits bullet when senior pet + adult-only claim', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: 'senior' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });

  it('omits bullet when claim is missing entirely', () => {
    const entry = makeEntry({ life_stage_claim: null, aafco_statement: null });
    const ctx = makeCtx({ lifeStage: 'adult' });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });

  it('omits bullet when pet life_stage is null', () => {
    const entry = makeEntry({ life_stage_claim: 'Adult Maintenance' });
    const ctx = makeCtx({ lifeStage: null });
    const bullets = generateTopPickInsights(entry, ctx);
    expect(bullets.find((b) => b.kind === 'life_stage')).toBeUndefined();
  });
});
