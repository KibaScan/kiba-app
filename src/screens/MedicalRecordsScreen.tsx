// Kiba — Medical Records Screen
// Full-screen timeline for all vaccine + deworming records.
// Access: PetHubScreen → Medical Records card → "See All ›"

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
import { getHealthRecords, deleteHealthRecord } from '../services/appointmentService';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useActivePetStore } from '../stores/useActivePetStore';
import HealthRecordDetailSheet from '../components/appointments/HealthRecordDetailSheet';
import type { PetHealthRecord, HealthRecordType } from '../types/appointment';
import type { MeStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<MeStackParamList, 'MedicalRecords'>;

// ─── Helpers ────────────────────────────────────────────

const RECORD_ICONS: Record<HealthRecordType, string> = {
  vaccination: 'shield-checkmark-outline',
  deworming: 'fitness-outline',
};

const RECORD_LABELS: Record<HealthRecordType, string> = {
  vaccination: 'Vaccine',
  deworming: 'Deworming',
};

function formatRecordDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────

export default function MedicalRecordsScreen() {
  const navigation = useNavigation<Nav>();
  const activePet = useActivePetStore((s) => {
    const pets = s.pets;
    return pets.find((p) => p.id === s.activePetId) ?? pets[0] ?? null;
  });

  const [records, setRecords] = useState<PetHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail/edit sheet
  const [selectedRecord, setSelectedRecord] = useState<PetHealthRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!activePet) return;
    setLoading(true);
    try {
      const data = await getHealthRecords(activePet.id);
      // Sort chronologically descending (already done by service, but ensure)
      data.sort((a, b) => b.administered_at.localeCompare(a.administered_at));
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }, [activePet?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRecordPress = useCallback((record: PetHealthRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  }, []);

  const handleRecordUpdated = useCallback(() => {
    loadData();
  }, [loadData]);

  const renderItem = useCallback(({ item }: { item: PetHealthRecord }) => {
    const icon = RECORD_ICONS[item.record_type];
    const typeLabel = RECORD_LABELS[item.record_type];

    return (
      <SwipeableRow
        onDelete={async () => {
          await deleteHealthRecord(item.id);
          loadData();
        }}
        onEdit={() => handleRecordPress(item)}
        deleteConfirmMessage={`Delete "${item.treatment_name}"? This cannot be undone.`}
      >
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleRecordPress(item)}
        >
          <View style={styles.iconCircle}>
            <Ionicons
              name={icon as any}
              size={18}
              color={Colors.accent}
            />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowName}>{item.treatment_name}</Text>
            <Text style={styles.rowDate}>
              {formatRecordDate(item.administered_at)}
              {item.next_due_at ? ` — Next: ${formatRecordDate(item.next_due_at)}` : ''}
            </Text>
            {item.vet_name ? <Text style={styles.rowVet}>{item.vet_name}</Text> : null}
          </View>
          <Text style={styles.rowType}>{typeLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [handleRecordPress, loadData]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical Records</Text>
        <TouchableOpacity onPress={() => navigation.navigate('HealthRecordForm')} hitSlop={12}>
          <Ionicons name="add" size={26} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={records.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No medical records</Text>
              <Text style={styles.emptyBody}>
                Track {activePet?.name ?? 'your pet'}'s vaccines and dewormings.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('HealthRecordForm')}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyCtaText}>Add Medical Record</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Detail/edit sheet */}
      <HealthRecordDetailSheet
        visible={detailVisible}
        record={selectedRecord}
        onClose={() => { setDetailVisible(false); setSelectedRecord(null); }}
        onUpdated={handleRecordUpdated}
      />
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
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rowContent: { flex: 1 },
  rowName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowVet: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  rowType: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
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
