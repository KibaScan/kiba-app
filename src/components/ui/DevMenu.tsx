// Kiba — Dev Menu (__DEV__ only)
// Accessible from PetHubScreen: tap version number 5 times.
// Features: toggle premium, manage scan window, show entitlement state.
// Completely stripped from production builds via __DEV__ guard.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import {
  isPremium,
  setDevPremiumOverride,
  getDevPremiumOverride,
  getScanWindowInfo,
  refreshSubscriptionStatus,
} from '../../utils/permissions';
import { supabase } from '../../services/supabase';

interface DevMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function DevMenu({ visible, onClose }: DevMenuProps) {
  if (!__DEV__) return null;

  const [premiumOverride, setPremiumOverride] = useState<boolean | null>(
    getDevPremiumOverride(),
  );
  const [scanInfo, setScanInfo] = useState<{
    count: number;
    remaining: number;
    oldestScanAt: string | null;
  }>({ count: 0, remaining: 5, oldestScanAt: null });

  const refresh = useCallback(async () => {
    const info = await getScanWindowInfo();
    setScanInfo(info);
    setPremiumOverride(getDevPremiumOverride());
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const togglePremium = async () => {
    const next = premiumOverride === true ? null : true;
    setDevPremiumOverride(next);
    setPremiumOverride(next);
    await refreshSubscriptionStatus();
  };

  const injectScans = async (count: number) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    const now = Date.now();
    const rows = Array.from({ length: count }, (_, i) => ({
      user_id: userData.user.id,
      product_id: '00000000-0000-0000-0000-000000000000',
      pet_id: '00000000-0000-0000-0000-000000000000',
      scanned_at: new Date(now - i * 60000).toISOString(), // 1 min apart
      score_breakdown: {},
    }));

    const { error } = await supabase.from('scans').insert(rows);
    if (error) {
      Alert.alert('Insert failed', error.message);
    } else {
      Alert.alert('Done', `Injected ${count} scan(s)`);
      refresh();
    }
  };

  const resetScans = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('scans')
      .delete()
      .eq('user_id', userData.user.id)
      .gte('scanned_at', sevenDaysAgo);

    if (error) {
      Alert.alert('Reset failed', error.message);
    } else {
      Alert.alert('Done', 'Scans in rolling window cleared');
      refresh();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Dev Menu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            {/* Premium Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entitlement</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Premium status</Text>
                <Text style={[styles.value, isPremium() ? styles.valueGreen : styles.valueRed]}>
                  {isPremium() ? 'ACTIVE' : 'FREE'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Dev override</Text>
                <Text style={styles.value}>
                  {premiumOverride === null ? 'None (use RC)' : premiumOverride ? 'ON' : 'OFF'}
                </Text>
              </View>
              <TouchableOpacity style={styles.button} onPress={togglePremium}>
                <Text style={styles.buttonText}>
                  {premiumOverride === true ? 'Clear Override' : 'Enable Premium'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scan Window */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rolling Scan Window (7 days)</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Scans used</Text>
                <Text style={styles.value}>{scanInfo.count} / 5</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Remaining</Text>
                <Text style={styles.value}>{scanInfo.remaining}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Oldest in window</Text>
                <Text style={styles.value}>
                  {scanInfo.oldestScanAt
                    ? new Date(scanInfo.oldestScanAt).toLocaleString()
                    : 'None'}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSmall]}
                  onPress={() => injectScans(1)}
                >
                  <Text style={styles.buttonText}>+1 Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSmall]}
                  onPress={() => injectScans(5)}
                >
                  <Text style={styles.buttonText}>+5 Scans</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSmall, styles.buttonDanger]}
                  onPress={resetScans}
                >
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
              <Ionicons name="refresh" size={16} color={Colors.accent} />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.accent,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  valueGreen: {
    color: Colors.severityGreen,
  },
  valueRed: {
    color: Colors.severityRed,
  },
  button: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonSmall: {
    flex: 1,
  },
  buttonDanger: {
    backgroundColor: Colors.severityRed,
  },
  buttonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  refreshText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
});
