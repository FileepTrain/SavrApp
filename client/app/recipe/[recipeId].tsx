import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import React from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Recipe } from "@/types/recipe";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IngredientsList } from "@/components/recipe/ingredients-list";

const SERVER_URL = "http://10.0.2.2:3000";

export default function RecipeDetailsPage() {
  const router = useRouter();
  const { recipeId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Get recipe by ID
    const fetchRecipe = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${SERVER_URL}/api/recipes/${recipeId}`, {
          headers: {
            "Content-Type": "application/json",
          },
          method: "GET",
        });

        if (!response.ok) {
          throw new Error(response.statusText || "Failed to fetch recipe");
        }

        const data = await response.json();
        setRecipe(data.recipe);
        console.log("Recipe:", data.recipe.name);

        // Ingredients are now included in the recipe response
        if (data.recipe.ingredients && Array.isArray(data.recipe.ingredients)) {
          setIngredients(data.recipe.ingredients);
        } else {
          setIngredients([]);
        }
      } catch (error) {
        console.error("Error fetching recipe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId]);

  if (loading) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center">
        <ActivityIndicator size="large" color="red" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-app-background gap-6">
      {/* HEADER: Recipe Image + Favorite Button + Back Button */}
      <View className="relative">
        <View className="w-full h-60 bg-muted-background justify-center items-center">
          {/* TODO: Retrieve image from storage */}
          {recipe?.imageUri ?
            (<Image source={{ uri: recipe.imageUri }} className="w-full h-full" resizeMode="cover" />) :
            (<View className="mt-12 w-full h-full items-center justify-center gap-2">
              <IconSymbol name="image-outline" size={36} color="--color-icon" />
              <Text className="text-icon text-lg font-medium">No image available</Text>
            </View>)}
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol name="chevron-left" size={24} color="#EB2D2D" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => console.log("Favorite clicked")}
          className="absolute right-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol name="cards-heart-outline" size={24} color="#EB2D2D" />
        </TouchableOpacity>
      </View>
      <View
        className="flex-1"
        style={{
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} className="px-6">
          <View className="gap-4">
            {/* TITLE + SUBTEXT */}
            <View className="gap-2">
              <Text className="text-3xl font-bold text-center text-red-primary">
                {recipe?.name || "Recipe Name"}
              </Text>
              <View className="flex-row items-center justify-center gap-4">
                <RecipeRating rating={recipe?.rating || 0} reviewsLength={recipe?.reviews?.length || 0} />
                <Text className="text-muted-foreground text-sm font-medium">{recipe?.calories || 0} calories</Text>
                <Text className="text-muted-foreground text-sm font-medium">Avg. ${recipe?.price || 0}</Text>
              </View>
            </View>

            <View className="bg-background rounded-xl shadow h-20 w-full items-center justify-evenly flex-row">
              {/* Prep time */}
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">{recipe?.prepTime || 0} min</Text>
                <Text className="text-muted-foreground text-sm">Prep</Text>
              </View>
              {/* Cook time */}
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">{recipe?.cookTime || 0} min</Text>
                <Text className="text-muted-foreground text-sm">Cook</Text>
              </View>
              {/* Servings */}
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">{recipe?.servings || 0}</Text>
                <Text className="text-muted-foreground text-sm">Servings</Text>
              </View>
            </View>

            {/* Description */}
            <Text className="font-medium text-sm">{recipe?.description || "No description available"}</Text>

            {/* BUTTON ROW: Nutrition | Reviews | Share */}
            <View className="flex-row justify-between gap-2">

              {/* Nutrition */}
              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() => router.push(`/recipe/nutrition`)}
              >
                <IconSymbol name="invoice-list-outline" size={18} color="--color-secondary" />
                <Text className="font-medium">Nutrition</Text>
              </TouchableOpacity>

              {/* Reviews */}
              <TouchableOpacity
                className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() => router.push(`/recipe/reviews`)}
              >
                <IconSymbol name="chat-outline" size={18} color="--color-secondary" />
                <Text className="font-medium">Reviews</Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() => router.push(`/recipe/share`)}
              >
                <IconSymbol name="share-variant-outline" size={18} color="--color-secondary" />
                <Text className="font-medium">Share</Text>
              </TouchableOpacity>
            </View>

            {/* TOGGLE BUTTONS: ingredients / instructions */}
            <View className="flex-row justify-around items-center bg-background rounded-xl h-10 p-1 shadow">
              <TouchableOpacity className={`w-1/2 py-1 rounded-lg ${isIngredientsOpen ? "bg-red-primary text-background" : "bg-background text-foreground"}`} onPress={() => setIsIngredientsOpen(true)}>
                <Text className={`text-center ${isIngredientsOpen ? "text-background" : "text-foreground"}`}>Ingredients</Text>
              </TouchableOpacity>
              <TouchableOpacity className={`w-1/2 py-1 rounded-lg ${!isIngredientsOpen ? "bg-red-primary" : "bg-background text-background"}`} onPress={() => setIsIngredientsOpen(false)}>
                <Text className={`text-center ${!isIngredientsOpen ? "text-background" : "text-foreground"}`}>Instructions</Text>
              </TouchableOpacity>
            </View>

            {/* CONTENT SECTIONS */}
            <View className="gap-2">
              {isIngredientsOpen ?
                <>
                  {/* Ingredients */}
                  <View className="bg-white rounded-xl p-4 shadow gap-2">
                    {ingredients.length > 0 ? (
                      <IngredientsList list={ingredients} />
                    ) : (
                      <Text className="text-foreground font-medium">No ingredients available</Text>
                    )}
                  </View>
                </>
                :
                <>
                  {/* Instructions */}
                  <View className="bg-white rounded-xl p-4 shadow gap-2">
                    <Text className="text-foreground font-medium">
                      {recipe?.instructions || "No instructions available"}
                    </Text>
                  </View>
                </>
              }
              {/* Similar Recipes */}
              <View className="bg-background rounded-xl p-4 shadow gap-2">
                <Text className="text-lg font-semibold">Similar Recipes Placeholder</Text>
                <Text className="text-muted-foreground">
                  This area will display similar recipe items.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
