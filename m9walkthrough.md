# HomeScreen Premium Overhaul — Walkthrough

## Summary

Executed the 8-point UX overhaul of the HomeScreen, transforming it from a wireframe prototype into a premium, Matte Premium–compliant dashboard. All changes follow the design system rules (solid fills, hairline borders, no glows) and address the expert teardown feedback.

---

## Files Modified (6)

### [HomeScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/HomeScreen.tsx)

The core of the overhaul — 7 of the 8 fixes applied here:

| Fix | Change |
|-----|--------|
| **Fix 1 — Hierarchy Inversion** | Moved `SubFilterChipRow` from above the category grid to below it. Flow is now: Search → Grid → Sub-filters → Content (chronological to user intent) |
| **Fix 2 — Score Pills in Search** | Search results now show match percentage pills (e.g. `87%`) instead of blind chevrons. Falls back to chevron when score is unavailable |
| **Fix 3 — Brand Sanitization** | `sanitizeBrand()` applied to all brand displays (search results + recent scans). Raw `\|\|` delimiters replaced with ` · ` interpunct |
| **Fix 4 — Score Pill Contrast** | Background tint reduced from `33` (20% opacity) to `1A` (10% opacity) for better readability of bold score text |
| **Fix 5 — Solid Card Fills** | Category cards: `#1C1C1E` solid fill, `borderWidth: 2` with `borderColor: 'transparent'` (inactive) / `cat.tint` (active). Transparent border trick prevents 4px jitter on toggle |
| **Fix 6 — Carded Pantry** | Pantry row wrapped in same card anatomy as appointment row (`Colors.cardSurface`, `borderRadius: 16`, hairline border) |
| **Fix 7 — 2-Line Product Names** | All `numberOfLines` on product name `Text` elements changed from `1` → `2` (search results + recent scans) |
| **Fix 8 — Top Picks Integration** | `TopPicksCarousel` imported and rendered between sub-filters and appointment card. Hidden when `activeSubFilter === 'vet_diet'` (liability: vet diets are unscored and require veterinary oversight) |

**Legacy token migration:** `Colors.card` → `Colors.cardSurface`, `Colors.cardBorder` → `Colors.hairlineBorder` across all HomeScreen styles.

**Bug fix found in review:** `activePetId` was missing from `handleSearchChange` dependency array — stale closure would use wrong pet's ID for score lookups after pet switch.

```diff:HomeScreen.tsx
// Kiba — Home Dashboard v2
// Search bar, browse categories, recall alerts, slim pantry row, scan activity.
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing, Limits, SEVERITY_COLORS, getScoreColor } from '../utils/constants';
import { stripBrandFromName } from '../utils/formatters';
import { canSearch, isPremium, getScanWindowInfo } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getUpcomingAppointments } from '../services/appointmentService';
import { getRecentScans } from '../services/scanHistoryService';
import { searchProducts } from '../services/topMatches';
import { supabase } from '../services/supabase';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import type { ProductSearchResult } from '../services/topMatches';
import type { Appointment, AppointmentType } from '../types/appointment';
import type { ScanHistoryItem } from '../types/scanHistory';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import type { BrowseCategory } from '../types/categoryBrowse';
import { SUB_FILTERS } from '../types/categoryBrowse';
import { SubFilterChipRow } from '../components/browse/SubFilterChipRow';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { SafeSwitchCardData } from '../types/safeSwitch';
import { SafeSwitchBanner } from '../components/pantry/SafeSwitchBanner';
import { getActiveSwitchForPet } from '../services/safeSwitchService';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// ─── Constants ──────────────────────────────────────────

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

const BROWSE_CATEGORIES: readonly {
  key: import('../types/categoryBrowse').BrowseCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}[] = [
  { key: 'daily_food', label: 'Daily Food', icon: 'nutrition-outline', tint: Colors.accent },
  { key: 'toppers_mixers', label: 'Toppers & Mixers', icon: 'layers-outline', tint: '#14B8A6' },
  { key: 'treat', label: 'Treats', icon: 'fish-outline', tint: Colors.severityAmber },
  { key: 'supplement', label: 'Supplements', icon: 'flask-outline', tint: '#A78BFA' },
] as const;

// ─── Helpers ────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const rootNav = useNavigation();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);

  const pantryItems = usePantryStore((s) => s.items);
  const loadPantry = usePantryStore((s) => s.loadPantry);

  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [activeSwitchData, setActiveSwitchData] = useState<SafeSwitchCardData | null>(null);

  // ── Search state (local to HomeScreen) ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Category browse state ──
  const [activeCategory, setActiveCategory] = useState<BrowseCategory | null>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);

  const isSearchActive = searchQuery.trim().length > 0 || isSearchFocused;

  // ── Scan counter state (free users) ──
  const [scanWindowInfo, setScanWindowInfo] = useState<{
    count: number;
    remaining: number;
    oldestScanAt: string | null;
  } | null>(null);
  const premium = isPremium();

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Derived values ──

  const weeklyCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recentScans.filter((s) => new Date(s.scanned_at).getTime() >= weekAgo).length;
  }, [recentScans]);

  const recalledItems = useMemo(
    () => pantryItems.filter((i) => i.product?.is_recalled),
    [pantryItems],
  );

  const pantryCategories = useMemo(() => {
    const foods = pantryItems.filter((i) => i.product?.category !== 'treat').length;
    const treats = pantryItems.filter((i) => i.product?.category === 'treat').length;
    return { foods, treats };
  }, [pantryItems]);

  const scanTooltipText = useMemo(() => {
    if (!scanWindowInfo || premium) return '';
    const { remaining, oldestScanAt } = scanWindowInfo;
    if (remaining > 0) {
      return `Scans refresh on a rolling 7-day window. You have ${remaining} scan${remaining !== 1 ? 's' : ''} remaining.`;
    }
    if (oldestScanAt) {
      const unlockAt = new Date(new Date(oldestScanAt).getTime() + 7 * 24 * 60 * 60 * 1000);
      const diffMs = unlockAt.getTime() - Date.now();
      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const relativeTime = hours >= 24
        ? `${Math.ceil(hours / 24)} day${Math.ceil(hours / 24) !== 1 ? 's' : ''}`
        : `${hours} hour${hours !== 1 ? 's' : ''}`;
      return `Scans refresh on a rolling 7-day window. Your next scan unlocks in ~${relativeTime}.`;
    }
    return 'Scans refresh on a rolling 7-day window.';
  }, [scanWindowInfo, premium]);

  const scanCounterColor = useMemo(() => {
    if (!scanWindowInfo) return Colors.severityGreen;
    const { remaining } = scanWindowInfo;
    if (remaining >= 3) return Colors.severityGreen;
    if (remaining >= 1) return Colors.severityAmber;
    return Colors.severityRed;
  }, [scanWindowInfo]);

  // ── Data loading ──

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
            getRecentScans(activePetId, 5),
          ]);
          if (!cancelled) {
            setNextAppointment(
              appointmentResult.status === 'fulfilled' ? appointmentResult.value[0] ?? null : null,
            );
            setRecentScans(
              scansResult.status === 'fulfilled' ? scansResult.value : [],
            );
          }

          // Load scan window info for free users
          if (!isPremium()) {
            try {
              const info = await getScanWindowInfo();
              if (!cancelled) setScanWindowInfo(info);
            } catch {
              // Non-critical
            }
          }

          // Load active safe switch
          try {
            if (activePetId) {
              const switchData = await getActiveSwitchForPet(activePetId);
              if (!cancelled) setActiveSwitchData(switchData);
            }
          } catch {
            // Non-critical
          }
        } catch {
          // Non-critical — skip silently
        } finally {
          if (!cancelled) setAppointmentLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        setIsSearchFocused(false);
      };
    }, [activePetId, loadPantry]),
  );

  const appointmentPetName = useMemo(() => {
    if (!nextAppointment) return '';
    const pet = pets.find((p) => nextAppointment.pet_ids.includes(p.id));
    return pet?.name ?? activePet?.name ?? '';
  }, [nextAppointment, pets, activePet]);

  // ── Handlers ──

  const navigateToPantry = useCallback(() => {
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('Pantry');
  }, [navigation]);

  const handleSearchBarPress = useCallback(() => {
    if (!canSearch()) {
      (rootNav as any).navigate('Paywall', { trigger: 'search' });
    }
  }, [rootNav]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (!canSearch()) return;
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (!activePet) return;
      try {
        // Build filters from active category + sub-filter
        const filters: Parameters<typeof searchProducts>[2] = {};
        if (activeCategory === 'daily_food') {
          filters.category = 'daily_food';
          filters.isSupplemental = false;
          if (activeSubFilter && activeSubFilter !== 'vet_diet' && activeSubFilter !== 'other') {
            filters.productForm = activeSubFilter;
          } else if (activeSubFilter === 'other') {
            filters.productForm = 'other';
          }
        } else if (activeCategory === 'toppers_mixers') {
          filters.category = 'daily_food';
          filters.isSupplemental = true;
          if (activeSubFilter) filters.productForm = activeSubFilter;
        } else if (activeCategory === 'treat') {
          filters.category = 'treat';
          if (activeSubFilter === 'freeze_dried') filters.productForm = 'freeze_dried';
        }
        const results = await searchProducts(text, activePet.species,
          Object.keys(filters).length > 0 ? filters : undefined);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [activePet, activeCategory, activeSubFilter]);

  // Re-trigger search when category or sub-filter changes while text is active
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearchChange(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSubFilter]);

  const handleCategoryTap = useCallback((category: BrowseCategory) => {
    if (!canSearch()) {
      (rootNav as any).navigate('Paywall', { trigger: 'search' });
      return;
    }
    // Toggle: tap active category to deselect, tap another to switch
    setActiveCategory((prev) => prev === category ? null : category);
    setActiveSubFilter(null);
  }, [rootNav]);

  const handleSubFilterSelect = useCallback((key: string | null) => {
    setActiveSubFilter(key);
  }, []);

  const handleSearchResultTap = useCallback((item: ProductSearchResult) => {
    Keyboard.dismiss();
    navigation.navigate('Result', { productId: item.product_id, petId: activePetId });
  }, [navigation, activePetId]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  // ── Render ──

  const hasContent = recentScans.length > 0 || pantryItems.length > 0;

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
        keyboardDismissMode="on-drag"
      >
        {/* 1. Recall alert — highest priority, always first (D-125: free) */}
        {recalledItems.length > 0 && activePet && (
          <TouchableOpacity
            style={styles.recallCard}
            onPress={navigateToPantry}
            activeOpacity={0.7}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={SEVERITY_COLORS.danger}
            />
            <Text style={styles.recallCardBody} numberOfLines={2}>
              {recalledItems.length} recalled product
              {recalledItems.length !== 1 ? 's' : ''} in{' '}
              {activePet.name}&apos;s pantry
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        )}

        {/* 2. Search bar — premium: real input; free: tappable facade → paywall */}
        <View style={styles.searchBarContainer}>
          {canSearch() ? (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search pet food products..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={() => setIsSearchFocused(true)}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchLoading && <ActivityIndicator size="small" color={Colors.accent} />}
              {searchQuery.length > 0 && !searchLoading && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.searchBar}
              onPress={handleSearchBarPress}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.searchPlaceholder}>Search pet food products...</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2b. Sub-filter chips — shown under search bar when a category is active */}
        {activeCategory && (
          <SubFilterChipRow
            filters={SUB_FILTERS[activeCategory]}
            activeKey={activeSubFilter}
            onSelect={handleSubFilterSelect}
          />
        )}

        {/* 3. Browse categories — always visible */}
        <View style={styles.categoryGrid}>
          {BROWSE_CATEGORIES.map((cat) => {
            const selected = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryCard,
                  selected && { borderColor: cat.tint, borderWidth: 2 },
                ]}
                onPress={() => handleCategoryTap(cat.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon} size={28} color={selected ? cat.tint : Colors.textTertiary} />
                <Text style={[styles.categoryLabel, selected && { color: cat.tint }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>


        {/* 4. Search results — shown when search active */}
        {isSearchActive && (
          <View style={styles.searchResultsContainer}>
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <TouchableOpacity
                  key={item.product_id}
                  style={styles.searchResultRow}
                  onPress={() => handleSearchResultTap(item)}
                  activeOpacity={0.7}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.searchResultImage} />
                  ) : (
                    <View style={[styles.searchResultImage, styles.searchResultImagePlaceholder]}>
                      <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultBrand} numberOfLines={1}>
                      {item.brand}
                    </Text>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {stripBrandFromName(item.brand, item.product_name)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))
            ) : searchLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.xl }} />
            ) : searchQuery.trim() ? (
              <View style={styles.searchEmptyState}>
                <Text style={styles.searchEmptyText}>
                  No products found for &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Normal content (hidden when search active) ── */}
        {!isSearchActive && (
          <>
            {/* 5. Upcoming appointment */}
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

            {/* Safe Switch status (M7, compact) */}
            {activeSwitchData && (
              <SafeSwitchBanner
                data={activeSwitchData}
                onPress={() => navigation.navigate('SafeSwitchDetail', { switchId: activeSwitchData.switch.id })}
                compact
              />
            )}

            {/* 6. Pantry nav row (slim) */}
            {activePet && (
              <TouchableOpacity
                style={styles.pantryRow}
                onPress={navigateToPantry}
                activeOpacity={0.7}
              >
                <View style={styles.pantryRowAvatar}>
                  {activePet.photo_url ? (
                    <Image source={{ uri: activePet.photo_url }} style={styles.pantryRowPhoto} />
                  ) : (
                    <Ionicons name="paw-outline" size={12} color={Colors.accent} />
                  )}
                </View>
                <Text style={styles.pantryRowTitle} numberOfLines={1}>
                  {activePet.name}&apos;s Pantry
                </Text>
                {pantryItems.length > 0 ? (
                  <Text style={styles.pantryRowSubtitle}>
                    {pantryCategories.foods} food{pantryCategories.foods !== 1 ? 's' : ''} ·{' '}
                    {pantryCategories.treats} treat{pantryCategories.treats !== 1 ? 's' : ''}
                  </Text>
                ) : (
                  <Text style={styles.pantryRowSubtitle}>Start tracking</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* 7. Recent Scans — redesigned counter */}
            {recentScans.length > 0 && activePet && (
              <View style={styles.recentScansSection}>
                <View style={styles.recentScansHeader}>
                  <Text style={styles.recentScansTitle}>Recent Scans</Text>
                  {!premium && scanWindowInfo ? (
                    <View style={styles.scanCounterRow}>
                      <View style={[styles.scanCounterPill, { backgroundColor: `${scanCounterColor}20` }]}>
                        <Text style={[styles.scanCounterText, { color: scanCounterColor }]}>
                          {scanWindowInfo.count}/{Limits.freeScansPerWeek} this week
                        </Text>
                      </View>
                      <InfoTooltip text={scanTooltipText} size={14} />
                    </View>
                  ) : (
                    <Text style={styles.recentScansWeekly}>
                      {weeklyCount} this week
                    </Text>
                  )}
                </View>
                {recentScans.map((scan) => {
                  const scoreColor =
                    scan.final_score != null
                      ? getScoreColor(scan.final_score, scan.product.is_supplemental)
                      : null;

                  return (
                    <TouchableOpacity
                      key={scan.id}
                      style={styles.scanRow}
                      onPress={() => {
                        if (scan.product.is_recalled) {
                          navigation.navigate('RecallDetail', {
                            productId: scan.product_id,
                          });
                        } else {
                          navigation.navigate('Result', {
                            productId: scan.product_id,
                            petId: activePetId,
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {scan.product.image_url ? (
                        <Image
                          source={{ uri: scan.product.image_url }}
                          style={styles.scanRowImage}
                        />
                      ) : (
                        <View style={styles.scanRowImagePlaceholder}>
                          <Ionicons
                            name="cube-outline"
                            size={18}
                            color={Colors.textTertiary}
                          />
                        </View>
                      )}
                      <View style={styles.scanRowInfo}>
                        <Text style={styles.scanRowBrand} numberOfLines={1}>
                          {scan.product.brand}
                        </Text>
                        <Text style={styles.scanRowName} numberOfLines={1}>
                          {stripBrandFromName(scan.product.brand, scan.product.name)}
                        </Text>
                      </View>
                      {scoreColor ? (
                        <View
                          style={[
                            styles.scorePill,
                            { backgroundColor: `${scoreColor}33` },
                          ]}
                        >
                          <Text style={[styles.scorePillText, { color: scoreColor }]}>
                            {scan.final_score}%
                          </Text>
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={Colors.textTertiary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 8. Empty state */}
            {!hasContent && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="camera-outline"
                  size={48}
                  color={Colors.textTertiary}
                  style={{ marginBottom: Spacing.md }}
                />
                <Text style={styles.emptyTitle}>Scan your first product</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the scan button below to check{'\n'}a pet food, treat, or
                  supplement.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

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
    backgroundColor: `${SEVERITY_COLORS.danger}15`,
    borderLeftWidth: 3,
    borderLeftColor: SEVERITY_COLORS.danger,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallCardBody: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    lineHeight: 18,
  },

  // Search bar
  searchBarContainer: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },

  // Browse categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryCard: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  categoryLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Search results
  searchResultsContainer: {
    gap: Spacing.xs,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  searchResultImagePlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    gap: 2,
  },
  searchResultBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  searchEmptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Appointment row
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
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

  // Pantry slim row
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pantryRowAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pantryRowPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pantryRowTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pantryRowSubtitle: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  // Scan counter
  scanCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanCounterPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scanCounterText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },

  // Recent scans
  recentScansSection: {
    marginBottom: Spacing.md,
  },
  recentScansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recentScansTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recentScansWeekly: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scanRowImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  scanRowImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanRowInfo: {
    flex: 1,
    gap: 2,
  },
  scanRowBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scanRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
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
===
// Kiba — Home Dashboard v2
// Search bar, browse categories, recall alerts, slim pantry row, scan activity.
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing, Limits, SEVERITY_COLORS, getScoreColor } from '../utils/constants';
import { stripBrandFromName, sanitizeBrand } from '../utils/formatters';
import { canSearch, isPremium, getScanWindowInfo } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getUpcomingAppointments } from '../services/appointmentService';
import { getRecentScans } from '../services/scanHistoryService';
import { searchProducts } from '../services/topMatches';
import { supabase } from '../services/supabase';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import type { ProductSearchResult } from '../services/topMatches';
import type { Appointment, AppointmentType } from '../types/appointment';
import type { ScanHistoryItem } from '../types/scanHistory';
import type { HomeStackParamList, TabParamList } from '../types/navigation';
import type { BrowseCategory } from '../types/categoryBrowse';
import { SUB_FILTERS } from '../types/categoryBrowse';
import { SubFilterChipRow } from '../components/browse/SubFilterChipRow';
import { TopPicksCarousel } from '../components/browse/TopPicksCarousel';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { SafeSwitchCardData } from '../types/safeSwitch';
import { SafeSwitchBanner } from '../components/pantry/SafeSwitchBanner';
import { getActiveSwitchForPet } from '../services/safeSwitchService';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// ─── Constants ──────────────────────────────────────────

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

const BROWSE_CATEGORIES: readonly {
  key: import('../types/categoryBrowse').BrowseCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}[] = [
  { key: 'daily_food', label: 'Daily Food', icon: 'nutrition-outline', tint: Colors.accent },
  { key: 'toppers_mixers', label: 'Toppers & Mixers', icon: 'layers-outline', tint: '#14B8A6' },
  { key: 'treat', label: 'Treats', icon: 'fish-outline', tint: Colors.severityAmber },
  { key: 'supplement', label: 'Supplements', icon: 'flask-outline', tint: '#A78BFA' },
] as const;

// ─── Helpers ────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const rootNav = useNavigation();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const pets = useActivePetStore((s) => s.pets);
  const activePet = pets.find((p) => p.id === activePetId);

  const pantryItems = usePantryStore((s) => s.items);
  const loadPantry = usePantryStore((s) => s.loadPantry);

  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [activeSwitchData, setActiveSwitchData] = useState<SafeSwitchCardData | null>(null);

  // ── Search state (local to HomeScreen) ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Category browse state ──
  const [activeCategory, setActiveCategory] = useState<BrowseCategory | null>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);

  const isSearchActive = searchQuery.trim().length > 0 || isSearchFocused;

  // ── Scan counter state (free users) ──
  const [scanWindowInfo, setScanWindowInfo] = useState<{
    count: number;
    remaining: number;
    oldestScanAt: string | null;
  } | null>(null);
  const premium = isPremium();

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Derived values ──

  const weeklyCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recentScans.filter((s) => new Date(s.scanned_at).getTime() >= weekAgo).length;
  }, [recentScans]);

  const recalledItems = useMemo(
    () => pantryItems.filter((i) => i.product?.is_recalled),
    [pantryItems],
  );

  const pantryCategories = useMemo(() => {
    const foods = pantryItems.filter((i) => i.product?.category !== 'treat').length;
    const treats = pantryItems.filter((i) => i.product?.category === 'treat').length;
    return { foods, treats };
  }, [pantryItems]);

  const scanTooltipText = useMemo(() => {
    if (!scanWindowInfo || premium) return '';
    const { remaining, oldestScanAt } = scanWindowInfo;
    if (remaining > 0) {
      return `Scans refresh on a rolling 7-day window. You have ${remaining} scan${remaining !== 1 ? 's' : ''} remaining.`;
    }
    if (oldestScanAt) {
      const unlockAt = new Date(new Date(oldestScanAt).getTime() + 7 * 24 * 60 * 60 * 1000);
      const diffMs = unlockAt.getTime() - Date.now();
      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const relativeTime = hours >= 24
        ? `${Math.ceil(hours / 24)} day${Math.ceil(hours / 24) !== 1 ? 's' : ''}`
        : `${hours} hour${hours !== 1 ? 's' : ''}`;
      return `Scans refresh on a rolling 7-day window. Your next scan unlocks in ~${relativeTime}.`;
    }
    return 'Scans refresh on a rolling 7-day window.';
  }, [scanWindowInfo, premium]);

  const scanCounterColor = useMemo(() => {
    if (!scanWindowInfo) return Colors.severityGreen;
    const { remaining } = scanWindowInfo;
    if (remaining >= 3) return Colors.severityGreen;
    if (remaining >= 1) return Colors.severityAmber;
    return Colors.severityRed;
  }, [scanWindowInfo]);

  // ── Data loading ──

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
            getRecentScans(activePetId, 5),
          ]);
          if (!cancelled) {
            setNextAppointment(
              appointmentResult.status === 'fulfilled' ? appointmentResult.value[0] ?? null : null,
            );
            setRecentScans(
              scansResult.status === 'fulfilled' ? scansResult.value : [],
            );
          }

          // Load scan window info for free users
          if (!isPremium()) {
            try {
              const info = await getScanWindowInfo();
              if (!cancelled) setScanWindowInfo(info);
            } catch {
              // Non-critical
            }
          }

          // Load active safe switch
          try {
            if (activePetId) {
              const switchData = await getActiveSwitchForPet(activePetId);
              if (!cancelled) setActiveSwitchData(switchData);
            }
          } catch {
            // Non-critical
          }
        } catch {
          // Non-critical — skip silently
        } finally {
          if (!cancelled) setAppointmentLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        setIsSearchFocused(false);
      };
    }, [activePetId, loadPantry]),
  );

  const appointmentPetName = useMemo(() => {
    if (!nextAppointment) return '';
    const pet = pets.find((p) => nextAppointment.pet_ids.includes(p.id));
    return pet?.name ?? activePet?.name ?? '';
  }, [nextAppointment, pets, activePet]);

  // ── Handlers ──

  const navigateToPantry = useCallback(() => {
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('Pantry');
  }, [navigation]);

  const handleSearchBarPress = useCallback(() => {
    if (!canSearch()) {
      (rootNav as any).navigate('Paywall', { trigger: 'search' });
    }
  }, [rootNav]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (!canSearch()) return;
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (!activePet) return;
      try {
        // Build filters from active category + sub-filter
        const filters: Parameters<typeof searchProducts>[2] = {};
        if (activeCategory === 'daily_food') {
          filters.category = 'daily_food';
          filters.isSupplemental = false;
          if (activeSubFilter && activeSubFilter !== 'vet_diet' && activeSubFilter !== 'other') {
            filters.productForm = activeSubFilter;
          } else if (activeSubFilter === 'other') {
            filters.productForm = 'other';
          }
        } else if (activeCategory === 'toppers_mixers') {
          filters.category = 'daily_food';
          filters.isSupplemental = true;
          if (activeSubFilter) filters.productForm = activeSubFilter;
        } else if (activeCategory === 'treat') {
          filters.category = 'treat';
          if (activeSubFilter === 'freeze_dried') filters.productForm = 'freeze_dried';
        }
        const results = await searchProducts(text, activePet.species,
          Object.keys(filters).length > 0 ? filters : undefined,
          activePetId ?? undefined);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [activePet, activePetId, activeCategory, activeSubFilter]);

  // Re-trigger search when category or sub-filter changes while text is active
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearchChange(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSubFilter]);

  const handleCategoryTap = useCallback((category: BrowseCategory) => {
    if (!canSearch()) {
      (rootNav as any).navigate('Paywall', { trigger: 'search' });
      return;
    }
    // Toggle: tap active category to deselect, tap another to switch
    setActiveCategory((prev) => prev === category ? null : category);
    setActiveSubFilter(null);
  }, [rootNav]);

  const handleSubFilterSelect = useCallback((key: string | null) => {
    setActiveSubFilter(key);
  }, []);

  const handleSearchResultTap = useCallback((item: ProductSearchResult) => {
    Keyboard.dismiss();
    navigation.navigate('Result', { productId: item.product_id, petId: activePetId });
  }, [navigation, activePetId]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  // ── Render ──

  const hasContent = recentScans.length > 0 || pantryItems.length > 0;

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
        keyboardDismissMode="on-drag"
      >
        {/* 1. Recall alert — highest priority, always first (D-125: free) */}
        {recalledItems.length > 0 && activePet && (
          <TouchableOpacity
            style={styles.recallCard}
            onPress={navigateToPantry}
            activeOpacity={0.7}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={SEVERITY_COLORS.danger}
            />
            <Text style={styles.recallCardBody} numberOfLines={2}>
              {recalledItems.length} recalled product
              {recalledItems.length !== 1 ? 's' : ''} in{' '}
              {activePet.name}&apos;s pantry
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        )}

        {/* 2. Search bar — premium: real input; free: tappable facade → paywall */}
        <View style={styles.searchBarContainer}>
          {canSearch() ? (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search pet food products..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={() => setIsSearchFocused(true)}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchLoading && <ActivityIndicator size="small" color={Colors.accent} />}
              {searchQuery.length > 0 && !searchLoading && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.searchBar}
              onPress={handleSearchBarPress}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.searchPlaceholder}>Search pet food products...</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Browse categories — always visible */}
        <View style={styles.categoryGrid}>
          {BROWSE_CATEGORIES.map((cat) => {
            const selected = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryCard,
                  selected && {
                    borderColor: cat.tint,
                    backgroundColor: `${cat.tint}26`,
                  },
                ]}
                onPress={() => handleCategoryTap(cat.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon} size={28} color={selected ? cat.tint : Colors.textTertiary} />
                <Text style={[styles.categoryLabel, selected && { color: cat.tint }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3b. Sub-filter chips — shown below category grid when a category is active */}
        {activeCategory && (
          <SubFilterChipRow
            filters={SUB_FILTERS[activeCategory]}
            activeKey={activeSubFilter}
            onSelect={handleSubFilterSelect}
          />
        )}


        {/* 4. Search results — shown when search active */}
        {isSearchActive && (
          <View style={styles.searchResultsContainer}>
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <TouchableOpacity
                  key={item.product_id}
                  style={styles.searchResultRow}
                  onPress={() => handleSearchResultTap(item)}
                  activeOpacity={0.7}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.searchResultImage} />
                  ) : (
                    <View style={[styles.searchResultImage, styles.searchResultImagePlaceholder]}>
                      <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultBrand} numberOfLines={1}>
                      {sanitizeBrand(item.brand)}
                    </Text>
                    <Text style={styles.searchResultName} numberOfLines={2}>
                      {stripBrandFromName(item.brand, item.product_name)}
                    </Text>
                  </View>
                  {item.final_score != null ? (
                    <View
                      style={[
                        styles.scorePill,
                        { backgroundColor: `${getScoreColor(item.final_score, item.is_supplemental)}1A` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scorePillText,
                          { color: getScoreColor(item.final_score, item.is_supplemental) },
                        ]}
                      >
                        {item.final_score}%
                      </Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                  )}
                </TouchableOpacity>
              ))
            ) : searchLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.xl }} />
            ) : searchQuery.trim() ? (
              <View style={styles.searchEmptyState}>
                <Text style={styles.searchEmptyText}>
                  No products found for &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Normal content (hidden when search active) ── */}
        {!isSearchActive && (
          <>
            {/* 5. Top Picks carousel — hidden for vet diets (require veterinary oversight;
                 recommending them algorithmically is a liability) */}
            {activePet && activePetId &&
              activeSubFilter !== 'vet_diet' && (
              <TopPicksCarousel
                petId={activePetId}
                petName={activePet.name}
                species={activePet.species}
                activeCategory={activeCategory}
                activeSubFilter={activeSubFilter}
              />
            )}

            {/* 6. Upcoming appointment */}
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

            {/* Safe Switch status (M7, compact) */}
            {activeSwitchData && (
              <SafeSwitchBanner
                data={activeSwitchData}
                onPress={() => navigation.navigate('SafeSwitchDetail', { switchId: activeSwitchData.switch.id })}
                compact
              />
            )}

            {/* 7. Pantry nav row (carded — matches appointment row) */}
            {activePet && (
              <TouchableOpacity
                style={styles.pantryRow}
                onPress={navigateToPantry}
                activeOpacity={0.7}
              >
                <View style={styles.pantryRowAvatar}>
                  {activePet.photo_url ? (
                    <Image source={{ uri: activePet.photo_url }} style={styles.pantryRowPhoto} />
                  ) : (
                    <Ionicons name="paw-outline" size={12} color={Colors.accent} />
                  )}
                </View>
                <Text style={styles.pantryRowTitle} numberOfLines={1}>
                  {activePet.name}&apos;s Pantry
                </Text>
                {pantryItems.length > 0 ? (
                  <Text style={styles.pantryRowSubtitle}>
                    {pantryCategories.foods} food{pantryCategories.foods !== 1 ? 's' : ''} ·{' '}
                    {pantryCategories.treats} treat{pantryCategories.treats !== 1 ? 's' : ''}
                  </Text>
                ) : (
                  <Text style={styles.pantryRowSubtitle}>Start tracking</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* 7. Recent Scans — redesigned counter */}
            {recentScans.length > 0 && activePet && (
              <View style={styles.recentScansSection}>
                <View style={styles.recentScansHeader}>
                  <Text style={styles.recentScansTitle}>Recent Scans</Text>
                  {!premium && scanWindowInfo ? (
                    <View style={styles.scanCounterRow}>
                      <View style={[styles.scanCounterPill, { backgroundColor: `${scanCounterColor}20` }]}>
                        <Text style={[styles.scanCounterText, { color: scanCounterColor }]}>
                          {scanWindowInfo.count}/{Limits.freeScansPerWeek} this week
                        </Text>
                      </View>
                      <InfoTooltip text={scanTooltipText} size={14} />
                    </View>
                  ) : (
                    <Text style={styles.recentScansWeekly}>
                      {weeklyCount} this week
                    </Text>
                  )}
                </View>
                {recentScans.map((scan) => {
                  const scoreColor =
                    scan.final_score != null
                      ? getScoreColor(scan.final_score, scan.product.is_supplemental)
                      : null;

                  return (
                    <TouchableOpacity
                      key={scan.id}
                      style={styles.scanRow}
                      onPress={() => {
                        if (scan.product.is_recalled) {
                          navigation.navigate('RecallDetail', {
                            productId: scan.product_id,
                          });
                        } else {
                          navigation.navigate('Result', {
                            productId: scan.product_id,
                            petId: activePetId,
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {scan.product.image_url ? (
                        <Image
                          source={{ uri: scan.product.image_url }}
                          style={styles.scanRowImage}
                        />
                      ) : (
                        <View style={styles.scanRowImagePlaceholder}>
                          <Ionicons
                            name="cube-outline"
                            size={18}
                            color={Colors.textTertiary}
                          />
                        </View>
                      )}
                      <View style={styles.scanRowInfo}>
                        <Text style={styles.scanRowBrand} numberOfLines={1}>
                          {sanitizeBrand(scan.product.brand)}
                        </Text>
                        <Text style={styles.scanRowName} numberOfLines={2}>
                          {stripBrandFromName(scan.product.brand, scan.product.name)}
                        </Text>
                      </View>
                      {scoreColor ? (
                        <View
                          style={[
                            styles.scorePill,
                            { backgroundColor: `${scoreColor}1A` },
                          ]}
                        >
                          <Text style={[styles.scorePillText, { color: scoreColor }]}>
                            {scan.final_score}%
                          </Text>
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={Colors.textTertiary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 8. Empty state */}
            {!hasContent && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="camera-outline"
                  size={48}
                  color={Colors.textTertiary}
                  style={{ marginBottom: Spacing.md }}
                />
                <Text style={styles.emptyTitle}>Scan your first product</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the scan button below to check{'\n'}a pet food, treat, or
                  supplement.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────

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
    backgroundColor: `${SEVERITY_COLORS.danger}15`,
    borderLeftWidth: 3,
    borderLeftColor: SEVERITY_COLORS.danger,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallCardBody: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    lineHeight: 18,
  },

  // Search bar
  searchBarContainer: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    height: 44,
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    padding: 0,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textTertiary,
  },

  // Browse categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryCard: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Search results
  searchResultsContainer: {
    gap: Spacing.xs,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  searchResultImagePlaceholder: {
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    gap: 2,
  },
  searchResultBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  searchEmptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Appointment row
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
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

  // Pantry slim row
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  pantryRowAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B4D815',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pantryRowPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pantryRowTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pantryRowSubtitle: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  // Scan counter
  scanCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanCounterPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scanCounterText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },

  // Recent scans
  recentScansSection: {
    marginBottom: Spacing.md,
  },
  recentScansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recentScansTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recentScansWeekly: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scanRowImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  scanRowImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanRowInfo: {
    flex: 1,
    gap: 2,
  },
  scanRowBrand: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scanRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
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
```

---

### [formatters.ts](file:///Users/stevendiaz/kiba-antigravity/src/utils/formatters.ts)

Added `sanitizeBrand()` utility:

```typescript
export function sanitizeBrand(brand: string): string {
  if (!brand || !brand.includes('||')) return brand;
  return brand.split('||').map((b) => b.trim()).filter(Boolean).join(' · ');
}
```

- Interpunct join chosen over first-brand-only to preserve search result trust
- `"Milk-Bone||Purina Beneful"` → `"Milk-Bone · Purina Beneful"`

```diff:formatters.ts
// Formatting utilities for display names and product titles.
// - toDisplayName: canonical_name (snake_case) → user-facing Title Case
// - stripBrandFromName: remove redundant brand prefix from product name

/** Known abbreviations that should remain fully uppercase. */
const UPPERCASE_WORDS = new Set([
  'bha', 'bht', 'tbhq', 'dha', 'epa', 'aafco', 'nfe',
]);

/**
 * Convert a canonical_name (snake_case) to a human-readable display name.
 * - Splits on underscores
 * - Capitalizes first letter of each word
 * - Known abbreviations stay fully uppercase (BHA, DHA, etc.)
 * - Numbers stay as-is (yellow_6 → "Yellow 6")
 *
 * Falls back to display_name if available on the ingredient object.
 */
export function toDisplayName(canonicalName: string): string {
  return canonicalName
    .split('_')
    .map((word) => {
      if (UPPERCASE_WORDS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Resolve life stage claim to species-appropriate display label.
 * "puppy/kitten" → "Puppy" (dog) or "Kitten" (cat).
 */
export function resolveLifeStageLabel(
  lifeStageClaim: string,
  targetSpecies: 'dog' | 'cat',
): string {
  const trimmed = lifeStageClaim.trim().toLowerCase();

  if (trimmed === 'puppy/kitten' || trimmed === 'puppy / kitten') {
    return targetSpecies === 'dog' ? 'Puppy' : 'Kitten';
  }
  if (trimmed === 'puppy') return 'Puppy';
  if (trimmed === 'kitten') return 'Kitten';
  if (trimmed === 'all life stages') return 'All Life Stages';
  if (trimmed === 'adult maintenance' || trimmed === 'adult') return 'Adult';
  if (trimmed === 'growth') return 'Growth';

  // Fallback: title case, truncate at 20 chars
  const titleCased = lifeStageClaim.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCased.length > 20 ? titleCased.slice(0, 20) + '\u2026' : titleCased;
}

/**
 * Strip redundant brand prefix from product name.
 * Two-pass: (1) exact prefix match, (2) brand found within first 40 chars
 * (handles parent brand patterns like "Purina Cat Chow ...").
 * Word-boundary checked. Returns original name if remainder would be < 10 chars.
 */
export function stripBrandFromName(brandName: string, productName: string): string {
  if (!brandName || !productName) return productName;
  const lower = productName.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Pass 1: exact prefix match at position 0
  if (lower.startsWith(brandLower)) {
    const remainder = productName.slice(brandName.length).replace(/^[\s\-\u2013\u2014]+/, '');
    if (remainder.length >= 10) return remainder;
    return productName;
  }

  // Pass 2: brand found within first 40 chars (parent brand prefix pattern)
  // Skip for very short brand names — too likely to false-match inside other words
  if (brandLower.length < 5) return productName;
  const searchZone = lower.slice(0, 40);
  const idx = searchZone.indexOf(brandLower);
  if (idx < 0) return productName;

  // Word boundary check: char before match must be space or start-of-string
  if (idx > 0 && searchZone[idx - 1] !== ' ') return productName;
  // Char after match must be space or end-of-string
  const afterIdx = idx + brandLower.length;
  if (afterIdx < lower.length && lower[afterIdx] !== ' ') return productName;

  const remainder = productName.slice(afterIdx).replace(/^[\s\-\u2013\u2014]+/, '');
  if (remainder.length < 10) return productName;
  return remainder;
}

// ─── Relative Time ────────────────────────────────────────

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format an ISO date string as a past-focused relative time.
 * "Just now" / "5m ago" / "2h ago" / "Yesterday" / "3d ago" / "Mar 15"
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60_000) return 'Just now';

  // Calendar-day comparison — check before hours so "yesterday at 11pm" isn't "1h ago"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff >= 2 && dayDiff <= 6) return `${dayDiff}d ago`;
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}
===
// Formatting utilities for display names and product titles.
// - toDisplayName: canonical_name (snake_case) → user-facing Title Case
// - stripBrandFromName: remove redundant brand prefix from product name

/** Known abbreviations that should remain fully uppercase. */
const UPPERCASE_WORDS = new Set([
  'bha', 'bht', 'tbhq', 'dha', 'epa', 'aafco', 'nfe',
]);

/**
 * Convert a canonical_name (snake_case) to a human-readable display name.
 * - Splits on underscores
 * - Capitalizes first letter of each word
 * - Known abbreviations stay fully uppercase (BHA, DHA, etc.)
 * - Numbers stay as-is (yellow_6 → "Yellow 6")
 *
 * Falls back to display_name if available on the ingredient object.
 */
export function toDisplayName(canonicalName: string): string {
  return canonicalName
    .split('_')
    .map((word) => {
      if (UPPERCASE_WORDS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Resolve life stage claim to species-appropriate display label.
 * "puppy/kitten" → "Puppy" (dog) or "Kitten" (cat).
 */
export function resolveLifeStageLabel(
  lifeStageClaim: string,
  targetSpecies: 'dog' | 'cat',
): string {
  const trimmed = lifeStageClaim.trim().toLowerCase();

  if (trimmed === 'puppy/kitten' || trimmed === 'puppy / kitten') {
    return targetSpecies === 'dog' ? 'Puppy' : 'Kitten';
  }
  if (trimmed === 'puppy') return 'Puppy';
  if (trimmed === 'kitten') return 'Kitten';
  if (trimmed === 'all life stages') return 'All Life Stages';
  if (trimmed === 'adult maintenance' || trimmed === 'adult') return 'Adult';
  if (trimmed === 'growth') return 'Growth';

  // Fallback: title case, truncate at 20 chars
  const titleCased = lifeStageClaim.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCased.length > 20 ? titleCased.slice(0, 20) + '\u2026' : titleCased;
}

/**
 * Strip redundant brand prefix from product name.
 * Two-pass: (1) exact prefix match, (2) brand found within first 40 chars
 * (handles parent brand patterns like "Purina Cat Chow ...").
 * Word-boundary checked. Returns original name if remainder would be < 10 chars.
 */
export function stripBrandFromName(brandName: string, productName: string): string {
  if (!brandName || !productName) return productName;
  const lower = productName.toLowerCase();
  const brandLower = brandName.toLowerCase();

  // Pass 1: exact prefix match at position 0
  if (lower.startsWith(brandLower)) {
    const remainder = productName.slice(brandName.length).replace(/^[\s\-\u2013\u2014]+/, '');
    if (remainder.length >= 10) return remainder;
    return productName;
  }

  // Pass 2: brand found within first 40 chars (parent brand prefix pattern)
  // Skip for very short brand names — too likely to false-match inside other words
  if (brandLower.length < 5) return productName;
  const searchZone = lower.slice(0, 40);
  const idx = searchZone.indexOf(brandLower);
  if (idx < 0) return productName;

  // Word boundary check: char before match must be space or start-of-string
  if (idx > 0 && searchZone[idx - 1] !== ' ') return productName;
  // Char after match must be space or end-of-string
  const afterIdx = idx + brandLower.length;
  if (afterIdx < lower.length && lower[afterIdx] !== ' ') return productName;

  const remainder = productName.slice(afterIdx).replace(/^[\s\-\u2013\u2014]+/, '');
  if (remainder.length < 10) return productName;
  return remainder;
}

// ─── Brand Sanitization ──────────────────────────────────

/**
 * Sanitize brand names containing raw database delimiters.
 * "Milk-Bone||Purina Beneful" → "Milk-Bone · Purina Beneful"
 * Preserves all brand names for search result accuracy.
 */
export function sanitizeBrand(brand: string): string {
  if (!brand || !brand.includes('||')) return brand;
  return brand.split('||').map((b) => b.trim()).filter(Boolean).join(' · ');
}

// ─── Relative Time ────────────────────────────────────────

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format an ISO date string as a past-focused relative time.
 * "Just now" / "5m ago" / "2h ago" / "Yesterday" / "3d ago" / "Mar 15"
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60_000) return 'Just now';

  // Calendar-day comparison — check before hours so "yesterday at 11pm" isn't "1h ago"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff >= 2 && dayDiff <= 6) return `${dayDiff}d ago`;
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}
```

---

### [topMatches.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/topMatches.ts)

Extended `searchProducts()` to support score enrichment:

- Added `final_score: number | null` and `is_supplemental: boolean` to `ProductSearchResult` type
- Added optional `petId` parameter to `searchProducts()`
- When `petId` provided: queries `pet_product_scores` for matching product IDs and enriches results with `final_score`
- Backward compatible: 2 other consumers (`useTopMatchesStore`, `CompareProductPickerSheet`) don't pass `petId` and get `null` scores by default

```diff:topMatches.ts
// M5 Top Matches Service — Cache freshness, query, and batch trigger.
// Phase 3 of TOP_MATCHES_PLAN.md: lazy invalidation + cache queries.
// No store sync — deferred to useTopMatchesStore (Phase 5).

import { supabase } from './supabase';
import type { Pet } from '../types/pet';
import { deriveLifeStage, parseDateString } from '../utils/lifeStage';
import { CURRENT_SCORING_VERSION } from '../utils/constants';

// ─── Types ──────────────────────────────────────────────

export interface CachedScore {
  product_id: string;
  final_score: number;
  is_partial_score: boolean;
  is_supplemental: boolean;
  category: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
}

interface CachedRow {
  life_stage_at_scoring: string | null;
  pet_updated_at: string;
  pet_health_reviewed_at: string | null;
  scoring_version: string;
}

interface FetchFilters {
  category?: 'daily_food' | 'treat';
  searchQuery?: string;
}

// ─── Cache Freshness ────────────────────────────────────

/**
 * Sample one cached row for this pet and check 5 invalidation conditions.
 * Returns false (stale) if any check fails. Returns true only if all pass.
 */
export async function checkCacheFreshness(pet: Pet): Promise<boolean> {
  const { data, error } = await supabase
    .from('pet_product_scores')
    .select('life_stage_at_scoring, pet_updated_at, pet_health_reviewed_at, scoring_version')
    .eq('pet_id', pet.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const cached = data as CachedRow;

  // 1. Life stage drift
  const currentLifeStage = pet.date_of_birth
    ? deriveLifeStage(
        (() => {
          const p = parseDateString(pet.date_of_birth!);
          return new Date(p.year, p.month, p.day);
        })(),
        pet.species,
        pet.breed_size,
      )
    : null;

  if (currentLifeStage !== cached.life_stage_at_scoring) return false;

  // 2. Profile edit
  if (pet.updated_at > cached.pet_updated_at) return false;

  // 3. Health update
  if (
    pet.health_reviewed_at != null &&
    pet.health_reviewed_at > (cached.pet_health_reviewed_at ?? '')
  ) return false;

  // 4. Engine version
  if (cached.scoring_version !== CURRENT_SCORING_VERSION) return false;

  return true;
}

// ─── Fetch Top Matches ──────────────────────────────────

/**
 * Query cached scores for a pet, joined with product display data.
 * Optional category filter and client-side text search.
 */
export async function fetchTopMatches(
  petId: string,
  filters?: FetchFilters,
): Promise<CachedScore[]> {
  let query = supabase
    .from('pet_product_scores')
    .select('product_id, final_score, is_partial_score, is_supplemental, category, products(name, brand, image_url, product_form)')
    .eq('pet_id', petId)
    .order('final_score', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const rows = (data as Record<string, unknown>[]).map((row) => {
    const product = row.products as { name: string; brand: string; image_url: string | null; product_form: string | null } | null;
    return {
      product_id: row.product_id as string,
      final_score: row.final_score as number,
      is_partial_score: row.is_partial_score as boolean,
      is_supplemental: row.is_supplemental as boolean,
      category: row.category as string,
      product_name: product?.name ?? '',
      brand: product?.brand ?? '',
      image_url: product?.image_url ?? null,
      product_form: product?.product_form ?? null,
    };
  });

  // Client-side text search
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    return rows.filter(
      r => r.product_name.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }

  return rows;
}

// ─── Direct Product Search ──────────────────────────────

export interface ProductSearchResult {
  product_id: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  category: string;
}

/**
 * Search products table directly by name/brand.
 * Independent of batch-score cache — works even when pet_product_scores is empty.
 */
export async function searchProducts(
  query: string,
  species: 'dog' | 'cat',
  filters?: {
    category?: 'daily_food' | 'treat';
    productForm?: string;
    isSupplemental?: boolean;
  },
): Promise<ProductSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed && !filters?.category) return [];

  let q = supabase
    .from('products')
    .select('id, name, brand, image_url, product_form, category, is_supplemental')
    .eq('target_species', species)
    .eq('is_vet_diet', false)
    .eq('is_recalled', false)
    .eq('is_variety_pack', false)
    .neq('category', 'supplement');

  if (trimmed) {
    const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
    q = q.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`);
  }

  q = q.order('name', { ascending: true }).limit(50);

  if (filters?.category) {
    q = q.eq('category', filters.category);
  }

  if (filters?.productForm) {
    if (filters.productForm === 'freeze_dried') {
      q = q.in('product_form', ['freeze_dried', 'freeze-dried']);
    } else if (filters.productForm === 'other') {
      q = q.not('product_form', 'in', '("dry","wet","freeze_dried","freeze-dried")');
    } else {
      q = q.eq('product_form', filters.productForm);
    }
  }

  if (filters?.isSupplemental !== undefined) {
    q = q.eq('is_supplemental', filters.isSupplemental);
  }

  const { data, error } = await q;

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    product_id: row.id as string,
    product_name: row.name as string,
    brand: row.brand as string,
    image_url: (row.image_url as string) ?? null,
    product_form: (row.product_form as string) ?? null,
    category: row.category as string,
  }));
}

===
// M5 Top Matches Service — Cache freshness, query, and batch trigger.
// Phase 3 of TOP_MATCHES_PLAN.md: lazy invalidation + cache queries.
// No store sync — deferred to useTopMatchesStore (Phase 5).

import { supabase } from './supabase';
import type { Pet } from '../types/pet';
import { deriveLifeStage, parseDateString } from '../utils/lifeStage';
import { CURRENT_SCORING_VERSION } from '../utils/constants';

// ─── Types ──────────────────────────────────────────────

export interface CachedScore {
  product_id: string;
  final_score: number;
  is_partial_score: boolean;
  is_supplemental: boolean;
  category: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
}

interface CachedRow {
  life_stage_at_scoring: string | null;
  pet_updated_at: string;
  pet_health_reviewed_at: string | null;
  scoring_version: string;
}

interface FetchFilters {
  category?: 'daily_food' | 'treat';
  searchQuery?: string;
}

// ─── Cache Freshness ────────────────────────────────────

/**
 * Sample one cached row for this pet and check 5 invalidation conditions.
 * Returns false (stale) if any check fails. Returns true only if all pass.
 */
export async function checkCacheFreshness(pet: Pet): Promise<boolean> {
  const { data, error } = await supabase
    .from('pet_product_scores')
    .select('life_stage_at_scoring, pet_updated_at, pet_health_reviewed_at, scoring_version')
    .eq('pet_id', pet.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;

  const cached = data as CachedRow;

  // 1. Life stage drift
  const currentLifeStage = pet.date_of_birth
    ? deriveLifeStage(
        (() => {
          const p = parseDateString(pet.date_of_birth!);
          return new Date(p.year, p.month, p.day);
        })(),
        pet.species,
        pet.breed_size,
      )
    : null;

  if (currentLifeStage !== cached.life_stage_at_scoring) return false;

  // 2. Profile edit
  if (pet.updated_at > cached.pet_updated_at) return false;

  // 3. Health update
  if (
    pet.health_reviewed_at != null &&
    pet.health_reviewed_at > (cached.pet_health_reviewed_at ?? '')
  ) return false;

  // 4. Engine version
  if (cached.scoring_version !== CURRENT_SCORING_VERSION) return false;

  return true;
}

// ─── Fetch Top Matches ──────────────────────────────────

/**
 * Query cached scores for a pet, joined with product display data.
 * Optional category filter and client-side text search.
 */
export async function fetchTopMatches(
  petId: string,
  filters?: FetchFilters,
): Promise<CachedScore[]> {
  let query = supabase
    .from('pet_product_scores')
    .select('product_id, final_score, is_partial_score, is_supplemental, category, products(name, brand, image_url, product_form)')
    .eq('pet_id', petId)
    .order('final_score', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const rows = (data as Record<string, unknown>[]).map((row) => {
    const product = row.products as { name: string; brand: string; image_url: string | null; product_form: string | null } | null;
    return {
      product_id: row.product_id as string,
      final_score: row.final_score as number,
      is_partial_score: row.is_partial_score as boolean,
      is_supplemental: row.is_supplemental as boolean,
      category: row.category as string,
      product_name: product?.name ?? '',
      brand: product?.brand ?? '',
      image_url: product?.image_url ?? null,
      product_form: product?.product_form ?? null,
    };
  });

  // Client-side text search
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    return rows.filter(
      r => r.product_name.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }

  return rows;
}

// ─── Direct Product Search ──────────────────────────────

export interface ProductSearchResult {
  product_id: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_form: string | null;
  category: string;
  final_score: number | null;
  is_supplemental: boolean;
}

/**
 * Search products table directly by name/brand.
 * Independent of batch-score cache — works even when pet_product_scores is empty.
 */
export async function searchProducts(
  query: string,
  species: 'dog' | 'cat',
  filters?: {
    category?: 'daily_food' | 'treat';
    productForm?: string;
    isSupplemental?: boolean;
  },
  petId?: string,
): Promise<ProductSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed && !filters?.category) return [];

  let q = supabase
    .from('products')
    .select('id, name, brand, image_url, product_form, category, is_supplemental')
    .eq('target_species', species)
    .eq('is_vet_diet', false)
    .eq('is_recalled', false)
    .eq('is_variety_pack', false)
    .neq('category', 'supplement');

  if (trimmed) {
    const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_');
    q = q.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`);
  }

  q = q.order('name', { ascending: true }).limit(50);

  if (filters?.category) {
    q = q.eq('category', filters.category);
  }

  if (filters?.productForm) {
    if (filters.productForm === 'freeze_dried') {
      q = q.in('product_form', ['freeze_dried', 'freeze-dried']);
    } else if (filters.productForm === 'other') {
      q = q.not('product_form', 'in', '("dry","wet","freeze_dried","freeze-dried")');
    } else {
      q = q.eq('product_form', filters.productForm);
    }
  }

  if (filters?.isSupplemental !== undefined) {
    q = q.eq('is_supplemental', filters.isSupplemental);
  }

  const { data, error } = await q;

  if (error || !data) return [];

  const results = (data as Record<string, unknown>[]).map((row) => ({
    product_id: row.id as string,
    product_name: row.name as string,
    brand: row.brand as string,
    image_url: (row.image_url as string) ?? null,
    product_form: (row.product_form as string) ?? null,
    category: row.category as string,
    is_supplemental: (row.is_supplemental as boolean) ?? false,
    final_score: null as number | null,
  }));

  // Enrich with cached scores if petId provided
  if (petId && results.length > 0) {
    const productIds = results.map((r) => r.product_id);
    const { data: scores } = await supabase
      .from('pet_product_scores')
      .select('product_id, final_score')
      .eq('pet_id', petId)
      .in('product_id', productIds);

    if (scores) {
      const scoreMap = new Map<string, number>();
      for (const s of scores as { product_id: string; final_score: number }[]) {
        scoreMap.set(s.product_id, s.final_score);
      }
      for (const r of results) {
        r.final_score = scoreMap.get(r.product_id) ?? null;
      }
    }
  }

  return results;
}

```

---

### [SubFilterChipRow.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/browse/SubFilterChipRow.tsx)

- `filterIcon`: `Colors.cardSurface` + border → `#1C1C1E` solid fill, no border
- `chipInactive`: `Colors.cardSurface` + border → `#1C1C1E` solid fill, no border

```diff:SubFilterChipRow.tsx
// SubFilterChipRow — horizontal scrollable filter chips for category browse.
// Pattern follows PantryScreen chip row. Tap to toggle, tap again to deselect.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { SubFilterDef } from '../../types/categoryBrowse';

interface Props {
  filters: SubFilterDef[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  counts?: Record<string, number>;
}

export function SubFilterChipRow({ filters, activeKey, onSelect, counts }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.filterIcon}>
          <Ionicons name="options-outline" size={18} color={Colors.textSecondary} />
        </View>
        {filters.map((f) => {
          const selected = activeKey === f.key;
          const count = counts?.[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, selected ? styles.chipActive : styles.chipInactive]}
              onPress={() => onSelect(selected ? null : f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : styles.chipTextInactive]}>
                {f.label}
              </Text>
              {count !== undefined && (
                <Text style={[styles.chipCount, selected ? styles.chipCountActive : styles.chipCountInactive]}>
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.accent,
  },
  chipInactive: {
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: Colors.textSecondary,
  },
  chipCount: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  chipCountInactive: {
    color: Colors.textTertiary,
  },
});
===
// SubFilterChipRow — horizontal scrollable filter chips for category browse.
// Pattern follows PantryScreen chip row. Tap to toggle, tap again to deselect.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { SubFilterDef } from '../../types/categoryBrowse';

interface Props {
  filters: SubFilterDef[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  counts?: Record<string, number>;
}

export function SubFilterChipRow({ filters, activeKey, onSelect, counts }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.filterIcon}>
          <Ionicons name="options-outline" size={18} color={Colors.textSecondary} />
        </View>
        {filters.map((f) => {
          const selected = activeKey === f.key;
          const count = counts?.[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, selected ? styles.chipActive : styles.chipInactive]}
              onPress={() => onSelect(selected ? null : f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : styles.chipTextInactive]}>
                {f.label}
              </Text>
              {count !== undefined && (
                <Text style={[styles.chipCount, selected ? styles.chipCountActive : styles.chipCountInactive]}>
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.accent,
  },
  chipInactive: {
    backgroundColor: '#1C1C1E',
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: Colors.textSecondary,
  },
  chipCount: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  chipCountInactive: {
    color: Colors.textTertiary,
  },
});
```

---

### [navigation.ts](file:///Users/stevendiaz/kiba-antigravity/src/types/navigation.ts)

Added optional `subFilter?: string` to `CategoryBrowse` route params so the Top Picks carousel "See All" can forward the active sub-filter.

```diff:navigation.ts
// Kiba — Navigation Type Definitions
// Typed param lists for React Navigation 7.x stack navigators

// ─── Stack Param Lists ─────────────────────────────────

export type ScanStackParamList = {
  ScanMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  CommunityContribution: { scannedUpc: string };
  ProductConfirm: {
    scannedUpc: string;
    externalName: string | null;
    externalBrand: string | null;
    externalImageUrl: string | null;
  };
  IngredientCapture: {
    scannedUpc: string;
    productName: string | null;
    brand: string | null;
  };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  CategoryBrowse: { category: import('./categoryBrowse').BrowseCategory; petId: string };
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  AppointmentDetail: { appointmentId: string };
  Compare: { productAId: string; productBId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  EditPantryItem: { itemId: string };
  SafeSwitchSetup: { oldProductId: string; newProductId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };
  SpeciesSelect: undefined;
  CreatePet: { species: 'dog' | 'cat' };
  EditPet: { petId: string };
  HealthConditions: { petId: string; fromCreate?: boolean };
  MedicationForm: {
    petId: string;
    petName: string;
    medication?: import('./pet').PetMedication;
    conditions: string[];
  };
  BCSReference: { petId: string };
  Medications: undefined;
  MedicalRecords: undefined;
  Appointments: undefined;
  CreateAppointment: undefined;
  AppointmentDetail: { appointmentId: string };
  NotificationPreferences: undefined;
  Settings: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

// ─── Paywall Trigger ─────────────────────────────────

export type PaywallTrigger =
  | 'scan_limit'
  | 'pet_limit'
  | 'safe_swap'
  | 'search'
  | 'compare'
  | 'vet_report'
  | 'elimination_diet'
  | 'appointment_limit';

// ─── Root & Tab Navigators ─────────────────────────────

export type RootStackParamList = {
  Terms: undefined;
  Onboarding: undefined;
  Main: undefined;
  Paywall: { trigger: PaywallTrigger; petName?: string };
};

export type TabParamList = {
  Home: undefined;
  Community: undefined;
  Scan: undefined;
  Pantry: undefined;
  Me: undefined;
};
===
// Kiba — Navigation Type Definitions
// Typed param lists for React Navigation 7.x stack navigators

// ─── Stack Param Lists ─────────────────────────────────

export type ScanStackParamList = {
  ScanMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  CommunityContribution: { scannedUpc: string };
  ProductConfirm: {
    scannedUpc: string;
    externalName: string | null;
    externalBrand: string | null;
    externalImageUrl: string | null;
  };
  IngredientCapture: {
    scannedUpc: string;
    productName: string | null;
    brand: string | null;
  };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  CategoryBrowse: { category: import('./categoryBrowse').BrowseCategory; petId: string; subFilter?: string };
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  AppointmentDetail: { appointmentId: string };
  Compare: { productAId: string; productBId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  EditPantryItem: { itemId: string };
  SafeSwitchSetup: { oldProductId: string; newProductId: string; petId: string };
  SafeSwitchDetail: { switchId: string };
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };
  SpeciesSelect: undefined;
  CreatePet: { species: 'dog' | 'cat' };
  EditPet: { petId: string };
  HealthConditions: { petId: string; fromCreate?: boolean };
  MedicationForm: {
    petId: string;
    petName: string;
    medication?: import('./pet').PetMedication;
    conditions: string[];
  };
  BCSReference: { petId: string };
  Medications: undefined;
  MedicalRecords: undefined;
  Appointments: undefined;
  CreateAppointment: undefined;
  AppointmentDetail: { appointmentId: string };
  NotificationPreferences: undefined;
  Settings: undefined;
  Result: { productId: string; petId: string | null };
  RecallDetail: { productId: string };
  Compare: { productAId: string; productBId: string; petId: string };
};

// ─── Paywall Trigger ─────────────────────────────────

export type PaywallTrigger =
  | 'scan_limit'
  | 'pet_limit'
  | 'safe_swap'
  | 'search'
  | 'compare'
  | 'vet_report'
  | 'elimination_diet'
  | 'appointment_limit';

// ─── Root & Tab Navigators ─────────────────────────────

export type RootStackParamList = {
  Terms: undefined;
  Onboarding: undefined;
  Main: undefined;
  Paywall: { trigger: PaywallTrigger; petName?: string };
};

export type TabParamList = {
  Home: undefined;
  Community: undefined;
  Scan: undefined;
  Pantry: undefined;
  Me: undefined;
};
```

---

### [categoryBrowseService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/categoryBrowseService.ts)

No net changes — overfetch multiplier change was reverted after it caused a regression. The fix for filtered Top Picks was moved to the carousel's fetch limit instead.

---

## Files Created (1)

### [NEW] [TopPicksCarousel.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/browse/TopPicksCarousel.tsx)

New horizontal scrolling carousel component (320 lines):

- **Data:** Fetches from `fetchCategoryTopPicks()` with `FETCH_LIMIT = 50` (overfetch for post-query filter survival), displays `DISPLAY_LIMIT = 10`
- **Card design:** `width: 160` → 2 full cards + 20% peek of 3rd card on ~390px iPhone screen (peek = subconscious swipe affordance). `showsHorizontalScrollIndicator={false}`
- **Card anatomy:** Product image (80×80), sanitized brand (gray), product name (2 lines, white), score pill (`1A` opacity background)
- **Zero-state:** Full-width CTA card ("Unlock [Pet]'s Top Picks" + "Scan a Product" button → Scan tab). Only shown on true cold start (no sub-filter/non-default category active) — prevents misleading CTA when a filter just yields empty results
- **Vet diet guard:** Carousel hidden entirely when `activeSubFilter === 'vet_diet'` (unscored, liability)
- **Section header:** "Top Picks for [Pet Name]" with "See All ›" → `CategoryBrowse` screen

---

## Verification

| Check | Result |
|-------|--------|
| Unit tests | **1,320 passing** / 61 suites ✅ |
| TypeScript | **Clean** (0 new errors; 11 pre-existing in Deno Edge Functions) ✅ |
| Backward compat | `searchProducts()` consumers verified safe — 2 other callers don't pass `petId` ✅ |
| Stale closure | Fixed `handleSearchChange` missing `activePetId` dep ✅ |
| Jitter prevention | Transparent border trick verified in styles ✅ |

## Known Issues

- **Carousel filter overfetch:** With highly filtered sub-categories (e.g. freeze-dried ≈ 11% of daily food), the carousel fetches 50 items via `fetchCategoryTopPicks` to ensure the 3x overfetch in `fetchScoredResults` captures enough results. If a sub-filter still yields 0 results, the carousel hides silently instead of showing the misleading "Scan a Product" CTA.
