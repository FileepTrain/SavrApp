import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, View, Text } from "react-native";
import { router } from "expo-router";

import { RecipeCard } from "@/components/recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import FilterModal, { Filters } from "@/components/ui/filter_pop_up";

const SERVER_URL = "http://10.0.2.2:3000";

type ExternalRecipe = {
  id: number;
  title: string;
  image?: string | null;
  summary?: string | null;
};

// Display Calories
function extractCalories(summary?: string | null): number {
  if (!summary) return 0;
  const m = summary.match(/(\d+)\s*calories/i);
  return m ? Number(m[1]) : 0;
}

const DEFAULT_FILTERS: Filters = {
  budgetMin: 0,
  budgetMax: 100,
  allergies: [],
  foodTypes: [],
  cookware: [],
};

// Display Home Screen
export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<ExternalRecipe[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter modal state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);

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

// Fetch feed from server
  const fetchFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/external-recipes/feed?limit=20`);
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
  }, []);

  // Keep header stable
  const Header = useMemo(() => {
    return (
      <View className="flex-row justify-center items-center gap-2 mb-4">
        <Button
          variant="muted"
          icon={{ name: "filter-outline", color: "--color-icon" }}
          className="w-14 h-14"
          onPress={() => {
            setDraftFilters(appliedFilters); // open with current applied
            setIsFilterOpen(true);
          }}
        />
        <Input
          className="flex-1"
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
  }, [searchQuery, appliedFilters]);

  return (
    <ThemedSafeView className="flex-1">
      {/* Filter Modal */}
      <FilterModal
        visible={isFilterOpen}
        draft={draftFilters}
        onChangeDraft={setDraftFilters}
        onCancel={() => setIsFilterOpen(false)}
        onApply={() => {
          setAppliedFilters(draftFilters);
          setIsFilterOpen(false);
        }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard
              id={String(item.id)}
              title={item.title}
              calories={extractCalories(item.summary)}
              rating={4.5}
              imageUrl={item.image ?? undefined}
            />
          )}
          numColumns={2}
          columnWrapperStyle={{ gap: 16, justifyContent: "center" }}
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