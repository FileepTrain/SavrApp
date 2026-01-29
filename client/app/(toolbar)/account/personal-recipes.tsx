import { useState, useEffect } from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Recipe } from "@/types/recipe";
import { RecipeCard } from "@/components/recipe-card";

const SERVER_URL = "http://10.0.2.2:3000";

export default function PersonalRecipesPage() {
  const [personalRecipes, setPersonalRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        const idToken = await AsyncStorage.getItem("idToken");
        const response = await fetch(`${SERVER_URL}/api/recipes`, {
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          method: "GET",
        });
        const data = await response.json();
        console.log("Personal Recipes:", data.recipes.map((r) => ({ id: r.id, name: r.name })));
        setPersonalRecipes(data.recipes);
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch recipes");
        }
        setPersonalRecipes(data.recipes);
      } catch (error) {
        console.error("Error fetching recipes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRecipes();
  }, []);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="gap-4">
        {/* New Recipe Button */}
        <Button variant="primary" icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-red-primary" }} className="h-24 rounded-xl shadow-lg" textClassName="text-xl font-bold text-red-primary" onPress={() => router.push("/account/create-recipe")}>
          Create New Recipe
        </Button>
        {loading ?
          <ActivityIndicator size="large" color="red" />
          :
          <FlatList
            // List of Personal Recipes
            data={personalRecipes}
            renderItem={({ item }: { item: Recipe }) => (
              <RecipeCard
                variant="horizontal"
                id={item.id}
                title={item.name}
                calories={item.calories || 0}
                rating={item.rating || 0}
                reviewsLength={item.reviews?.length || 0}
              />
            )}
          />
        }
      </View>
    </ThemedSafeView>
  );
}
