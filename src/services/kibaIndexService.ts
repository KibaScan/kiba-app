import { supabase } from './supabase';
import { isOnline } from '../utils/network';

export type KibaIndexStats = {
  total_votes: number;
  taste: {
    total: number;
    loved: number;
    picky: number;
    refused: number;
  };
  tummy: {
    total: number;
    perfect: number;
    soft_stool: number;
    upset: number;
  };
};

export type KibaIndexVote = {
  taste_vote: 'loved' | 'picky' | 'refused' | null;
  tummy_vote: 'perfect' | 'soft_stool' | 'upset' | null;
};

/**
 * Fetches aggregated community stats for a given product and species.
 * Secured by an RPC function that bypasses RLS on individual rows.
 */
export async function fetchKibaIndexStats(productId: string, species: 'dog' | 'cat'): Promise<KibaIndexStats | null> {
  const { data, error } = await supabase
    .rpc('get_kiba_index_stats', {
      p_product_id: productId,
      p_species: species,
    });

  if (error) {
    console.error('[KibaIndexService] Error fetching stats:', error.message);
    return null;
  }

  return data as KibaIndexStats;
}

/**
 * Checks if the current active pet has already placed a vote on this product.
 */
export async function fetchUserVote(productId: string, petId: string): Promise<KibaIndexVote | null> {
  const { data, error } = await supabase
    .from('kiba_index_votes')
    .select('taste_vote, tummy_vote')
    .eq('product_id', productId)
    .eq('pet_id', petId)
    .maybeSingle();

  if (error) {
    console.warn('[KibaIndexService] Error fetching user vote:', error.message);
    return null;
  }

  return data as KibaIndexVote;
}

/**
 * Upserts a vote for the current user and pet.
 */
export async function submitKibaIndexVote(
  productId: string,
  petId: string,
  tasteVote: 'loved' | 'picky' | 'refused' | null,
  tummyVote: 'perfect' | 'soft_stool' | 'upset' | null
): Promise<boolean> {
  if (!(await isOnline())) {
    console.warn('[KibaIndexService] Offline — vote not submitted');
    return false;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) return false;

  const { error } = await supabase
    .from('kiba_index_votes')
    .upsert({
      user_id: userData.user.id,
      pet_id: petId,
      product_id: productId,
      taste_vote: tasteVote,
      tummy_vote: tummyVote,
      voted_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id, pet_id, product_id'
    });

  if (error) {
    console.error('[KibaIndexService] Error submitting vote:', error.message);
    return false;
  }

  return true;
}
