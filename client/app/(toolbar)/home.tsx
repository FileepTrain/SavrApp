import { RecipeCard } from "@/components/recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useState } from "react";
import { FlatList, View } from "react-native";

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
    <ThemedSafeView className="flex-1">
      <FlatList
        data={dummyData}
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
          paddingHorizontal: 24, // matches px-6 from ThemedSafeView
          paddingTop: 24,
          paddingBottom: 24,
          rowGap: 16,
        }}
        // 👇 this replaces the stuff that was above ScrollView
        ListHeaderComponent={
          <View className="flex-row justify-center items-center gap-2 mb-4">
            <Button variant="muted" icon={{ name: "filter-outline", color: "--color-icon" }} className="w-14 h-14" />
            <Input
              className="flex-1"
              placeholder="Search for a Recipe"
              iconName="magnify"
              inputClassName="h-14"
              touchableIcon
              onPressIcon={handleSearch}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        }
      />
    </ThemedSafeView>
  );
}
