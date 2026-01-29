import { RecipeCard } from "@/components/recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;

    router.push(`/(toolbar)/home/search?q=${encodeURIComponent(q)}`);
  };

  const dummyHomeFeed = Array.from({ length: 10 }).map((_, index) => ({
    id: index,
    title: `Recipe ${index + 1}`,
    calories: 100,
    rating: 4.5,
  }));

  return (
    <ThemedSafeView className="flex-1">
      <FlatList
        data={dummyHomeFeed}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <RecipeCard
            id={item.id.toString()}
            title={item.title}
            calories={item.calories}
            rating={item.rating}
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
        ListHeaderComponent={
          <View className="flex-row justify-center items-center gap-2 mb-4">
            <Button
              variant="muted"
              icon={{ name: "filter-outline", color: "--color-icon" }}
              className="w-14 h-14"
              onPress={() => console.log("TODO: filters")}
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
        }
      />
    </ThemedSafeView>
  );
}
