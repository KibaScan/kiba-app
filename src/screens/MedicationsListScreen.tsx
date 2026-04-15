// Kiba — Medications List Screen
// Current / Past segmented view with medication rows.
// Access: PetHubScreen → Medications card → chevron or "See All"

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { getMedications, deleteMedication, getPetConditions } from '../services/petService';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { PetMedication } from '../types/pet';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'Medications'>;

// ─── Helpers ────────────────────────────────────────────

function statusDotColor(status: PetMedication['status']): string {
  switch (status) {
    case 'current': return Colors.severityGreen;
    case 'as_needed': return Colors.severityAmber;
    case 'past': return Colors.textTertiary;
  }
}

// ─── Component ──────────────────────────────────────────

export default function MedicationsListScreen() {
  const navigation = useNavigation<Nav>();
  const activePet = useActivePetStore((s) => {
    const pets = s.pets;
    return pets.find((p) => p.id === s.activePetId) ?? pets[0] ?? null;
  });

  const [tab, setTab] = useState<'current' | 'past'>('current');
  const [medications, setMedications] = useState<PetMedication[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activePet) return;
    setLoading(true);
    try {
      const [meds, conds] = await Promise.all([
        getMedications(activePet.id),
        getPetConditions(activePet.id),
      ]);
      setMedications(meds);
      setConditions(conds.map((c) => c.condition_tag).filter((t) => t !== 'allergy'));
    } finally {
      setLoading(false);
    }
  }, [activePet?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const displayedMeds = tab === 'current'
    ? medications.filter((m) => m.status === 'current' || m.status === 'as_needed')
    : medications.filter((m) => m.status === 'past');

  const handleAdd = useCallback(() => {
    if (!activePet) return;
    navigation.navigate('MedicationForm', {
      petId: activePet.id,
      petName: activePet.name,
      conditions,
    });
  }, [navigation, activePet, conditions]);

  const renderItem = useCallback(({ item }: { item: PetMedication }) => (
    <SwipeableRow
      onDelete={async () => {
        await deleteMedication(item.id);
        loadData();
      }}
      onEdit={() => {
        if (!activePet) return;
        navigation.navigate('MedicationForm', {
          petId: activePet.id,
          petName: activePet.name,
          medication: item,
          conditions,
        });
      }}
      deleteConfirmMessage={`Delete "${item.medication_name}"? This cannot be undone.`}
    >
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => {
          if (!activePet) return;
          navigation.navigate('MedicationForm', {
            petId: activePet.id,
            petName: activePet.name,
            medication: item,
            conditions,
          });
        }}
      >
        <View style={[styles.statusDot, { backgroundColor: statusDotColor(item.status) }]} />
        <View style={styles.rowContent}>
          <Text style={[styles.rowName, item.status === 'past' && styles.rowNameMuted]}>
            {item.medication_name}
          </Text>
          {item.dosage ? <Text style={styles.rowDosage}>{item.dosage}</Text> : null}
          {item.prescribed_for ? (
            <Text style={styles.rowPrescribed}>For: {item.prescribed_for}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    </SwipeableRow>
  ), [navigation, activePet, conditions, loadData]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medications</Text>
        <TouchableOpacity onPress={handleAdd} hitSlop={12}>
          <Ionicons name="add" size={26} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segTab, tab === 'current' && styles.segTabActive]}
          onPress={() => setTab('current')}
        >
          <Text style={[styles.segTabText, tab === 'current' && styles.segTabTextActive]}>
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segTab, tab === 'past' && styles.segTabActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.segTabText, tab === 'past' && styles.segTabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={displayedMeds}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={displayedMeds.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="medkit-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>
                {tab === 'current' ? 'No current medications' : 'No past medications'}
              </Text>
              <Text style={styles.emptyBody}>
                {tab === 'current'
                  ? `Track ${activePet?.name ?? 'your pet'}'s medications here.`
                  : 'Discontinued medications will appear here.'}
              </Text>
              {tab === 'current' && (
                <TouchableOpacity style={styles.emptyCta} onPress={handleAdd} activeOpacity={0.7}>
                  <Text style={styles.emptyCtaText}>Add Medication</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomColor: Colors.hairlineBorder,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.cardSurface,
    padding: 3,
  },
  segTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  segTabActive: {
    backgroundColor: Colors.accent,
  },
  segTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segTabTextActive: {
    color: Colors.textPrimary,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  rowContent: { flex: 1 },
  rowName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowNameMuted: {
    color: Colors.textSecondary,
  },
  rowDosage: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowPrescribed: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyCta: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  emptyCtaText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
