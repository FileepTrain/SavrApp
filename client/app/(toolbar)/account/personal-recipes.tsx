import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SwipeableRecipeCard } from "@/components/swipeable-recipe-card";
import { usePersonalRecipes } from "@/contexts/personal-recipes-context";

export default function PersonalRecipesPage() {
  const { recipes: personalRecipes, loading, error, refetch } = usePersonalRecipes();

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="gap-4">
        {/* New Recipe Button */}
        <Button
          variant="primary"
          icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-red-primary" }}
          className="h-24 rounded-xl shadow-lg"
          textClassName="text-xl font-bold text-red-primary"
          onPress={() => router.push("/account/create-recipe")}
        >
          Create New Recipe
        </Button>
        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : error ? (
          <View>
            <Text>Error: {error}</Text>
            <Button variant="default" onPress={() => refetch()}>
              Reload
            </Button>
            <ActivityIndicator size="large" color="red" />
          </View>
        ) : (
          <FlatList
            data={personalRecipes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="mb-3">
                <SwipeableRecipeCard
                  id={item.id}
                  title={item.title}
                  calories={item.calories ?? 0}
                  rating={item.rating ?? 0}
                  reviewsLength={item.reviews?.length ?? 0}
                  image={item.image}
                />
              </View>
            )}
          />
        )}
      </View>
    </ThemedSafeView>
  );
}
