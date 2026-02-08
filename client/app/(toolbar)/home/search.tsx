import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RecipeCard } from "@/components/recipe-card";

type SearchResult = {
  id: number;
  title: string;
  image?: string;
};

const API_BASE = "http://10.0.2.2:3000";
const PAGE_SIZE = 10;

export default function HomeSearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const queryParam = useMemo(
    () => (params.q ?? "").toString().trim(),
    [params.q]
  );

  const [searchQuery, setSearchQuery] = useState(queryParam);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false); // initial load
  const [loadingMore, setLoadingMore] = useState(false); // pagination load
  const [error, setError] = useState("");

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // avoid duplicate calls on fast scroll
  const fetchingRef = useRef(false);

  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  const fetchPage = async (q: string, nextOffset: number, append: boolean) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (append) setLoadingMore(true);
    else setLoading(true);

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
        if (!append) setResults([]);
        setHasMore(false);
        return;
      }

      const page: SearchResult[] = Array.isArray(data?.results)
        ? data.results
        : [];

      setResults((prev) => (append ? [...prev, ...page] : page));

      setHasMore(page.length === PAGE_SIZE);
      setOffset(nextOffset + PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      if (!append) setResults([]);
      setHasMore(false);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!queryParam) return;

    setResults([]);
    setOffset(0);
    setHasMore(true);

    fetchPage(queryParam, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

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

  const renderItem = ({ item }: { item: SearchResult }) => (
    <View className="mb-3">
      <RecipeCard id={item.id.toString()} variant="horizontal" title={item.title} image={item.image} />
    </View>
    // <TouchableOpacity
    //   onPress={() => router.push(`/recipe/${item.id}`)}
    //   className="bg-white rounded-xl flex-row mb-3 overflow-hidden"
    // >
    //   {!!item.image && (
    //     <Image source={{ uri: item.image }} style={{ width: 113, height: 82 }} />
    //   )}
    //   <View className="flex-1 px-3 py-2">
    //     <Text className="font-bold text-red-600" numberOfLines={2}>
    //       {item.title}
    //     </Text>
    //     <Text className="mt-1">Calories: —</Text>
    //     <Text className="mt-1">Rating: —</Text>
    //   </View>
    // </TouchableOpacity>
  );

  return (
    <ThemedSafeView className="flex-1">
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View className="pt-16 pb-2">
            <View className="flex-row justify-center items-center gap-2 mb-3">
              <Button
                variant="muted"
                icon={{ name: "filter-outline", color: "--color-icon" }}
                className="w-14 h-14"
                onPress={() => {
                  console.log("TODO: filters");
                }}
              />
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

            {loading && <ActivityIndicator className="mt-3" />}

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
              {queryParam ? "No results found." : "Search for a recipe above."}
            </Text>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </ThemedSafeView>
  );
}
