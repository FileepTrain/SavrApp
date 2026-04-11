import { IngredientsList } from "@/components/recipe/ingredients-list";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useNetwork } from "@/contexts/network-context";
import { Ingredient } from "@/types/ingredient";
import { CACHE_KEYS, CachedRecipeEntry, readCache, recipeDetailKey, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Your backend base (Android emulator -> host machine)
const SERVER_URL = "http://10.0.2.2:3000";

// Reads the ID-only favorites list and pushes it to the server.
// When offline, the caller is responsible for queuing this operation instead.
async function syncFavorites() {
  const idToken = await AsyncStorage.getItem("idToken");
  const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
  const favoriteIds: string[] = raw ? JSON.parse(raw) : [];

  await fetch(`${SERVER_URL}/api/auth/update-favorites`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ favoriteIds }),
  });
}

type ExternalIngredient = {
  id: number;
  name: string;
  original: string;
  amount?: number;
  unit?: string;
  image?: string;
};

type Nutrient = {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds: number;
};

type EquipmentItem = {
  name: string;
  image?: string | null;
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
  equipment?: EquipmentItem[];
  nutrition?: { nutrients: Nutrient[] } | null;
  price?: number;
  reviewCount?: number;
  totalStars?: number;
  viewCount?: number;
};

/** Display shape used by the UI (normalized from both personal and external).
 *  Must remain structurally compatible with CachedRecipeEntry["recipe"]. */
type DisplayRecipe = CachedRecipeEntry["recipe"] & { equipment?: EquipmentItem[] };

type SimilarRecipe = {
  id: string;
  title: string;
  image?: string | null;
  calories?: number | null;
  similarityScore?: number;
};

function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function isExternalFirestoreRecipeId(id: string): boolean {
  return id.startsWith("spoonacular_");
}

function isRawExternalRecipeId(id: string): boolean {
  return /^\d+$/.test(id);
}

/* Personal recipes use Firestore IDs (alphanumeric); external use Spoonacular IDs (numeric only) */
function isPersonalRecipeId(id: string): boolean {
  return !isExternalFirestoreRecipeId(id) && !isRawExternalRecipeId(id);
}

export default function RecipeDetailsPage() {
  const router = useRouter();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { isOnline } = useNetwork();

  const insets = useSafeAreaInsets();

  const id = useMemo(() => {
    const raw = Array.isArray(recipeId) ? recipeId[0] : recipeId;
    return raw ?? "";
  }, [recipeId]);

  const [loading, setLoading] = useState(true);
  const [notCached, setNotCached] = useState(false);
  const [recipe, setRecipe] = useState<DisplayRecipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [similarRecipes, setSimilarRecipes] = useState<SimilarRecipe[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const toggleFavorite = async () => {
    if (!id) return;

    const next = !isFavorited;
    setIsFavorited(next);

    // FAVORITES_IDS holds only the plain string IDs; this is the source of truth
    // for which recipes are favorited and what gets synced to Firebase.
    const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
    const favoriteIds: string[] = raw ? JSON.parse(raw) : [];

    const updated = next
      ? [...new Set([...favoriteIds, id])]
      : favoriteIds.filter((fav) => fav !== id);

    await AsyncStorage.setItem(CACHE_KEYS.FAVORITES_IDS, JSON.stringify(updated));

    if (isOnline) {
      await syncFavorites();
    } else {
      // Enqueue the sync so it runs when connectivity is restored.
      await enqueueMutation({ type: "SYNC_FAVORITES", payload: { favoriteIds: updated } });
    }
  };

  /* SIMILAR RECIPES FETCH */
  const fetchSimilarRecipes = async (recipeIdValue: string) => {
    if (!recipeIdValue) {
      setSimilarRecipes([]);
      return;
    }

    const similarityId = /^\d+$/.test(recipeIdValue)
      ? `spoonacular_${recipeIdValue}`
      : recipeIdValue;

    try {
      setSimilarLoading(true);

      const response = await fetch(
        `${SERVER_URL}/api/combined-recipes/similar/${similarityId}`
      );
      const data = await response.json();
      if (!response.ok) {
        setSimilarRecipes([]);
        return;
      }

      const results: SimilarRecipe[] = Array.isArray(data?.results)
        ? data.results
        : [];

      setSimilarRecipes(results);
    } catch (error) {
      setSimilarRecipes([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return;
      setLoading(true);
      setNotCached(false);

      try {
        const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
        const favoriteIds: string[] = raw ? JSON.parse(raw) : [];
        setIsFavorited(favoriteIds.includes(id));

        if (!isOnline) {
          // Attempt to serve the recipe from the per-recipe cache.
          const cached = await readCache<CachedRecipeEntry>(recipeDetailKey(id));
          if (cached) {
            setRecipe(cached.recipe);
            // Guard against a malformed cache entry that is missing the ingredients array.
            setIngredients((cached.ingredients ?? []) as Ingredient[]);
          } else {
            // Recipe was never viewed while online; nothing to show.
            setNotCached(true);
          }
          setLoading(false);
          return;
        }

        if (isPersonalRecipeId(id)) {
          const idToken = await AsyncStorage.getItem("idToken");

          const response = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });

          const data = await response.json();
          const r = data.recipe;

          const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : (Array.isArray(r.reviews) ? r.reviews.length : 0);
          const totalStars = typeof r.totalStars === "number" ? r.totalStars : (Array.isArray(r.reviews) ? r.reviews.reduce((s: number, rev: { rating?: number }) => s + (rev?.rating ?? 0), 0) : 0);
          const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

          const displayRecipe: DisplayRecipe = {
            title: r.title,
            summary: r.summary,
            image: r.image,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            readyInMinutes: (r.prepTime ?? 0) + (r.cookTime ?? 0),
            servings: r.servings,
            instructions: r.instructions,
            calories:
              Array.isArray(r?.nutrition?.nutrients)
                ? Math.round(
                  Number(
                    r.nutrition.nutrients.find((n: any) => n?.name === "Calories")
                      ?.amount ?? 0
                  )
                ) || undefined
                : undefined,
            rating: avgRating,
            reviewsLength: reviewCount,
            viewCount: typeof r.viewCount === "number" ? r.viewCount : 0,
            price: r.price,
          };

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          const mappedIngredients: Ingredient[] = ext.map((ing: any) => ({
            name: ing.name,
            quantity: Number(ing.amount ?? 0),
            unit: ing.unit ?? "",
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);

          // Cache so this recipe is available when the user is next offline.
          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

          await fetchSimilarRecipes(id);
        }

        /* EXTERNAL FIRESTORE RECIPE */
        else if (isExternalFirestoreRecipeId(id)) {
          const idToken = await AsyncStorage.getItem("idToken");

          const response = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          const data = await response.json();
          const r = data.recipe;

          const displayRecipe: DisplayRecipe = {
            title: r.title,
            summary: r.summary,
            image: r.image,
            readyInMinutes: r.readyInMinutes,
            servings: r.servings,
            instructions: r.instructions,
            equipment: r.equipment ?? [],
            calories: r.calories,
            rating: r.rating ?? 0,
            reviewsLength: r.reviews?.length ?? 0,
            price: r.price,
          };

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          const mappedIngredients: Ingredient[] = ext.map((ing: any) => ({
            name: ing.name,
            quantity: Number(ing.amount ?? 0),
            unit: ing.unit ?? "",
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);

          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

          await fetchSimilarRecipes(id);

          // External recipe: include nutrition so we can show calories on this page
        } else {
          const response = await fetch(
            `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`,
            { method: "GET" },
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error || "Failed to fetch external recipe");
          }

          const r: ExternalRecipe = data.recipe;

          const caloriesNutrient = r.nutrition?.nutrients?.find(
            (n) => n.name === "Calories",
          );
          const calories =
            caloriesNutrient?.amount != null
              ? Math.round(Number(caloriesNutrient.amount))
              : undefined;

          const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : 0;
          const totalStars = typeof r.totalStars === "number" ? r.totalStars : 0;
          const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

          const displayRecipe: DisplayRecipe = {
            title: r.title,
            image: r.image,
            readyInMinutes: r.readyInMinutes,
            servings: r.servings,
            summary: r.summary ?? undefined,
            instructions: r.instructions ?? undefined,
            equipment: r.equipment ?? [],
            calories,
            rating: avgRating,
            reviewsLength: reviewCount,
            viewCount: typeof r.viewCount === "number" ? r.viewCount : 0,
            price: r.price ?? undefined,
          };

          const mappedIngredients: Ingredient[] = (r.extendedIngredients ?? []).map((ing) => ({
            name: ing.name,
            amount: Number((ing.amount ?? 1).toFixed(2)),
            unit: ing.unit ?? "serving",
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);

          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

          await fetchSimilarRecipes(id);
        }
      } catch (error) {
        console.error("Error fetching recipe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center">
        <ActivityIndicator size="large" color="red" />
      </View>
    );
  }

  // The recipe has never been viewed while online and cannot be served from cache.
  if (notCached) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center px-8 gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
        </TouchableOpacity>
        <IconSymbol name="wifi-off" size={48} color="--color-muted-foreground" />
        <Text className="text-foreground text-center text-lg font-semibold">
          Recipe not available offline
        </Text>
        <Text className="text-muted-foreground text-center">
          Open this recipe while connected to the internet to make it available offline.
        </Text>
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
          <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
        </TouchableOpacity>

        {/* Favorite Button */}
        <TouchableOpacity
          onPress={toggleFavorite}
          className="absolute right-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol
            name={isFavorited ? "cards-heart" : "cards-heart-outline"}
            size={24}
            color="--color-red-primary"
            // fix slight misalignment
            style={{ transform: [{ translateY: 1 }, { translateX: 0.5 }] }}
          />
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

              <View className="flex-row items-center justify-center gap-4 flex-wrap">
                <RecipeRating
                  rating={recipe?.rating ?? 0}
                  reviewsLength={recipe?.reviewsLength ?? 0}
                />
                <Text className="text-muted-foreground text-sm font-medium">
                  {(recipe?.viewCount ?? 0).toLocaleString()} views
                </Text>
                <Text className="text-muted-foreground text-sm font-medium">
                  Calories: {recipe?.calories != null ? recipe.calories : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm font-medium">
                  Avg. ${recipe?.price != null ? recipe.price.toFixed(2) : "—"}
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

              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.servings ?? 0}
                </Text>
                <Text className="text-muted-foreground text-sm">Servings</Text>
              </View>
            </View>

            {/* Description */}
            <Text className="text-foreground">
              {stripHtml(recipe?.summary ?? "") || "No description available"}
            </Text>

            {/* BUTTON ROW */}
            <View className="flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({
                    pathname: "/recipe/nutrition",
                    params: { recipeId: id },
                  })
                }
              >
                <IconSymbol
                  name="invoice-list-outline"
                  size={18}
                  color="--color-foreground"
                />
                <Text className="font-medium text-foreground">Nutrition</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({
                    pathname: "/recipe/reviews",
                    params: { recipeId: id },
                  })
                }
              >
                <IconSymbol name="chat-outline" size={18} color="--color-foreground" />
                <Text className="font-medium text-foreground">Reviews</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({
                    pathname: "/recipe/share",
                    params: { recipeId: id },
                  })
                }
              >
                <IconSymbol
                  name="share-variant-outline"
                  size={18}
                  color="--color-foreground"
                />
                <Text className="font-medium text-foreground">Share</Text>
              </TouchableOpacity>
            </View>

            {/* TOGGLE BUTTONS */}
            <View className="flex-row justify-around items-center bg-background rounded-xl h-10 p-1 shadow">
              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${isIngredientsOpen ? "bg-red-primary" : "bg-background"
                  }`}
                onPress={() => setIsIngredientsOpen(true)}
              >
                <Text
                  className={`text-center ${isIngredientsOpen ? "text-white" : "text-foreground"
                    }`}
                >
                  Ingredients
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${!isIngredientsOpen ? "bg-red-primary" : "bg-background"
                  }`}
                onPress={() => setIsIngredientsOpen(false)}
              >
                <Text
                  className={`text-center ${!isIngredientsOpen ? "text-white" : "text-foreground"
                    }`}
                >
                  Instructions
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONTENT SECTIONS */}
            <View className="gap-2">
              {isIngredientsOpen ? (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  {ingredients.length > 0 ? (
                    <IngredientsList list={ingredients} />
                  ) : (
                    <Text className="text-foreground font-medium">
                      No ingredients available
                    </Text>
                  )}
                </View>
              ) : (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  <Text className="text-foreground font-medium">
                    {stripHtml(recipe?.instructions) || "No instructions available"}
                  </Text>
                </View>
              )}

              {/* Cookware / Equipment */}
              {recipe?.equipment && recipe.equipment.length > 0 && (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  <Text className="text-lg font-semibold text-foreground">
                    Cookware Needed
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {recipe.equipment.map((item, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center gap-2 bg-background border border-muted-background rounded-xl px-3 py-2"
                      >
                        {item.image ? (
                          <Image
                            source={{ uri: item.image }}
                            className="w-8 h-8 rounded"
                            resizeMode="contain"
                          />
                        ) : (
                          <IconSymbol
                            name="pot-steam-outline"
                            size={20}
                            color="--color-icon"
                          />
                        )}
                        <Text className="text-foreground font-medium">
                          {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View className="bg-background rounded-xl p-4 shadow gap-3">
                <Text className="text-lg font-semibold text-foreground">
                  Similar Recipes
                </Text>

                {/* Similar recipes require a live API call; hide the section when offline */}
                {!isOnline ? (
                  <Text className="text-muted-foreground">
                    Similar recipes are not available offline.
                  </Text>
                ) : similarLoading ? (
                  <View className="py-4 items-center justify-center">
                    <ActivityIndicator size="small" color="red" />
                  </View>
                ) : similarRecipes.length > 0 ? (
                  similarRecipes.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      className="flex-row items-center bg-white rounded-xl p-3 shadow"
                      onPress={() =>
                        router.push({
                          pathname: "/recipe/[recipeId]",
                          params: { recipeId: String(item.id) },
                        })
                      }
                    >
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          className="w-20 h-20 rounded-xl mr-3"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-20 h-20 rounded-xl mr-3 bg-muted-background items-center justify-center">
                          <IconSymbol
                            name="image-outline"
                            size={24}
                            color="--color-icon"
                          />
                        </View>
                      )}

                      <View className="flex-1">
                        <Text className="text-red-primary font-bold text-base">
                          {item.title}
                        </Text>
                        <Text className="text-foreground mt-1">
                          {item.calories != null
                            ? `${item.calories} calories`
                            : "Calories unavailable"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text className="text-muted-foreground">
                    No similar recipes found.
                  </Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
