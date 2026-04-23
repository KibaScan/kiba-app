// Kiba — Home Dashboard v2
// Search bar, browse categories, recall alerts, slim pantry row, scan activity.
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { BookmarksFullError, BookmarkOfflineError } from '../types/bookmark';
import { BookmarkToggleSheet } from '../components/common/BookmarkToggleSheet';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, FontSizes, Spacing } from '../utils/constants';
import { canSearch, isPremium, getScanWindowInfo } from '../utils/permissions';
import { useActivePetStore } from '../stores/useActivePetStore';
import { usePantryStore } from '../stores/usePantryStore';
import { getUpcomingAppointments } from '../services/appointmentService';
import { getRecentScans } from '../services/scanHistoryService';
import { searchProducts, ensureCacheFresh } from '../services/topMatches';
import { supabase } from '../services/supabase';
import type { ProductSearchResult } from '../services/topMatches';
import type { Appointment } from '../types/appointment';
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
import { RecallBanner } from '../components/home/RecallBanner';
import { HomeEmptyState } from '../components/home/HomeEmptyState';
import { AppointmentRow } from '../components/home/AppointmentRow';
import { PantryNavRow } from '../components/home/PantryNavRow';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { HomeSearchBar } from '../components/home/HomeSearchBar';
import { SearchResultsList } from '../components/home/SearchResultsList';
import { BookmarksSection } from '../components/home/BookmarksSection';
import { RecentScansSection } from '../components/home/RecentScansSection';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

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

  // ── Long-press bookmark state ──
  const [longPressTarget, setLongPressTarget] = useState<{ productId: string } | null>(null);

  const longPressIsBookmarked = useBookmarkStore((s) =>
    longPressTarget && activePetId ? s.isBookmarked(activePetId, longPressTarget.productId) : false,
  );

  const longPressToggle = useBookmarkStore((s) => s.toggle);

  const handleLongPressToggle = async () => {
    if (!activePetId || !longPressTarget) return;
    try {
      await longPressToggle(activePetId, longPressTarget.productId);
    } catch (err) {
      if (err instanceof BookmarksFullError) {
        Alert.alert('Bookmarks full', 'Remove one to save another.');
      } else if (err instanceof BookmarkOfflineError) {
        Alert.alert('Offline', 'Bookmarks can be added once you are back online.');
      }
    }
  };

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

  const handleScanPress = useCallback((productId: string, isRecalled: boolean) => {
    if (isRecalled) {
      navigation.navigate('RecallDetail', { productId });
    } else {
      navigation.navigate('Result', { productId, petId: activePetId });
    }
  }, [navigation, activePetId]);

  const handleBookmarkCardPress = useCallback((productId: string, isRecalled: boolean) => {
    if (isRecalled) {
      navigation.navigate('RecallDetail', { productId });
    } else {
      navigation.navigate('Result', { productId, petId: activePetId });
    }
  }, [navigation, activePetId]);

  const handleScanLongPress = useCallback((productId: string) => {
    setLongPressTarget({ productId });
  }, []);

  // ── Render ──

  const hasContent = recentScans.length > 0 || pantryItems.length > 0;
  const searchEnabled = canSearch();

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
          <RecallBanner
            count={recalledItems.length}
            petName={activePet.name}
            onPress={navigateToPantry}
          />
        )}

        {/* 2. Search bar — premium: real input; free: tappable facade → paywall */}
        <HomeSearchBar
          canSearch={searchEnabled}
          searchQuery={searchQuery}
          searchLoading={searchLoading}
          onChangeText={handleSearchChange}
          onFocus={() => setIsSearchFocused(true)}
          onClear={clearSearch}
          onFacadePress={handleSearchBarPress}
        />

        {/* 3. Browse categories — always visible */}
        <CategoryGrid
          activeCategory={activeCategory}
          onCategoryTap={handleCategoryTap}
        />

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
          <SearchResultsList
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchQuery={searchQuery}
            petName={activePet?.name ?? ''}
            onResultTap={handleSearchResultTap}
          />
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
              <AppointmentRow
                type={nextAppointment.type}
                petName={appointmentPetName}
                scheduledAt={nextAppointment.scheduled_at}
                onPress={() =>
                  navigation.navigate('AppointmentDetail', {
                    appointmentId: nextAppointment.id,
                  })
                }
              />
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
              <PantryNavRow
                petName={activePet.name}
                photoUrl={activePet.photo_url}
                foodCount={pantryCategories.foods}
                treatCount={pantryCategories.treats}
                hasItems={pantryItems.length > 0}
                onPress={navigateToPantry}
              />
            )}

            {/* 6. Bookmarks (hidden when empty) */}
            {bookmarkCards.length > 0 && activePet && (
              <BookmarksSection
                bookmarkCards={bookmarkCards}
                petName={activePet.name}
                activePetId={activePetId}
                onCardPress={handleBookmarkCardPress}
                onSeeAll={() => navigation.navigate('Bookmarks')}
              />
            )}

            {/* 7. Recent Scans — redesigned counter */}
            {recentScans.length > 0 && activePet && (
              <RecentScansSection
                recentScans={recentScans}
                petName={activePet.name}
                weeklyCount={weeklyCount}
                premium={premium}
                scanWindowInfo={scanWindowInfo}
                scanCounterColor={scanCounterColor}
                scanTooltipText={scanTooltipText}
                onScanPress={handleScanPress}
                onLongPress={handleScanLongPress}
                onSeeAll={() => navigation.navigate('ScanHistory')}
              />
            )}

            {/* 8. Empty state */}
            {!hasContent && <HomeEmptyState />}
          </>
        )}
      </ScrollView>
      {longPressTarget && (
        <BookmarkToggleSheet
          visible={longPressTarget !== null}
          onClose={() => setLongPressTarget(null)}
          isBookmarked={longPressIsBookmarked}
          onToggle={handleLongPressToggle}
        />
      )}
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
});
