import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useHomeFilter, DEFAULT_FILTERS } from "@/contexts/home-filter-context";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from "react-native";
import { RecipeCard } from "@/components/recipe-card";
import type { Filters } from "@/components/ui/filter_pop_up";

type SearchResult = {
  id: number | string;
  title: string;
  image?: string;
  calories?: number | null;
  price?: number | null;
  rating?: number;
  reviewsLength?: number;
};

const API_BASE = "http://10.0.2.2:3000";
const PAGE_SIZE = 10;

type SearchCacheEntry = {
  personalResults: SearchResult[];
  externalResults: SearchResult[];
  personalOffset: number;
  externalOffset: number;
  personalExhausted: boolean;
  hasMore: boolean;
};

function buildSearchKey(query: string, filters: Filters): string {
  return [
    query.trim().toLowerCase(),
    filters.budgetMin,
    filters.budgetMax,
    [...filters.allergies].sort().join(","),
    [...filters.foodTypes].sort().join(","),
    [...filters.cookware].sort().join(","),
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
  if (!sameArray(filters.cookware, DEFAULT_FILTERS.cookware)) return true;
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

export default function HomeSearchScreen() {
  const { appliedFilters, openFilterModal } = useHomeFilter();
  const params = useLocalSearchParams<{ q?: string }>();
  const queryParam = useMemo(
    () => (params.q ?? "").toString().trim(),
    [params.q]
  );

  const [searchQuery, setSearchQuery] = useState(queryParam);

  const [personalResults, setPersonalResults] = useState<SearchResult[]>([]);
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false); // initial load
  const [loadingMore, setLoadingMore] = useState(false); // pagination load
  const [error, setError] = useState("");

  const [personalOffset, setPersonalOffset] = useState(0);
  const [externalOffset, setExternalOffset] = useState(0);
  const [personalExhausted, setPersonalExhausted] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchingRef = useRef(false);

  // Display user-generated recipes first, then external recipes in a unified list
  const results = useMemo(() => {
    const merged = [...personalResults, ...externalResults];
    const seen = new Set<string>(); // Track seen results to avoid duplicates
    const unique: SearchResult[] = []; // Unique results
    for (const item of merged) {
      const key = getResultKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique;
  }, [personalResults, externalResults]);

  const searchKey = useMemo(
    () => buildSearchKey(queryParam, appliedFilters),
    [queryParam, appliedFilters],
  );

  // Single place for all API calls: personal (filters + search), and when there is a query, external search via combined endpoint
  useEffect(() => {
    const trimmed = queryParam.trim();
    setError("");

    // If we have a cached entry for this query + filters, restore it instead of refetching
    if (trimmed) {
      const cached = searchCache[searchKey];
      if (cached) {
        setPersonalResults(cached.personalResults);
        setExternalResults(cached.externalResults);
        setPersonalOffset(cached.personalOffset);
        setExternalOffset(cached.externalOffset);
        setPersonalExhausted(cached.personalExhausted);
        setHasMore(cached.hasMore);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setPersonalOffset(0);
    setExternalOffset(0);
    setPersonalExhausted(false);
    setHasMore(true);

    let cancelled = false;

    // Search query: fetch personal and external recipes together via combined recipe API
    const params = new URLSearchParams({
      budgetMin: String(appliedFilters.budgetMin),
      budgetMax: String(appliedFilters.budgetMax),
      limit: String(PAGE_SIZE),
      q: trimmed,
      personalOffset: "0",
      externalOffset: "0",
    });

    fetch(`${API_BASE}/api/combined-recipes?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load recipes.");
        return r.json();
      })
      .then((combinedData) => {
        if (cancelled) return;

        const personal = combinedData?.personalResults ?? [];
        const ext = combinedData?.externalResults ?? [];
        const meta = combinedData?.meta ?? null;

        setPersonalResults(personal);
        setExternalResults(ext);
        setPersonalOffset(meta?.personalOffset ?? 0);
        setExternalOffset(meta?.externalOffset ?? 0);

        const personalReturned = meta?.personalReturned ?? 0;
        const externalReturned = meta?.externalReturned ?? 0;
        const externalTotal = meta?.externalTotalResults as number | null | undefined;
        const externalOffsetFromMeta = meta?.externalOffset ?? 0;

        const morePersonal = !(meta?.personalExhausted ?? false);
        const moreExternal =
          typeof externalTotal === "number"
            ? externalOffsetFromMeta + externalReturned < externalTotal
            : externalReturned === PAGE_SIZE;
        /* Fetch more if: 
        * - there are still more personal results to fetch
        * - the number of external results consumed so far is less than the total number of external results
        */
        setHasMore(morePersonal || moreExternal);
        setPersonalExhausted(meta?.personalExhausted ?? false);

        // Cache the combined + external results for this query + filters
        searchCache[searchKey] = {
          personalResults: personal,
          externalResults: ext,
          personalOffset: meta?.personalOffset ?? 0,
          externalOffset: meta?.externalOffset ?? 0,
          personalExhausted: meta?.personalExhausted ?? false,
          hasMore:
            morePersonal || moreExternal,
        };
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? "Network error.");
          setPersonalResults([]);
          setExternalResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
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

    const params = new URLSearchParams({
      budgetMin: String(appliedFilters.budgetMin),
      budgetMax: String(appliedFilters.budgetMax),
      limit: String(PAGE_SIZE),
      q: trimmed,
      personalOffset: String(personalOffset),
      externalOffset: String(externalOffset),
    });

    // Once personal results are exhausted, skip attempt to retrieve personal recipes in the backend entirely
    if (personalExhausted) {
      params.set("externalOnly", "true");
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
      const ext = data?.externalResults ?? [];
      const meta = data?.meta ?? null;
      setPersonalExhausted(meta?.personalExhausted ?? false);
      setPersonalResults((prev) => [...prev, ...personal]);
      setExternalResults((prev) => [...prev, ...ext]);

      const personalReturned = meta?.personalReturned ?? 0;
      const externalReturned = meta?.externalReturned ?? 0;
      const externalTotal = meta?.externalTotalResults as number | null | undefined;
      const externalOffsetFromMeta = meta?.externalOffset ?? 0;

      setPersonalOffset((prev) => prev + personalReturned);
      setExternalOffset((prev) => prev + externalReturned);

      const morePersonal = !(meta?.personalExhausted ?? false);
      const moreExternal =
        typeof externalTotal === "number"
          ? externalOffsetFromMeta + externalReturned < externalTotal
          : externalReturned === PAGE_SIZE;

      /* Fetch more if: 
      * - there are still more personal results to fetch
      * - the number of external results consumed so far is less than the total number of external results
      */
      setHasMore(morePersonal || moreExternal);

      // Update cache entry for this query + filters if it exists
      const trimmedKey = trimmed ? searchKey : null;
      if (trimmedKey && searchCache[trimmedKey]) {
        const cached = searchCache[trimmedKey];
        searchCache[trimmedKey] = {
          ...cached,
          personalResults: [...cached.personalResults, ...personal],
          externalResults: [...cached.externalResults, ...ext],
          personalOffset: cached.personalOffset + (meta?.personalReturned ?? 0),
          externalOffset: cached.externalOffset + (meta?.externalReturned ?? 0),
          personalExhausted:
            meta?.personalExhausted
              ? meta.personalExhausted
              : cached.personalExhausted || (meta?.personalReturned ?? 0) < PAGE_SIZE,
          hasMore:
            morePersonal ||
            (typeof externalTotal === "number"
              ? externalOffsetFromMeta + externalReturned < externalTotal
              : externalReturned === PAGE_SIZE),
        };
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
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

  const renderItem = ({ item }: { item: SearchResult }) => {
    const id = String(item.id);
    return (
      <View className="mb-3">
        <RecipeCard
          id={id}
          variant="horizontal"
          title={item.title}
          imageUrl={item.image ?? undefined}
          calories={item.calories ?? undefined}
          rating={item.rating ?? 0}
          reviewsLength={item.reviewsLength ?? 0}
        />
      </View>
    );
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <FlatList
        data={results}
        keyExtractor={getResultKey}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onEndReached={queryParam ? handleLoadMore : undefined}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View className="pb-2">
            <View className="flex-row justify-center items-center gap-2 mb-3">
              <View>
                {hasActiveFilters(appliedFilters) && (
                  <View className="absolute w-3 h-3 top-0 right-0 bg-red-primary z-10 rounded-full" />
                )}
                <Button
                  variant="muted"
                  icon={{ name: "filter-outline", color: "--color-icon" }}
                  className="w-14 h-14"
                  onPress={openFilterModal}
                />
              </View>
              <Input
                className="flex-1"
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

            {!!queryParam && (
              <Text className="opacity-70">
                Results for: <Text className="font-bold">{queryParam}</Text>
              </Text>
            )}

            {loading && <ActivityIndicator className="mt-3" color="red" />}

            {!!error && <Text style={{ color: "red" }}>{error}</Text>}
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
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
    </ThemedSafeView>
  );
}
