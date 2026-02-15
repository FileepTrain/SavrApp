import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { SwipeableRecipeCard } from "@/components/swipeable-recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { usePersonalRecipes } from "@/contexts/personal-recipes-context";

export default function PersonalRecipesPage() {
  const { recipes: personalRecipes, loading, error, refetch } = usePersonalRecipes();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="gap-4 flex-1">
        {/* New Recipe Button */}
        <Button
          variant="primary"
          icon={{
            name: "plus-circle-outline",
            position: "left",
            size: 20,
            color: "--color-red-primary",
          }}
          className="h-24 rounded-xl shadow-lg"
          textClassName="text-xl font-bold text-red-primary"
          onPress={() => router.push("/account/create-recipe")}
        >
          Create New Recipe
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center opacity-70 mb-3">Error: {String(error)}</Text>
            <Button variant="default" onPress={() => refetch?.()}>
              Reload
            </Button>
          </View>
        ) : (
          <FlatList
            data={personalRecipes ?? []}
            keyExtractor={(item) => String(item.id)}
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={{
              paddingBottom: 24,
              paddingHorizontal: 16,
              flexGrow: (personalRecipes?.length ?? 0) === 0 ? 1 : 0,
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <Text className="opacity-60">
                  No personal recipes yet. Tap “Create New Recipe”.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="mb-3">
                <SwipeableRecipeCard
                  id={item.id}
                  title={item.title ?? "Untitled"}
                  calories={item.calories ?? 0}
                  rating={item.rating ?? 0}
                  reviewsLength={Array.isArray(item.reviews) ? item.reviews.length : 0}
                  image={item.image ?? null}
                />
              </View>
            )}
          />
        )}
      </View>
    </ThemedSafeView>
  );
}
