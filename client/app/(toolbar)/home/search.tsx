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
  id: number;
  title: string;
  image?: string;
};

type FilteredRecipe = {
  id: string;
  title: string;
  image?: string | null;
  summary?: string | null;
  calories?: number;
};

type ListItem = SearchResult | FilteredRecipe;

const API_BASE = "http://10.0.2.2:3000";
const PAGE_SIZE = 10;

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

function extractCalories(summary?: string | null): number {
  if (!summary) return 0;
  const m = summary.match(/(\d+)\s*calories/i);
  return m ? Number(m[1]) : 0;
}

export default function HomeSearchScreen() {
  const { appliedFilters, openFilterModal } = useHomeFilter();
  const params = useLocalSearchParams<{ q?: string }>();
  const queryParam = useMemo(
    () => (params.q ?? "").toString().trim(),
    [params.q]
  );

  const [searchQuery, setSearchQuery] = useState(queryParam);

  const [personalResults, setPersonalResults] = useState<FilteredRecipe[]>([]);
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false); // initial load
  const [loadingMore, setLoadingMore] = useState(false); // pagination load (external only)
  const [error, setError] = useState("");

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchingRef = useRef(false);

  // Display user-generated recipes followed by external recipes in a unified list
  const results = useMemo(
    () => [...personalResults, ...externalResults],
    [personalResults, externalResults]
  );

  // Single place for all API calls: personal (filters ± search) and, when there is a query, external search
  useEffect(() => {
    setLoading(true);
    setError("");
    setOffset(0);
    setHasMore(true);

    const trimmed = queryParam.trim();
    let cancelled = false;

    if (!trimmed) {
      // No search query: fetch only personal recipes matching filters
      const params = new URLSearchParams({
        budgetMin: String(appliedFilters.budgetMin),
        budgetMax: String(appliedFilters.budgetMax),
        limit: "20",
      });
      fetch(`${API_BASE}/api/combined-recipes?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load recipes.");
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          setPersonalResults(Array.isArray(data?.results) ? data.results : []);
          setExternalResults([]);
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
    }

    // Search query: fetch personal (filters + q) and external (only q for now) in parallel
    const params = new URLSearchParams({
      budgetMin: String(appliedFilters.budgetMin),
      budgetMax: String(appliedFilters.budgetMax),
      limit: "20",
      q: trimmed,
    });
    Promise.all([
      fetch(`${API_BASE}/api/combined-recipes?${params}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load personal recipes.");
        return r.json();
      }),
      fetch(
        `${API_BASE}/api/external-recipes/search?q=${encodeURIComponent(trimmed)}&number=${PAGE_SIZE}&offset=0`
      ).then((r) => {
        if (!r.ok) throw new Error("Failed to load external results.");
        return r.json();
      }),
    ])
      .then(([combinedData, externalData]) => {
        if (cancelled) return;
        setPersonalResults(Array.isArray(combinedData?.results) ? combinedData.results : []);
        const ext = Array.isArray(externalData?.results) ? externalData.results : [];
        setExternalResults(ext);
        setHasMore(ext.length === PAGE_SIZE);
        setOffset(PAGE_SIZE);
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
  }, [queryParam, appliedFilters]);

  // Keep search input in sync with URL param
  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  const fetchPage = async (q: string, nextOffset: number, append: boolean) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (append) setLoadingMore(true);

    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/external-recipes/search?q=${encodeURIComponent(
          trimmed
        )}&number=${PAGE_SIZE}&offset=${nextOffset}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Search failed.");
        if (!append) setExternalResults([]);
        setHasMore(false);
        return;
      }

      const page: SearchResult[] = Array.isArray(data?.results)
        ? data.results
        : [];

      setExternalResults((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
      setOffset(nextOffset + PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      if (!append) setExternalResults([]);
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

    fetchPage(queryParam, offset, true);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    const id = String(item.id);
    const calories = "calories" in item && item.calories != null ? item.calories : "summary" in item ? extractCalories(item.summary) : 0;
    return (
      <View className="mb-3">
        <RecipeCard
          id={id}
          variant="horizontal"
          title={item.title}
          imageUrl={item.image ?? undefined}
          calories={calories}
        />
      </View>
    );
  };

  return (
    <ThemedSafeView className="flex-1">
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onEndReached={queryParam ? handleLoadMore : undefined}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View className="pt-16 pb-2">
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
