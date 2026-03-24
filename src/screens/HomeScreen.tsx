// Kiba — Home Dashboard
// Surfaces recall alerts, pantry summary, upcoming appointments, and scan activity.
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { useActivePetStore } from '../stores/useActivePetStore';
import { useScanStore } from '../stores/useScanStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getUpcomingAppointments } from '../services/appointmentService';
import { getRecentScans } from '../services/scanHistoryService';
import { ScanHistoryCard } from '../components/ScanHistoryCard';
import { supabase } from '../services/supabase';
import type { Appointment, AppointmentType } from '../types/appointment';
import type { ScanHistoryItem } from '../types/scanHistory';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// ─── Appointment Helpers ─────────────────────────────────

const APPT_TYPE_ICONS: Record<AppointmentType, keyof typeof Ionicons.glyphMap> = {
  vet_visit: 'medical-outline',
  grooming: 'cut-outline',
  medication: 'medkit-outline',
  vaccination: 'shield-checkmark-outline',
  deworming: 'fitness-outline',
  other: 'calendar-outline',
};

const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  vet_visit: 'vet visit',
  grooming: 'grooming',
  medication: 'medication',
  vaccination: 'vaccination',
  deworming: 'deworming',
  other: 'appointment',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRelativeDay(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 6) return DAYS[date.getDay()];
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// ─── Component ───────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const weeklyCount = useScanStore((s) => s.weeklyCount);
  const activePet = pets.find((p) => p.id === activePetId);

  const pantryItems = usePantryStore((s) => s.items);
  const pantryLoading = usePantryStore((s) => s.loading);
  const loadPantry = usePantryStore((s) => s.loadPantry);

  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);

  const recalledItems = useMemo(
    () => pantryItems.filter((i) => i.product?.is_recalled),
    [pantryItems],
  );

  const pantryStats = useMemo(() => {
    const lowStock = pantryItems.filter((i) => i.is_low_stock && !i.is_empty).length;
    const empty = pantryItems.filter((i) => i.is_empty).length;
    return { total: pantryItems.length, lowStock, empty };
  }, [pantryItems]);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      if (!activePetId) return;

      if (usePantryStore.getState()._petId !== activePetId) {
        loadPantry(activePetId);
      }

      let cancelled = false;
      (async () => {
        setAppointmentLoading(true);
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.user?.id || cancelled) return;

          const [appointmentResult, scansResult] = await Promise.allSettled([
            getUpcomingAppointments(session.user.id),
            getRecentScans(activePetId, 3),
          ]);
          if (!cancelled) {
            setNextAppointment(
              appointmentResult.status === 'fulfilled' ? appointmentResult.value[0] ?? null : null,
            );
            setRecentScans(
              scansResult.status === 'fulfilled' ? scansResult.value : [],
            );
          }
        } catch {
          // Non-critical — skip silently
        } finally {
          if (!cancelled) setAppointmentLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [activePetId, loadPantry]),
  );

  const appointmentPetName = useMemo(() => {
    if (!nextAppointment) return '';
    const pet = pets.find((p) => nextAppointment.pet_ids.includes(p.id));
    return pet?.name ?? activePet?.name ?? '';
  }, [nextAppointment, pets, activePet]);

  const navigateToPantry = useCallback(() => {
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('Pantry');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kiba</Text>
        {activePet && (
          <View style={styles.petBadgeRow}>
            <Ionicons name="paw-outline" size={14} color={Colors.accent} />
            <Text style={styles.petBadge}>Scanning for {activePet.name}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Recall alert cards — top priority, D-125: always free */}
        {recalledItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.recallCard}
            onPress={() =>
              navigation.navigate('RecallDetail', {
                productId: item.product_id,
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={Colors.severityRed}
            />
            <View style={styles.recallCardContent}>
              <Text style={styles.recallCardTitle}>Recall Alert</Text>
              <Text style={styles.recallCardBody} numberOfLines={2}>
                {item.product.name} has been recalled.
                {activePet ? ` ${activePet.name} may be affected.` : ''}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        ))}

        {/* 2. Pantry summary card */}
        {activePet && (
          <TouchableOpacity
            style={styles.pantryCard}
            onPress={navigateToPantry}
            activeOpacity={0.7}
          >
            {pantryLoading ? (
              <View style={styles.pantryLoadingRow}>
                <ActivityIndicator size="small" color={Colors.textTertiary} />
              </View>
            ) : (
              <>
                <View style={styles.pantryCardHeader}>
                  <View style={styles.pantryPetAvatar}>
                    {activePet.photo_url ? (
                      <Image
                        source={{ uri: activePet.photo_url }}
                        style={styles.pantryPetPhoto}
                      />
                    ) : (
                      <Ionicons
                        name="paw-outline"
                        size={16}
                        color={Colors.accent}
                      />
                    )}
                  </View>
                  <Text style={styles.pantryCardTitle} numberOfLines={1}>
                    {activePet.name}&apos;s Pantry
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textTertiary}
                  />
                </View>
                <Text style={styles.pantryCardBody}>
                  {pantryStats.total > 0
                    ? `${pantryStats.total} item${pantryStats.total !== 1 ? 's' : ''} tracked` +
                      (pantryStats.lowStock > 0
                        ? ` · ${pantryStats.lowStock} running low`
                        : '') +
                      (pantryStats.empty > 0
                        ? ` · ${pantryStats.empty} empty`
                        : '')
                    : `Start tracking ${activePet.name}'s food and treats.`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* 3. Upcoming appointment (soonest only) */}
        {!appointmentLoading && nextAppointment && appointmentPetName ? (
          <TouchableOpacity
            style={styles.appointmentRow}
            onPress={() =>
              navigation.navigate('AppointmentDetail', {
                appointmentId: nextAppointment.id,
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name={APPT_TYPE_ICONS[nextAppointment.type]}
              size={20}
              color={Colors.accent}
            />
            <Text style={styles.appointmentText} numberOfLines={1}>
              {appointmentPetName}&apos;s{' '}
              {APPT_TYPE_LABELS[nextAppointment.type]}
            </Text>
            <Text style={styles.appointmentDate}>
              {formatRelativeDay(nextAppointment.scheduled_at)}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        ) : null}

        {/* 4. Scan counter */}
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyCount}>{weeklyCount}</Text>
          <Text style={styles.weeklyLabel}>Scans this week</Text>
        </View>

        {/* 4b. Recent Scans */}
        {recentScans.length > 0 && activePet && (
          <View style={styles.recentScansSection}>
            <Text style={styles.recentScansTitle}>Recent Scans</Text>
            {recentScans.map((scan) => (
              <ScanHistoryCard
                key={scan.id}
                item={scan}
                petName={activePet.name}
                onPress={(productId) => {
                  if (scan.product.is_recalled) {
                    navigation.navigate('RecallDetail', { productId });
                  } else {
                    navigation.navigate('Result', { productId, petId: activePetId });
                  }
                }}
              />
            ))}
          </View>
        )}

        {/* 5. Empty state CTA */}
        {recentScans.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name="camera-outline"
            size={56}
            color={Colors.textTertiary}
            style={{ marginBottom: Spacing.lg }}
          />
          <Text style={styles.emptyTitle}>Scan your first product</Text>
          <Text style={styles.emptySubtitle}>
            Tap the scan button below to check{'\n'}a pet food, treat, or
            supplement.
          </Text>
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 1,
  },
  petBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00B4D815',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  petBadge: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.accent,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },

  // Recall card
  recallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${Colors.severityRed}15`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallCardContent: {
    flex: 1,
  },
  recallCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.severityRed,
    marginBottom: 2,
  },
  recallCardBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Pantry card
  pantryCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  pantryLoadingRow: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  pantryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pantryPetAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pantryPetPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  pantryCardTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pantryCardBody: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: 40,
    lineHeight: 18,
  },

  // Appointment row
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  appointmentText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  appointmentDate: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Weekly scan card
  weeklyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  weeklyCount: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  weeklyLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Recent scans
  recentScansSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  recentScansTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
