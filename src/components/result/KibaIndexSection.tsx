import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { FeedbackCard } from './kiba-index/FeedbackCard';
import { fetchKibaIndexStats, fetchUserVote, submitKibaIndexVote } from '../../services/kibaIndexService';
import type { KibaIndexStats, KibaIndexVote } from '../../services/kibaIndexService';
import { Ionicons } from '@expo/vector-icons';

interface KibaIndexSectionProps {
  productId: string;
  petId: string | null;
  species: 'dog' | 'cat';
  petName: string | null;
  isBypassed: boolean;
}

export const KibaIndexSection: React.FC<KibaIndexSectionProps> = ({
  productId,
  petId,
  species,
  petName,
  isBypassed,
}) => {
  const [stats, setStats] = useState<KibaIndexStats | null>(null);
  const [userVote, setUserVote] = useState<KibaIndexVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const displayName = petName || (species === 'dog' ? 'your dog' : 'your cat');
  const speciesLabel = species === 'dog' ? 'dogs' : 'cats';

  const loadData = useCallback(async (isBackgroundFetch = false) => {
    if (!petId) {
      if (!isBackgroundFetch) setLoading(true);
      const data = await fetchKibaIndexStats(productId, species);
      setStats(data);
      setLoading(false);
      return;
    }

    if (!isBackgroundFetch) setLoading(true);
    const [fetchedStats, fetchedVote] = await Promise.all([
      fetchKibaIndexStats(productId, species),
      fetchUserVote(productId, petId),
    ]);
    setStats(fetchedStats);
    setUserVote(fetchedVote);
    setLoading(false);
  }, [productId, petId, species]);

  useEffect(() => {
    if (isBypassed) return;
    loadData(false);
  }, [loadData, isBypassed]);

  if (isBypassed) {
    return null;
  }

  const handleVote = async (type: 'taste' | 'tummy', voteId: string) => {
    if (!petId || submitting) return;

    const newVote: KibaIndexVote = {
      taste_vote: type === 'taste' ? (voteId as 'loved' | 'picky' | 'refused') : (userVote?.taste_vote || null),
      tummy_vote: type === 'tummy' ? (voteId as 'perfect' | 'soft_stool' | 'upset') : (userVote?.tummy_vote || null),
    };

    // Optimistic local state: bump the stat counters immediately so the bar
    // chart animates from N → N+1 without waiting for the network round-trip.
    const prevVote = userVote;
    const prevStats = stats;
    setUserVote(newVote);

    if (stats) {
      const optimistic = structuredClone(stats);
      if (type === 'taste') {
        const key = voteId as keyof typeof optimistic.taste;
        if (key in optimistic.taste) {
          (optimistic.taste as Record<string, number>)[key] += 1;
        }
        optimistic.taste.total += 1;
      } else {
        const key = voteId as keyof typeof optimistic.tummy;
        if (key in optimistic.tummy) {
          (optimistic.tummy as Record<string, number>)[key] += 1;
        }
        optimistic.tummy.total += 1;
      }
      // Only bump total_votes when this is a new vote row (no prior vote exists).
      // Partial second-category votes upsert the same row — no new row created.
      if (!prevVote) {
        optimistic.total_votes += 1;
      }
      setStats(optimistic);
    }

    setSubmitting(true);

    const success = await submitKibaIndexVote(
      productId,
      petId,
      newVote.taste_vote,
      newVote.tummy_vote,
    );

    if (success) {
      // Re-fetch authoritative stats from server to correct any drift
      await loadData(true);
    } else {
      // Rollback optimistic updates on failure
      setUserVote(prevVote);
      setStats(prevStats);
      Alert.alert('Vote Not Saved', 'Check your connection and try again.');
    }

    setSubmitting(false);
  };

  // Picky Eater Approved: ≥20 taste votes AND ≥85% loved
  const tasteTotal = stats?.taste.total || 0;
  const isPickyEaterApproved =
    stats !== null && tasteTotal >= 20 && (stats.taste.loved / tasteTotal) >= 0.85;

  const totalVotes = stats?.total_votes || 0;

  if (loading) {
    return (
      <CollapsibleSection title="Kiba Index">
        <ActivityIndicator size="small" color={Colors.accent} />
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Kiba Index"
      subtitle={totalVotes > 0 ? `${totalVotes} ${speciesLabel} weighed in` : 'New — be the first!'}
    >
      <View style={styles.container}>
        {!petId && (
          <View style={styles.noPetWarning}>
            <Text style={styles.noPetText}>
              Add a pet profile to share your pet's experience with this food.
            </Text>
          </View>
        )}

        {/* TASTE TEST — full width */}
        <FeedbackCard
          title="Taste Test"
          iconName="restaurant-outline"
          color={Colors.severityAmber}
          totalVotes={tasteTotal}
          stats={{
            loved: stats?.taste.loved || 0,
            picky: stats?.taste.picky || 0,
            refused: stats?.taste.refused || 0,
          }}
          options={[
            { id: 'loved', label: 'Cleared the Bowl' },
            { id: 'picky', label: 'Picky' },
            { id: 'refused', label: 'Refused' },
          ]}
          userSelectedOptionId={userVote?.taste_vote || null}
          onVote={(id: string) => handleVote('taste', id)}
          isLoading={submitting || !petId}
          petName={displayName}
          speciesLabel={speciesLabel}
          promptLabel={`How did ${displayName} like it?`}
        />

        {/* TUMMY CHECK — full width */}
        <FeedbackCard
          title="Tummy Check"
          iconName="medical-outline"
          color={Colors.accent}
          totalVotes={stats?.tummy.total || 0}
          stats={{
            perfect: stats?.tummy.perfect || 0,
            soft_stool: stats?.tummy.soft_stool || 0,
            upset: stats?.tummy.upset || 0,
          }}
          options={[
            { id: 'perfect', label: 'Perfect Poops' },
            { id: 'soft_stool', label: 'Slight Upset' },
            { id: 'upset', label: 'Hard Pass' },
          ]}
          userSelectedOptionId={userVote?.tummy_vote || null}
          onVote={(id: string) => handleVote('tummy', id)}
          isLoading={submitting || !petId}
          petName={displayName}
          speciesLabel={speciesLabel}
          promptLabel={`How's ${displayName}'s digestion been?`}
        />

        {isPickyEaterApproved && (
          <View style={styles.badgeContainer}>
            <Ionicons name="medal-outline" size={24} color={Colors.severityAmber} style={styles.badgeIcon} />
            <Text style={styles.badgeText}>Picky Eater Approved</Text>
          </View>
        )}
      </View>
    </CollapsibleSection>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  noPetWarning: {
    backgroundColor: Colors.cardBorder,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  noPetText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.severityAmber + '26', // 15% opacity
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.severityAmber + '4D', // 30% opacity
    marginTop: Spacing.sm,
  },
  badgeIcon: {
    marginRight: Spacing.sm,
  },
  badgeText: {
    color: Colors.severityAmber,
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Medium',
  },
});
