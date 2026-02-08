import { IngredientsList } from "@/components/recipe/ingredients-list";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ingredient } from "@/types/ingredient";

// Your backend base (Android emulator -> host machine)
const SERVER_URL = "http://10.0.2.2:3000";

type ExternalIngredient = {
  id: number;
  name: string;
  original: string;
  amount?: number;
  unit?: string;
  image?: string;
};

type ExternalRecipe = {
  id: number;
  title: string;
  image?: string;
  sourceUrl?: string;
  readyInMinutes?: number;
  servings?: number;
  summary?: string;
  instructions?: string;
  extendedIngredients?: ExternalIngredient[];
};

/** Display shape used by the UI (normalized from both personal and external) */
type DisplayRecipe = {
  title: string;
  image?: string | null;
  readyInMinutes?: number;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  summary?: string;
  instructions?: string;
  calories?: number;
  rating?: number;
  reviewsLength?: number;
};

function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

/* Personal recipes use Firestore IDs (alphanumeric); external use Spoonacular IDs (numeric only) */
function isPersonalRecipeId(id: string): boolean {
  return !/^\d+$/.test(id);
}

export default function RecipeDetailsPage() {
  const router = useRouter();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<DisplayRecipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!recipeId) return;

      setLoading(true);
      try {
        if (isPersonalRecipeId(recipeId)) {
          // Personal recipe: GET /api/recipes/:id
          const response = await fetch(
            `${SERVER_URL}/api/recipes/${recipeId}`,
            { method: "GET" }
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error || "Failed to fetch recipe");
          }

          const r = data.recipe;
          setRecipe({
            title: r.title,
            summary: r.summary,
            image: r.image,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            readyInMinutes: (r.prepTime ?? 0) + (r.cookTime ?? 0),
            servings: r.servings,
            instructions: r.instructions,
            calories: r.calories,
            rating: r.rating,
            reviewsLength: r.reviews?.length ?? 0,
          });
          setIngredients(
            (r.ingredients ?? []).map((ing: Ingredient) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            }))
          );
        } else {
          // External recipe: GET /api/external-recipes/:id/details
          const response = await fetch(
            `${SERVER_URL}/api/external-recipes/${recipeId}/details`,
            { method: "GET" }
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error || "Failed to fetch external recipe");
          }

          const r: ExternalRecipe = data.recipe;
          setRecipe({
            title: r.title,
            image: r.image,
            readyInMinutes: r.readyInMinutes,
            servings: r.servings,
            summary: r.summary ?? undefined,
            instructions: r.instructions ?? undefined,
          });
          setIngredients(
            (r.extendedIngredients ?? []).map((ing) => ({
              name: ing.name,
              quantity: Number((ing.amount ?? 1).toFixed(2)),
              unit: ing.unit ?? "serving",
            }))
          );
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
    );
  }

  return (
    <View className="flex-1 bg-app-background gap-6">
      {/* HEADER: Recipe Image + Favorite Button + Back Button */}
      <View className="relative">
        <View className="w-full h-60 bg-muted-background justify-center items-center">
          {recipe?.image ? (
            <Image
              source={{ uri: recipe.image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="mt-12 w-full h-full items-center justify-center gap-2">
              <IconSymbol name="image-outline" size={36} color="--color-icon" />
              <Text className="text-icon text-lg font-medium">
                No image available
              </Text>
            </View>
          )}
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
          paddingBottom: insets.bottom,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} className="px-6">
          <View className="gap-4">
            {/* TITLE + SUBTEXT */}
            <View className="gap-2">
              <Text className="text-3xl font-bold text-center text-red-primary">
                {recipe?.title || "Recipe Name"}
              </Text>

              <View className="flex-row items-center justify-center gap-4">
                <RecipeRating
                  rating={recipe?.rating ?? 0}
                  reviewsLength={recipe?.reviewsLength ?? 0}
                />
                <Text className="text-muted-foreground text-sm font-medium">
                  Calories: {recipe?.calories != null ? recipe.calories : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm font-medium">
                  Avg. $—
                </Text>
              </View>
            </View>

            <View className="bg-background rounded-xl shadow h-20 w-full items-center justify-evenly flex-row">
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.prepTime != null
                    ? `${recipe.prepTime} min`
                    : recipe?.readyInMinutes != null
                      ? `${recipe.readyInMinutes} min`
                      : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {recipe?.prepTime != null ? "Prep" : "Total"}
                </Text>
              </View>

              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.cookTime != null ? `${recipe.cookTime} min` : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm">Cook</Text>
              </View>

              {/* Servings */}
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.servings ?? 0}
                </Text>
                <Text className="text-muted-foreground text-sm">Servings</Text>
              </View>
            </View>

            {/* Description */}
            <Text className="font-medium text-sm">
              {stripHtml(recipe?.summary ?? "") || "No description available"}
            </Text>

            {/* BUTTON ROW: Nutrition | Reviews | Share */}
            <View className="flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({ pathname: "/recipe/nutrition", params: { recipeId } })
                }
              >
                <IconSymbol
                  name="invoice-list-outline"
                  size={18}
                  color="--color-secondary"
                />
                <Text className="font-medium">Nutrition</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({ pathname: "/recipe/reviews", params: { recipeId } })
                }
              >
                <IconSymbol
                  name="chat-outline"
                  size={18}
                  color="--color-secondary"
                />
                <Text className="font-medium">Reviews</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({ pathname: "/recipe/share", params: { recipeId } })
                }
              >
                <IconSymbol
                  name="share-variant-outline"
                  size={18}
                  color="--color-secondary"
                />
                <Text className="font-medium">Share</Text>
              </TouchableOpacity>
            </View>

            {/* TOGGLE BUTTONS: ingredients / instructions */}
            <View className="flex-row justify-around items-center bg-background rounded-xl h-10 p-1 shadow">
              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${isIngredientsOpen
                  ? "bg-red-primary text-background"
                  : "bg-background text-foreground"
                  }`}
                onPress={() => setIsIngredientsOpen(true)}
              >
                <Text
                  className={`text-center ${isIngredientsOpen ? "text-background" : "text-foreground"
                    }`}
                >
                  Ingredients
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${!isIngredientsOpen
                  ? "bg-red-primary"
                  : "bg-background text-background"
                  }`}
                onPress={() => setIsIngredientsOpen(false)}
              >
                <Text
                  className={`text-center ${!isIngredientsOpen ? "text-background" : "text-foreground"
                    }`}
                >
                  Instructions
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONTENT SECTIONS */}
            <View className="gap-2">
              {isIngredientsOpen ? (
                <View className="bg-white rounded-xl p-4 shadow gap-2">
                  {ingredients.length > 0 ? (
                    <IngredientsList list={ingredients} />
                  ) : (
                    <Text className="text-foreground font-medium">
                      No ingredients available
                    </Text>
                  )}
                </View>
              ) : (
                <View className="bg-white rounded-xl p-4 shadow gap-2">
                  <Text className="text-foreground font-medium">
                    {stripHtml(recipe?.instructions) ||
                      "No instructions available"}
                  </Text>
                </View>
              )}

              {/* Similar Recipes Placeholder */}
              <View className="bg-background rounded-xl p-4 shadow gap-2">
                <Text className="text-lg font-semibold">
                  Similar Recipes Placeholder
                </Text>
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
