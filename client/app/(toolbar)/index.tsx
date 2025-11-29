import { useState } from "react";
import { Text, View, ScrollView, FlatList } from "react-native";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { router } from "expo-router";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import RecipeHorizontalCard from "@/components/recipe-horizontal-card";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleSearch = () => {
    console.log(
      "Query:",
      searchQuery || "no input",
      "\tTODO: Implement search functionality"
    );
  };

  const dummyData = Array.from({ length: 10 }).map((_, index) => ({
    id: index,
    title: `Recipe ${index + 1}`,
    calories: 100,
    rating: 4.5,
  }));

  return (
    <ThemedSafeView className="items-center gap-4">
      <View className="flex-row justify-center items-center gap-2">
        <Button variant="muted" iconName="filter-alt" className="w-14 h-14" />
        <Input
          className="flex-1"
          placeholder="Search for a Recipe"
          iconName="search"
          inputClassName="h-14"
          touchableIcon
          onPressIcon={handleSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <ScrollView className="w-full">
        <FlatList
          data={dummyData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RecipeHorizontalCard
              id={item.id.toString()}
              title={item.title}
              calories={item.calories}
              rating={item.rating}
            />
          )}
          numColumns={2}
          columnWrapperStyle={{ gap: 16, justifyContent: "center" }} // Horizontal spacing
          contentContainerStyle={{ gap: 16 }} // Vertical spacing
        />
      </ScrollView>
    </ThemedSafeView>
  );
}
