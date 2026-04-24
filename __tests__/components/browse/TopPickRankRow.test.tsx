// Render tests — mirror mocks pattern from FeedingIntentSheet.test.tsx.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TopPickRankRow } from '../../../src/components/browse/TopPickRankRow';
import type { TopPickEntry, InsightBullet } from '../../../src/types/categoryBrowse';

const entry: TopPickEntry = {
  product_id: 'p-42',
  product_name: 'Salmon Recipe',
  brand: 'Test Brand',
  image_url: null,
  product_form: 'dry',
  final_score: 88,
  is_supplemental: false,
  is_vet_diet: false,
  ga_protein_pct: null, ga_fat_pct: null, ga_moisture_pct: null,
  ga_protein_dmb_pct: null, ga_fat_dmb_pct: null,
  preservative_type: null, aafco_statement: null, life_stage_claim: null,
  top_ingredients: [],
};

const insight: InsightBullet = { kind: 'allergen_safe', text: 'Free of chicken' };

describe('TopPickRankRow', () => {
  it('renders rank, brand, name, score, and insight text', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TopPickRankRow pick={entry} rank={2} petName="Buster" insight={insight} onPress={onPress} />,
    );
    expect(getByText('#2')).toBeTruthy();
    expect(getByText('Test Brand')).toBeTruthy();
    expect(getByText('Salmon Recipe')).toBeTruthy();
    expect(getByText('88% match')).toBeTruthy();
    expect(getByText('Free of chicken')).toBeTruthy();
  });

  it('accessibility label includes full "{score}% match for {petName}" phrase (D-168)', () => {
    const { getByLabelText } = render(
      <TopPickRankRow pick={entry} rank={2} petName="Buster" insight={insight} onPress={() => {}} />,
    );
    expect(getByLabelText(/88% match for Buster/i)).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <TopPickRankRow pick={entry} rank={2} petName="Buster" insight={insight} onPress={onPress} />,
    );
    fireEvent.press(getByLabelText(/Salmon Recipe/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without an insight row when insight is null', () => {
    const { queryByText } = render(
      <TopPickRankRow pick={entry} rank={3} petName="Buster" insight={null} onPress={() => {}} />,
    );
    expect(queryByText('Free of chicken')).toBeNull();
  });
});
