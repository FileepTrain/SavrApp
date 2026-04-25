import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, View, Text } from "react-native";
import { router } from "expo-router";

import { RecipeCard } from "@/components/recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useHomeFilter } from "@/contexts/home-filter-context";
import { loadUserCookware } from "@/utils/cookware";

import { SERVER_URL } from '@/utils/server-url';

type ExternalRecipe = {
  id: number;
  title: string;
  image?: string | null;
  calories?: number | null;
};

// Display Home Screen
const H_PADDING = 48; // matches ThemedSafeView px-6 (24+24)

export default function HomeScreen() {
  const { appliedFilters, openFilterModal } = useHomeFilter();
  const { isWebDesktop, contentWidth } = useWebDesktopLayout();
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<ExternalRecipe[]>([]);
  const [loading, setLoading] = useState(false);

  const gridInner = Math.max(0, contentWidth - H_PADDING);
  const numColumns =
    Platform.OS !== "web" ? 2 : !isWebDesktop ? 2 : gridInner >= 1000 ? 4 : gridInner >= 720 ? 3 : 2;
  const gridGap = 16;
  const tileWidth =
    numColumns > 0
      ? (gridInner - gridGap * (numColumns - 1)) / numColumns
      : undefined;

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;

    // Pass filters along to the search page (you’ll read these on search screen later)
    const params = new URLSearchParams({
      q,
      budgetMin: String(appliedFilters.budgetMin),
      budgetMax: String(appliedFilters.budgetMax),
      allergies: appliedFilters.allergies.join(","),
      foodTypes: appliedFilters.foodTypes.join(","),
      cookware: appliedFilters.cookware.join(","),
    });

    router.push(`/(toolbar)/home/search?${params.toString()}`);
  };

  // Fetch feed from server (with current filters so backend can filter when supported)
  const fetchFeed = async () => {
    setLoading(true);
    try {
      const userCookwareList = appliedFilters.useMyCookwareOnly
        ? Array.from(await loadUserCookware())
        : [];
      const params = new URLSearchParams({
        limit: "20",
        budgetMin: String(appliedFilters.budgetMin),
        budgetMax: String(appliedFilters.budgetMax),
        allergies: appliedFilters.allergies.join(","),
        foodTypes: appliedFilters.foodTypes.join(","),
        cookware: appliedFilters.cookware.join(","),
        useMyCookwareOnly: String(appliedFilters.useMyCookwareOnly),
      });
      if (appliedFilters.useMyCookwareOnly && userCookwareList.length > 0) {
        params.set("userCookware", userCookwareList.join(","));
      }
      const res = await fetch(`${SERVER_URL}/api/external-recipes/feed?${params}`);
      const raw = await res.text();

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`HOME FEED returned non-JSON (status ${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || "Failed to fetch feed");
      setRecipes(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      console.error("Home feed fetch error:", e);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [appliedFilters]);

  // Keep header stable
  const Header = useMemo(() => {
    const row = (
      <View className="flex-row items-center gap-2">
        <Button
          variant="outline"
          icon={{ name: "filter-outline", color: "--color-icon" }}
          className="w-14 h-14 rounded-full shrink-0"
          onPress={openFilterModal}
        />
        <Input
          className="flex-1 min-w-0"
          placeholder="Search for a Recipe"
          iconName="magnify"
          inputClassName="h-14"
          touchableIcon
          onPressIcon={handleSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>
    );
    if (Platform.OS === "web" && isWebDesktop) {
      return (
        <View className="w-full items-center mb-4">
          <View className="w-full max-w-xl">{row}</View>
        </View>
      );
    }
    return <View className="mb-4">{row}</View>;
  }, [searchQuery, appliedFilters, isWebDesktop]);

  return (
    <ThemedSafeView className="flex-1">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : (
        <FlatList
          key={`home-feed-${numColumns}`}
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard
              id={String(item.id)}
              title={item.title}
              calories={item.calories ?? undefined}
              rating={4.5}
              imageUrl={item.image ?? undefined}
              tileWidth={tileWidth}
              prominent={isWebDesktop}
            />
          )}
          onRefresh={fetchFeed}
          refreshing={loading}
          numColumns={numColumns}
          columnWrapperStyle={
            numColumns > 1
              ? Platform.OS === "web" && isWebDesktop
                ? { gap: gridGap, justifyContent: "flex-start" }
                : { gap: gridGap, justifyContent: "center" }
              : undefined
          }
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 24,
            rowGap: 16,
          }}
          ListEmptyComponent={
            <Text className="text-center text-foreground opacity-60 mt-6">
              No cached recipes yet.
            </Text>
          }
          ListHeaderComponent={Header}
        />
      )}
    </ThemedSafeView>
  );
}
