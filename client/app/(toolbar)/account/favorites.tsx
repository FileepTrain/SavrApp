//app/(toolbar)/account/favorites.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
import { RecipeCard } from "@/components/recipe-card";

const SERVER_URL = "http://10.0.2.2:3000";

export default function FavoritesPage() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { setPendingSelectedRecipe } = useMealPlanSelection();
  const isSelectionMode = mode === "select";

  console.log("mode:", mode, "isSelectionMode:", isSelectionMode);

  const handleSelectRecipe = (recipe: { id: string;[key: string]: unknown }) => {
    setPendingSelectedRecipe(recipe);
    router.back();
    router.push(`/calendar/meal-plan`);
  };
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true);
        const idToken = await AsyncStorage.getItem("idToken");
        if (!idToken) {
          setFavorites([]);
          return;
        }
        const response = await fetch(`${SERVER_URL}/api/auth/get-favorites`, {
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-type": "application/json",
          },
          method: "GET",
        });

        if (!response.ok) {
          setFavorites([]);
          return;
        }

        const data = await response.json();
        const favoriteIds: string[] = data.favoriteIds || [];
        const recipePromises = favoriteIds.map(async (id) => {
          try {
            // Determine if personal or external recipe
            const isPersonal = !/^\d+$/.test(id);

            if (isPersonal) {
              const res = await fetch(`${SERVER_URL}/api/recipes/${encodeURIComponent(id)}`, {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (!res.ok) return null;
              const recipeData = await res.json();
              return recipeData.recipe;
            } else {
              const res = await fetch(`${SERVER_URL}/api/external-recipes/${id}/details`);
              if (!res.ok) return null;
              const recipeData = await res.json();
              return recipeData.recipe;
            }
          } catch (err) {
            console.error(`Error fetching recipe ${id}:`, err);
            return null;
          }
        });
        const recipes = await Promise.all(recipePromises);
        const validRecipes = recipes.filter(r => r !== null);
        setFavorites(validRecipes)

      } catch (error) {
        console.error("Error fetching favorite recipes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFavorites();
  }, []);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {isSelectionMode && (
        <Text className="text-center text-muted-foreground mb-2">
          Tap a recipe to add it to your meal plan
        </Text>
      )}

      <View className="gap-4">
        {loading ?
          <ActivityIndicator size="large" color="red" />
          :
          <FlatList
            data={favorites}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: any }) => (
              <View className="mb-3">
                <RecipeCard
                  id={item.id}
                  variant="horizontal"
                  title={item.title}
                  calories={item.calories}
                  rating={item.rating}
                  reviewsLength={item.reviews?.length || 0}
                  imageUrl={item.image ?? undefined}
                  onPress={() => {
                    if (isSelectionMode) {
                      handleSelectRecipe(item);
                    } else {
                      router.push(`/recipe/${item.id}`);
                    }
                  }}
                />
              </View>
            )}
          />
        }
      </View>
    </ThemedSafeView>
  );
}
