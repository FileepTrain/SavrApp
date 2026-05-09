import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useHomeFilter, DEFAULT_FILTERS } from "@/contexts/home-filter-context";
import { useNetwork } from "@/contexts/network-context";
import { loadUserCookware } from "@/utils/cookware";
import { CommonActions } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import { useAccountWebColumnWidth } from "@/hooks/use-account-web-column-width";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  View,
} from "react-native";
import { RecipeCard } from "@/components/recipe-card";
import type { Filters } from "@/components/ui/filter_pop_up";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { SERVER_URL as API_BASE } from "@/utils/server-url";
import { verticalScrollIndicatorVisible } from "@/utils/scroll-indicators";

type SearchResult = {
  id: number | string;
  title: string;
  image?: string;
  calories?: number | null;
  price?: number | null;
  rating?: number;
  reviewsLength?: number;
  viewCount?: number;
};

function singleQueryParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) return String(v[0]).trim();
  return undefined;
}
const PAGE_SIZE = 10;

/** Larger horizontal thumbnails on web desktop search (default card is 128×96). */
const DESKTOP_SEARCH_THUMB = { width: 208, height: 152 } as const;

/** Whether another page likely exists for one segment (cached DB or live API). */
function computeSegmentMore(params: {
  nextOffset: number;
  segmentTotal: number | null | undefined;
  returned: number;
  /** When true, prefer strict `nextOffset < segmentTotal` for numeric totals (Spoonacular-scale). */
  strictNumericTotal: boolean;
}): boolean {
  const { nextOffset, segmentTotal, returned, strictNumericTotal } = params;
  if (typeof segmentTotal === "number") {
    if (strictNumericTotal || segmentTotal > 300) {
      return nextOffset < segmentTotal;
    }
    if (nextOffset < segmentTotal) return true;
    if (returned >= PAGE_SIZE) return true;
    return returned > 0 && segmentTotal <= 250 && nextOffset >= segmentTotal;
  }
  return returned >= PAGE_SIZE;
}

type SearchCacheEntry = {
  personalResults: SearchResult[];
  cachedExternalResults: SearchResult[];
  liveExternalResults: SearchResult[];
  personalOffset: number;
  cachedExternalOffset: number;
  liveExternalOffset: number;
  personalExhausted: boolean;
  cachedExternalExhausted: boolean;
  liveExternalExhausted: boolean;
  hasMore: boolean;
  liveStrictPagination?: boolean;
};

function buildSearchKey(query: string, filters: Filters): string {
  return [
    query.trim().toLowerCase(),
    filters.budgetMin,
    filters.budgetMax,
    [...(filters.allergies || [])].sort().join(","),
    [...(filters.foodTypes || [])].sort().join(","),
    [...(filters.cookware || [])].sort().join(","),
    filters.useMyCookwareOnly ? "1" : "0",
    filters.sortBy ?? "mostViewed",
  ].join("|");
}

// Locally cache search results to avoid unnecessary API calls
const searchCache: Record<string, SearchCacheEntry> = {};

function hasActiveFilters(filters: Filters): boolean {
  // Check if filters are different from default filters
  if (filters.budgetMin !== DEFAULT_FILTERS.budgetMin || filters.budgetMax !== DEFAULT_FILTERS.budgetMax) return true;
  const sameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  if (!sameArray(filters.allergies, DEFAULT_FILTERS.allergies)) return true;
  if (!sameArray(filters.foodTypes, DEFAULT_FILTERS.foodTypes)) return true;
  if (!sameArray(filters.cookware || [], DEFAULT_FILTERS.cookware)) return true;
  if (Boolean(filters.useMyCookwareOnly) !== Boolean(DEFAULT_FILTERS.useMyCookwareOnly)) return true;
  return false;
}

function isExternalId(id: SearchResult["id"]): boolean {
  // External (Spoonacular) ids are numeric; personal recipe ids are Firestore doc ids (random strings).
  if (typeof id === "number") return true;
  if (typeof id !== "string") return false;
  return /^\d+$/.test(id);
}

function getResultKey(item: SearchResult): string {
  const id = String(item.id ?? "");
  return isExternalId(item.id) ? `e-${id}` : `p-${id}`;
}

function dedupeResults(items: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const item of items) {
    const key = getResultKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Dedupe + sort (used for merged personal+cached, or a single source). */
function sortSearchResults(
  items: SearchResult[],
  sortBy: string | undefined,
): SearchResult[] {
  const unique = dedupeResults(items);
  const v = (x: SearchResult) => Number(x?.viewCount) || 0;
  const r = (x: SearchResult) => Number(x?.rating) || 0;
  const c = (x: SearchResult) => Number(x?.calories) || 0;
  const id = (x: SearchResult) => String(x?.id ?? "");
  const sb = sortBy ?? "mostViewed";
  if (sb === "rating") {
    unique.sort((a, b) => r(b) - r(a) || v(b) - v(a) || id(a).localeCompare(id(b)));
  } else if (sb === "caloriesAsc") {
    unique.sort((a, b) => c(a) - c(b) || v(b) - v(a) || id(a).localeCompare(id(b)));
  } else if (sb === "caloriesDesc") {
    unique.sort((a, b) => c(b) - c(a) || v(b) - v(a) || id(a).localeCompare(id(b)));
  } else {
    unique.sort((a, b) => v(b) - v(a) || id(a).localeCompare(id(b)));
  }
  return unique;
}

type SearchListRow = { kind: "recipe-row"; key: string; recipes: SearchResult[] };

export default function HomeSearchScreen() {
  const navigation = useNavigation();
  const { isWebDesktop } = useWebDesktopLayout();
  const desktopColumnMax = useAccountWebColumnWidth();
  const isDesktopWeb = Platform.OS === "web" && isWebDesktop;

  const { mode, mealPlanId, mealPlanDate } = useLocalSearchParams<{
    mode?: string;
    mealPlanId?: string;
    mealPlanDate?: string;
  }>();
  const { setPendingSelectedRecipe } = useMealPlanSelection();
  const isSelectionMode = mode === "select";
  const { isOnline } = useNetwork();

  const handleSelectRecipe = (recipe: { id: string; [key: string]: unknown }) => {
    setPendingSelectedRecipe(recipe);
    const returnPlanId = singleQueryParam(mealPlanId);
    const returnDate = singleQueryParam(mealPlanDate);
    if (returnPlanId || returnDate) {
      router.navigate({
        pathname: "/calendar/meal-plan",
        params: {
          ...(returnPlanId ? { mealPlanId: returnPlanId } : {}),
          ...(returnDate ? { date: returnDate } : {}),
        },
      });
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "index" }],
          }),
        );
      }, 0);
    } else {
      router.back();
    }
  };

  const { appliedFilters, openFilterModal } = useHomeFilter();
  const params = useLocalSearchParams<{ q?: string }>();
  const queryParam = useMemo(
    () => (params.q ?? "").toString().trim(),
    [params.q]
  );

  const [searchQuery, setSearchQuery] = useState(queryParam);

  const [personalResults, setPersonalResults] = useState<SearchResult[]>([]);
  const [cachedExternalResults, setCachedExternalResults] = useState<SearchResult[]>([]);
  const [liveExternalResults, setLiveExternalResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false); // initial load
  const [loadingMore, setLoadingMore] = useState(false); // pagination load
  const [error, setError] = useState("");

  const [personalOffset, setPersonalOffset] = useState(0);
  const [cachedExternalOffset, setCachedExternalOffset] = useState(0);
  const [liveExternalOffset, setLiveExternalOffset] = useState(0);
  const [personalExhausted, setPersonalExhausted] = useState(false);
  const [cachedExternalExhausted, setCachedExternalExhausted] = useState(false);
  const [liveExternalExhausted, setLiveExternalExhausted] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchingRef = useRef(false);
  /** Live Spoonacular totals: use strict offset vs total. */
  const liveStrictPaginationRef = useRef(false);

  /** Personal + saved-in-app (cached) merged; live API rows listed after. */
  const sortedMergedLocal = useMemo(
    () =>
      sortSearchResults(
        [...personalResults, ...cachedExternalResults],
        appliedFilters.sortBy ?? undefined,
      ),
    [personalResults, cachedExternalResults, appliedFilters.sortBy],
  );
  const sortedLiveExternal = useMemo(
    () => sortSearchResults(liveExternalResults, appliedFilters.sortBy ?? undefined),
    [liveExternalResults, appliedFilters.sortBy],
  );

  const listRows = useMemo((): SearchListRow[] => {
    const rows: SearchListRow[] = [];

    for (let i = 0; i < sortedMergedLocal.length; i += 1) {
      rows.push({
        kind: "recipe-row",
        key: `row-local-${i}`,
        recipes: sortedMergedLocal.slice(i, i + 1),
      });
    }

    for (let i = 0; i < sortedLiveExternal.length; i += 1) {
      rows.push({
        kind: "recipe-row",
        key: `row-live-${i}`,
        recipes: sortedLiveExternal.slice(i, i + 1),
      });
    }

    return rows;
  }, [sortedMergedLocal, sortedLiveExternal]);

  const searchKey = useMemo(
    () => buildSearchKey(queryParam, appliedFilters),
    [queryParam, appliedFilters],
  );

  // Single place for all API calls: personal, cached external_recipes, live Spoonacular (combined endpoint)
  useEffect(() => {
    const trimmed = queryParam.trim();
    setError("");

    if (trimmed) {
      const cached = searchCache[searchKey];
      if (cached) {
        setPersonalResults(cached.personalResults);
        setCachedExternalResults(cached.cachedExternalResults);
        setLiveExternalResults(cached.liveExternalResults);
        setPersonalOffset(cached.personalOffset);
        setCachedExternalOffset(cached.cachedExternalOffset);
        setLiveExternalOffset(cached.liveExternalOffset);
        setPersonalExhausted(cached.personalExhausted);
        setCachedExternalExhausted(cached.cachedExternalExhausted);
        setLiveExternalExhausted(cached.liveExternalExhausted);
        setHasMore(cached.hasMore);
        liveStrictPaginationRef.current = cached.liveStrictPagination ?? false;
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setPersonalOffset(0);
    setCachedExternalOffset(0);
    setLiveExternalOffset(0);
    setPersonalExhausted(false);
    setCachedExternalExhausted(false);
    setLiveExternalExhausted(false);
    setHasMore(true);
    liveStrictPaginationRef.current = false;

    let cancelled = false;

    const buildParams = (userCookwareList: string[]) => {
      const params = new URLSearchParams({
        budgetMin: String(appliedFilters.budgetMin),
        budgetMax: String(appliedFilters.budgetMax),
        limit: String(PAGE_SIZE),
        q: trimmed,
        personalOffset: "0",
        cachedExternalOffset: "0",
        liveExternalOffset: "0",
        externalOffset: "0",
        allergies: (appliedFilters.allergies || []).join(","),
        cookware: (appliedFilters.cookware || []).join(","),
        useMyCookwareOnly: appliedFilters.useMyCookwareOnly ? "true" : "false",
        sortBy: appliedFilters.sortBy ?? "mostViewed",
      });
      if (appliedFilters.useMyCookwareOnly && userCookwareList.length > 0) {
        params.set("userCookware", userCookwareList.join(","));
      }
      return params;
    };

    const runFetch = async () => {
      const userCookwareList = appliedFilters.useMyCookwareOnly
        ? Array.from(await loadUserCookware())
        : [];
      if (cancelled) return;
      const params = buildParams(userCookwareList);
      fetch(`${API_BASE}/api/combined-recipes?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load recipes.");
          return r.json();
        })
        .then((combinedData) => {
          if (cancelled) return;

          const personal = combinedData?.personalResults ?? [];
          const cachedExt = combinedData?.cachedExternalResults ?? [];
          const liveExt = combinedData?.liveExternalResults ?? [];
          const meta = combinedData?.meta ?? null;
          const liveMeta = combinedData?.liveExternalMeta as { source?: string } | undefined;

          const cachedTotal = meta?.cachedExternalTotal as number | null | undefined;
          const liveTotal = meta?.liveExternalTotal as number | null | undefined;
          const personalReturned = meta?.personalReturned ?? personal.length;
          const cachedReturned = meta?.cachedExternalReturned ?? cachedExt.length;
          const liveReturned = meta?.liveExternalReturned ?? liveExt.length;

          const baseCachedOff = meta?.cachedExternalOffset ?? 0;
          const baseLiveOff = meta?.liveExternalOffset ?? 0;
          const nextPersonalOffset = (meta?.personalOffset ?? 0) + personalReturned;
          const nextCachedOffset = baseCachedOff + cachedReturned;
          const nextLiveOffset = baseLiveOff + liveReturned;

          if (
            liveMeta?.source === "spoonacular-live" ||
            (typeof liveTotal === "number" && liveTotal > 300)
          ) {
            liveStrictPaginationRef.current = true;
          }

          const moreCached = computeSegmentMore({
            nextOffset: nextCachedOffset,
            segmentTotal: cachedTotal,
            returned: cachedReturned,
            strictNumericTotal: false,
          });
          const cachedExh = !moreCached;

          const moreLive = computeSegmentMore({
            nextOffset: nextLiveOffset,
            segmentTotal: liveTotal,
            returned: liveReturned,
            strictNumericTotal: liveStrictPaginationRef.current,
          });
          const liveExh = !moreLive;

          const personalExhaustedNow = meta?.personalExhausted ?? false;
          const hasMoreVal = !(personalExhaustedNow && cachedExh && liveExh);

          setPersonalResults(personal);
          setCachedExternalResults(cachedExt);
          setLiveExternalResults(liveExt);
          setPersonalOffset(nextPersonalOffset);
          setCachedExternalOffset(nextCachedOffset);
          setLiveExternalOffset(nextLiveOffset);
          setPersonalExhausted(personalExhaustedNow);
          setCachedExternalExhausted(cachedExh);
          setLiveExternalExhausted(liveExh);
          setHasMore(hasMoreVal);

          searchCache[searchKey] = {
            personalResults: personal,
            cachedExternalResults: cachedExt,
            liveExternalResults: liveExt,
            personalOffset: nextPersonalOffset,
            cachedExternalOffset: nextCachedOffset,
            liveExternalOffset: nextLiveOffset,
            personalExhausted: personalExhaustedNow,
            cachedExternalExhausted: cachedExh,
            liveExternalExhausted: liveExh,
            hasMore: hasMoreVal,
            liveStrictPagination: liveStrictPaginationRef.current,
          };
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e?.message ?? "Network error.");
            setPersonalResults([]);
            setCachedExternalResults([]);
            setLiveExternalResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    runFetch();
    return () => {
      cancelled = true;
    };
  }, [queryParam, appliedFilters, searchKey]);

  // Keep search input in sync with URL param
  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  const fetchMore = async () => {
    const trimmed = queryParam.trim();
    if (!trimmed) return;

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setLoadingMore(true);
    setError("");

    type Phase = "personal" | "cached" | "live" | "done";
    let phase: Phase;
    if (!personalExhausted) phase = "personal";
    else if (!cachedExternalExhausted) phase = "cached";
    else if (!liveExternalExhausted) phase = "live";
    else phase = "done";

    if (phase === "done") {
      setLoadingMore(false);
      fetchingRef.current = false;
      setHasMore(false);
      return;
    }

    const userCookwareList = appliedFilters.useMyCookwareOnly
      ? Array.from(await loadUserCookware())
      : [];

    const params = new URLSearchParams({
      budgetMin: String(appliedFilters.budgetMin),
      budgetMax: String(appliedFilters.budgetMax),
      limit: String(PAGE_SIZE),
      q: trimmed,
      allergies: (appliedFilters.allergies || []).join(","),
      cookware: (appliedFilters.cookware || []).join(","),
      useMyCookwareOnly: appliedFilters.useMyCookwareOnly ? "true" : "false",
      sortBy: appliedFilters.sortBy ?? "mostViewed",
    });
    if (appliedFilters.useMyCookwareOnly && userCookwareList.length > 0) {
      params.set("userCookware", userCookwareList.join(","));
    }

    if (phase === "personal") {
      params.set("personalOnly", "true");
      params.set("personalOffset", String(personalOffset));
    } else if (phase === "cached") {
      params.set("cachedExternalOnly", "true");
      params.set("cachedExternalOffset", String(cachedExternalOffset));
    } else {
      params.set("liveExternalOnly", "true");
      params.set("liveExternalOffset", String(liveExternalOffset));
    }

    try {
      const res = await fetch(`${API_BASE}/api/combined-recipes?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Search failed.");
        setHasMore(false);
        return;
      }

      const personal = data?.personalResults ?? [];
      const cachedExt = data?.cachedExternalResults ?? [];
      const liveExt = data?.liveExternalResults ?? [];
      const meta = data?.meta ?? null;
      const liveMeta = data?.liveExternalMeta as { source?: string } | undefined;

      const cachedTotal = meta?.cachedExternalTotal as number | null | undefined;
      const liveTotal = meta?.liveExternalTotal as number | null | undefined;
      const personalReturned = meta?.personalReturned ?? personal.length;
      const cachedReturned = meta?.cachedExternalReturned ?? cachedExt.length;
      const liveReturned = meta?.liveExternalReturned ?? liveExt.length;

      const baseCachedOff = meta?.cachedExternalOffset ?? 0;
      const baseLiveOff = meta?.liveExternalOffset ?? 0;
      const nextCachedOffset = baseCachedOff + cachedReturned;
      const nextLiveOffset = baseLiveOff + liveReturned;

      if (
        liveMeta?.source === "spoonacular-live" ||
        (typeof liveTotal === "number" && liveTotal > 300)
      ) {
        liveStrictPaginationRef.current = true;
      }

      const personalExhaustedNow = meta?.personalExhausted ?? false;

      const moreCached = computeSegmentMore({
        nextOffset: nextCachedOffset,
        segmentTotal: cachedTotal,
        returned: cachedReturned,
        strictNumericTotal: false,
      });

      const moreLive = computeSegmentMore({
        nextOffset: nextLiveOffset,
        segmentTotal: liveTotal,
        returned: liveReturned,
        strictNumericTotal: liveStrictPaginationRef.current,
      });

      if (phase === "personal") {
        setPersonalResults((prev) => [...prev, ...personal]);
        setPersonalOffset((prev) => prev + personalReturned);
        setPersonalExhausted(personalExhaustedNow);
      } else if (phase === "cached") {
        setCachedExternalResults((prev) => [...prev, ...cachedExt]);
        setCachedExternalOffset(nextCachedOffset);
        setCachedExternalExhausted(!moreCached);
      } else {
        setLiveExternalResults((prev) => [...prev, ...liveExt]);
        setLiveExternalOffset(nextLiveOffset);
        setLiveExternalExhausted(!moreLive);
      }

      const nextPe =
        phase === "personal" ? personalExhaustedNow : personalExhausted;
      const nextCe =
        phase === "cached" ? !moreCached : cachedExternalExhausted;
      const nextLe = phase === "live" ? !moreLive : liveExternalExhausted;

      const hasMoreVal = !(nextPe && nextCe && nextLe);
      setHasMore(hasMoreVal);

      const trimmedKey = trimmed ? searchKey : null;
      if (trimmedKey && searchCache[trimmedKey]) {
        const c = searchCache[trimmedKey];
        const updatedPersonal =
          phase === "personal"
            ? [...c.personalResults, ...personal]
            : c.personalResults;
        const updatedCached =
          phase === "cached"
            ? [...c.cachedExternalResults, ...cachedExt]
            : c.cachedExternalResults;
        const updatedLive =
          phase === "live"
            ? [...c.liveExternalResults, ...liveExt]
            : c.liveExternalResults;
        searchCache[trimmedKey] = {
          ...c,
          personalResults: updatedPersonal,
          cachedExternalResults: updatedCached,
          liveExternalResults: updatedLive,
          personalOffset:
            phase === "personal"
              ? c.personalOffset + personalReturned
              : c.personalOffset,
          cachedExternalOffset:
            phase === "cached" ? nextCachedOffset : c.cachedExternalOffset,
          liveExternalOffset:
            phase === "live" ? nextLiveOffset : c.liveExternalOffset,
          personalExhausted: nextPe,
          cachedExternalExhausted: nextCe,
          liveExternalExhausted: nextLe,
          hasMore: hasMoreVal,
          liveStrictPagination: liveStrictPaginationRef.current,
        };
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error.");
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  };

  const renderListRow = ({ item }: { item: SearchListRow }) => {
    const recipes = item.recipes;
    const recipeProps = (recipe: SearchResult) => {
      const id = String(recipe.id);
      return {
        id,
        title: recipe.title,
        imageUrl: recipe.image ?? undefined,
        calories: recipe.calories ?? undefined,
        rating: recipe.rating ?? 0,
        reviewsLength: recipe.reviewsLength ?? 0,
        onPress: isSelectionMode ? () => handleSelectRecipe({ id }) : undefined,
      };
    };

    return (
      <>
        {recipes.map((recipe) => (
          <View key={getResultKey(recipe)} className="mb-3">
            <RecipeCard
              {...recipeProps(recipe)}
              variant="horizontal"
              {...(Platform.OS === "web" && isWebDesktop
                ? {
                    horizontalThumbnailWidth: DESKTOP_SEARCH_THUMB.width,
                    horizontalThumbnailHeight: DESKTOP_SEARCH_THUMB.height,
                  }
                : {})}
            />
          </View>
        ))}
      </>
    );
  };

  const handleSubmitSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    router.setParams({ q });
  };

  const handleLoadMore = () => {
    if (!queryParam) return;
    if (!hasMore) return;
    if (loading || loadingMore) return;

    fetchMore();
  };

  // Search requires live API access; show a clear offline state instead of a broken experience.
  if (!isOnline) {
    return (
      <ThemedSafeView className="flex-1 pt-safe-or-20 bg-app-background">
        <AccountWebColumn className="flex-1 min-h-0">
        <View className="px-6 pb-2">
          <View className="flex-row justify-center items-center gap-2 mb-3">
            <Button
              variant="outline"
              icon={{ name: "filter-outline", color: "--color-icon" }}
              className="w-14 h-14 rounded-full opacity-40"
              disabled
              onPress={() => {}}
            />
            <Input
              className="flex-1 opacity-40"
              placeholder="Search unavailable offline"
              iconName="magnify"
              inputClassName="h-14"
              editable={false}
              value=""
              onChangeText={() => {}}
            />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Text className="text-foreground text-center text-lg font-semibold">
            Search is unavailable offline
          </Text>
          <Text className="text-muted-foreground text-center">
            Connect to the internet to search for recipes.
          </Text>
        </View>
        </AccountWebColumn>
      </ThemedSafeView>
    );
  }

  const searchHeader = (
    <View className="pb-2">
      <View
        className={
          Platform.OS === "web" && isWebDesktop
            ? "w-full items-center mb-3"
            : "mb-3"
        }
      >
        <View
          className={
            Platform.OS === "web" && isWebDesktop
              ? "flex-row items-center gap-2 w-full max-w-xl"
              : "flex-row justify-center items-center gap-2"
          }
        >
          <View>
            {hasActiveFilters(appliedFilters) && (
              <View className="absolute w-3 h-3 top-0 right-0 bg-red-primary z-10 rounded-full" />
            )}
            <Button
              variant="outline"
              icon={{ name: "filter-outline", color: "--color-icon" }}
              className="w-14 h-14 rounded-full shrink-0"
              onPress={openFilterModal}
            />
          </View>
          <Input
            className="flex-1 min-w-0"
            placeholder="Search for a Recipe"
            iconName="magnify"
            inputClassName="h-14"
            touchableIcon
            onPressIcon={handleSubmitSearch}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {!!queryParam && (
        <Text className="text-muted-foreground">
          Results for: <Text className="font-bold">{queryParam}</Text>
        </Text>
      )}

      {loading && <ActivityIndicator className="mt-3" color="red" />}

      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );

  const searchListContentStyle = {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    ...(isDesktopWeb && desktopColumnMax != null
      ? {
          maxWidth: desktopColumnMax,
          width: "100%" as const,
          alignSelf: "center" as const,
        }
      : {}),
  };

  const searchFlatList = (
    <FlatList
      key="search-list"
      data={listRows}
      keyExtractor={(row) => row.key}
      renderItem={renderListRow}
      style={isDesktopWeb ? { flex: 1, width: "100%" } : undefined}
      showsVerticalScrollIndicator={verticalScrollIndicatorVisible}
      onEndReached={queryParam ? handleLoadMore : undefined}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={searchHeader}
      contentContainerStyle={searchListContentStyle}
      ListEmptyComponent={
        !loading && !error ? (
          <Text className="opacity-60 mt-2 px-6">
            No recipes found that match your filters and search query.
          </Text>
        ) : null
      }
      ListFooterComponent={
        queryParam && loadingMore ? (
          <View className="py-4">
            <ActivityIndicator />
          </View>
        ) : null
      }
    />
  );

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20 bg-app-background">
      {isDesktopWeb ? (
        <View className="flex-1 w-full min-h-0 self-stretch">{searchFlatList}</View>
      ) : (
        <AccountWebColumn className="flex-1 min-h-0">{searchFlatList}</AccountWebColumn>
      )}
    </ThemedSafeView>
  );
}
