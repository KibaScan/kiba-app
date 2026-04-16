jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TopPickHeroCard } from '../../../src/components/browse/TopPickHeroCard';
import type { TopPickEntry, InsightBullet } from '../../../src/types/categoryBrowse';

const entry: TopPickEntry = {
  product_id: 'p-42',
  product_name: 'Salmon Recipe',
  brand: 'Test Brand',
  image_url: null,
  product_form: 'dry',
  final_score: 93,
  is_supplemental: false,
  is_vet_diet: false,
  ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
  ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
  preservative_type: null, aafco_statement: null, life_stage_claim: null,
  top_ingredients: [],
};

const insights: InsightBullet[] = [
  { kind: 'allergen_safe', text: 'Free of chicken' },
  { kind: 'life_stage', text: 'AAFCO Adult Maintenance' },
  { kind: 'quality_tier', text: 'Top-tier ingredient quality' },
];

describe('TopPickHeroCard', () => {
  it('renders brand, name, "Best overall match for {Pet}" badge, and all 3 insights', () => {
    const { getByText } = render(
      <TopPickHeroCard pick={entry} petName="Troy" insights={insights} onPress={() => {}} />,
    );
    expect(getByText('Test Brand')).toBeTruthy();
    expect(getByText('Salmon Recipe')).toBeTruthy();
    expect(getByText(/Best overall match for Troy/i)).toBeTruthy();
    expect(getByText('Free of chicken')).toBeTruthy();
    expect(getByText('AAFCO Adult Maintenance')).toBeTruthy();
    expect(getByText('Top-tier ingredient quality')).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TopPickHeroCard pick={entry} petName="Troy" insights={insights} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText(/Salmon Recipe/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
