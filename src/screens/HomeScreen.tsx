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
import { CATEGORY_ICONS, CATEGORY_ICONS_FILLED } from '../constants/iconMaps';
import { canSearch, isPremium, getScanWindowInfo } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getUpcomingAppointments } from '../services/appointmentService';
import { getRecentScans } from '../services/scanHistoryService';
import { searchProducts, ensureCacheFresh } from '../services/topMatches';
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
import { useBookmarkStore } from '../stores/useBookmarkStore';
import { fetchBookmarkCards } from '../services/bookmarkService';
import type { BookmarkCardData } from '../types/bookmark';

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
  tint: string;
}[] = [
  { key: 'daily_food', label: 'Daily Food', tint: Colors.accent },
  { key: 'toppers_mixers', label: 'Toppers & Mixers', tint: '#14B8A6' },
  { key: 'treat', label: 'Treats', tint: Colors.severityAmber },
  { key: 'supplement', label: 'Supplements', tint: '#A78BFA' },
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

  const bookmarkIds = useBookmarkStore((s) =>
    s.bookmarks.map((b) => b.id).join(','),
  );
  const loadBookmarks = useBookmarkStore((s) => s.loadForPet);
  const [bookmarkCards, setBookmarkCards] = useState<BookmarkCardData[]>([]);

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

  // ── Bookmark loading ──
  useEffect(() => {
    loadBookmarks(activePetId);
  }, [activePetId, loadBookmarks]);

  useEffect(() => {
    if (!activePet) {
      setBookmarkCards([]);
      return;
    }
    void fetchBookmarkCards(activePet).then((cards) => setBookmarkCards(cards.slice(0, 3)));
  }, [activePet, bookmarkIds]);

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

      // Ensure cached scores are fresh (invalidate stale + re-score via Edge Function).
      // Fire-and-forget — scoring completes in background before user searches/browses.
      const currentPet = pets.find((p) => p.id === activePetId);
      if (currentPet) {
        ensureCacheFresh(activePetId, currentPet).catch(() => {});
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
          if (activeSubFilter === 'vet_diet') {
            filters.isVetDiet = true;
            filters.isSupplemental = undefined; // vet diets can be supplemental or not
          } else if (activeSubFilter === 'other') {
            filters.productForm = 'other';
          } else if (activeSubFilter) {
            filters.productForm = activeSubFilter;
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
          activePet ?? undefined);
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
                    borderWidth: 2,
                    backgroundColor: `${cat.tint}26`,
                  },
                ]}
                onPress={() => handleCategoryTap(cat.key)}
                activeOpacity={0.7}
              >
                <Image
                  source={selected ? CATEGORY_ICONS_FILLED[cat.key] : CATEGORY_ICONS[cat.key]}
                  style={{ width: 56, height: 56, tintColor: selected ? cat.tint : Colors.textTertiary }}
                  resizeMode="contain"
                />
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

            {/* 6. Bookmarks (hidden when empty) */}
            {bookmarkCards.length > 0 && activePet && (
              <View style={styles.bookmarksSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.recentScansTitle}>Bookmarks</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Bookmarks')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="See all bookmarks"
                  >
                    <Text style={styles.seeAllLink}>See all ›</Text>
                  </TouchableOpacity>
                </View>
                {bookmarkCards.map((card) => {
                  const scoreColor =
                    card.final_score != null
                      ? getScoreColor(card.final_score, card.product.is_supplemental)
                      : null;
                  return (
                    <TouchableOpacity
                      key={card.bookmark.id}
                      style={[styles.scanRow, card.product.is_recalled && styles.rowRecalled]}
                      onPress={() => {
                        if (card.product.is_recalled) {
                          navigation.navigate('RecallDetail', { productId: card.product.id });
                        } else {
                          navigation.navigate('Result', {
                            productId: card.product.id,
                            petId: activePetId,
                          });
                        }
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel={
                        card.final_score != null && activePet
                          ? `${card.final_score}% match for ${activePet.name}, ${card.product.brand} ${card.product.name}`
                          : `${card.product.brand} ${card.product.name}${card.product.is_recalled ? ', recalled product' : ''}`
                      }
                    >
                      {card.product.image_url ? (
                        <Image source={{ uri: card.product.image_url }} style={styles.scanRowImage} />
                      ) : (
                        <View style={styles.scanRowImagePlaceholder}>
                          <Ionicons name="cube-outline" size={18} color={Colors.textTertiary} />
                        </View>
                      )}
                      <View style={styles.scanRowInfo}>
                        <Text style={styles.scanRowBrand} numberOfLines={1}>
                          {sanitizeBrand(card.product.brand)}
                        </Text>
                        <Text style={styles.scanRowName} numberOfLines={2}>
                          {stripBrandFromName(card.product.brand, card.product.name)}
                        </Text>
                      </View>
                      {scoreColor ? (
                        <View style={[styles.scorePill, { backgroundColor: `${scoreColor}1A` }]}>
                          <Text style={[styles.scorePillText, { color: scoreColor }]}>
                            {card.final_score}%
                          </Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 7. Recent Scans — redesigned counter */}
            {recentScans.length > 0 && activePet && (
              <View style={styles.recentScansSection}>
                <View style={styles.recentScansHeader}>
                  <Text style={styles.recentScansTitle}>Recent Scans</Text>
                  <View style={styles.recentScansHeaderRight}>
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
                      <Text style={styles.recentScansWeekly}>{weeklyCount} this week</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ScanHistory')}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="See all recent scans"
                    >
                      <Text style={styles.seeAllLink}>See all ›</Text>
                    </TouchableOpacity>
                  </View>
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
    backgroundColor: Colors.cardSurface,
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
  recentScansHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
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

  // Bookmarks section
  bookmarksSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  seeAllLink: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
  rowRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.severityRed,
    paddingLeft: Spacing.md - 3,
  },
});
