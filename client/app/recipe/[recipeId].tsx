import { IngredientsList } from "@/components/recipe/ingredients-list";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Ingredient } from "@/types/ingredient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Your backend base (Android emulator -> host machine)
const SERVER_URL = "http://10.0.2.2:3000";
const SHARE_BASE_URL = "http://10.0.2.2:3000";
const FAVORITES_KEY = "FAV_RECIPE_IDS";

async function syncFavorites() {
  const idToken = await AsyncStorage.getItem("idToken");
  const saved = await AsyncStorage.getItem(FAVORITES_KEY);
  const favoriteIds: string[] = saved ? JSON.parse(saved) : [];

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
  equipment?: EquipmentItem[];
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  viewCount?: number;
  price?: number;
};

type SimilarRecipe = {
  id: string;
  title: string;
  image?: string | null;
  calories?: number | null;
  similarityScore?: number;
};

type RecipeCollectionRow = {
  id: string;
  name: string;
  recipeIds: string[];
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
  const navigation = useNavigation();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();

  const insets = useSafeAreaInsets();

  const id = useMemo(() => {
    const raw = Array.isArray(recipeId) ? recipeId[0] : recipeId;
    return raw ?? "";
  }, [recipeId]);

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<DisplayRecipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [similarRecipes, setSimilarRecipes] = useState<SimilarRecipe[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveCollections, setSaveCollections] = useState<RecipeCollectionRow[]>([]);
  const [saveCollectionsLoading, setSaveCollectionsLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saveActionId, setSaveActionId] = useState<string | null>(null);
  /** Personal recipe creator (from API userId + authorUsername). */
  const [recipeAuthor, setRecipeAuthor] = useState<{
    userId: string;
    username: string | null;
  } | null>(null);

  const toggleFavorite = async () => {
    if (!id) return;

    const next = !isFavorited;
    setIsFavorited(next);

    const saved = await AsyncStorage.getItem(FAVORITES_KEY);
    const favoriteIds: string[] = saved ? JSON.parse(saved) : [];

    const updated = next
      ? [...new Set([...favoriteIds, id])]
      : favoriteIds.filter((fav) => fav !== id);

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    await syncFavorites();
  };

  const fetchCollectionsForSave = async () => {
    try {
      setSaveCollectionsLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setSaveCollections([]);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setSaveCollections([]);
        return;
      }
      const data = await res.json();
      const list: RecipeCollectionRow[] = Array.isArray(data.collections)
        ? data.collections.map((c: RecipeCollectionRow) => ({
            id: c.id,
            name: c.name,
            recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds : [],
          }))
        : [];
      setSaveCollections(list);
    } catch {
      setSaveCollections([]);
    } finally {
      setSaveCollectionsLoading(false);
    }
  };

  const openSaveModal = () => {
    setSaveModalOpen(true);
    setNewCollectionName("");
    void fetchCollectionsForSave();
  };

  const collectionContainsRecipe = (c: RecipeCollectionRow) =>
    id ? c.recipeIds.includes(id) : false;

  const toggleRecipeInCollection = async (collectionId: string, currentlySaved: boolean) => {
    if (!id) return;
    try {
      setSaveActionId(collectionId);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      if (currentlySaved) {
        const res = await fetch(
          `${SERVER_URL}/api/auth/collections/${collectionId}/recipes/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        if (res.ok) {
          setSaveCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId
                ? { ...c, recipeIds: c.recipeIds.filter((rid) => rid !== id) }
                : c,
            ),
          );
        }
      } else {
        const res = await fetch(`${SERVER_URL}/api/auth/collections/${collectionId}/recipes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recipeId: id }),
        });
        if (res.ok) {
          setSaveCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId ? { ...c, recipeIds: [...c.recipeIds, id] } : c,
            ),
          );
        }
      }
    } finally {
      setSaveActionId(null);
    }
  };

  const createCollectionAndSave = async () => {
    const name = newCollectionName.trim();
    if (!name || !id) {
      Alert.alert("Name required", "Enter a name for your new collection.");
      return;
    }
    try {
      setSaveActionId("__create__");
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, recipeId: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Could not create", err?.error || "Try again.");
        return;
      }
      const data = await res.json();
      const col = data.collection;
      if (col?.id) {
        setSaveCollections((prev) => [
          {
            id: col.id,
            name: col.name ?? name,
            recipeIds: Array.isArray(col.recipeIds) ? col.recipeIds : [id],
          },
          ...prev,
        ]);
      }
      setNewCollectionName("");
    } finally {
      setSaveActionId(null);
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

  const copyRecipeDeepLink = async () => {
    if (!id) return;
    const shareLink = `${SHARE_BASE_URL}/recipe/${id}`;
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert("Link copied", "Share link copied to your clipboard.");
    } catch (err) {
      console.error("Failed to copy share link:", err);
      Alert.alert("Copy failed", "Could not copy the link to clipboard.");
    }
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return;
      setLoading(true);

      try {
        setRecipeAuthor(null);
        const idToken = await AsyncStorage.getItem("idToken");
        const uid = await AsyncStorage.getItem("uid");
        if (!idToken || !uid) {
          router.replace({
            pathname: "/login",
            params: { redirectTo: `/recipe/${id}` },
          });
          return;
        }

        const saved = await AsyncStorage.getItem(FAVORITES_KEY);
        const favoriteIds: string[] = saved ? JSON.parse(saved) : [];
        setIsFavorited(favoriteIds.includes(id));

        if (isPersonalRecipeId(id)) {
          const response = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });

          const data = await response.json();

          if (!response.ok) {
            const msg = data?.error || "Failed to fetch recipe";
            if (
              typeof msg === "string" &&
              msg.toLowerCase().includes("token")
            ) {
              router.replace({
                pathname: "/login",
                params: { redirectTo: `/recipe/${id}` },
              });
              return;
            }
            throw new Error(msg);
          }

          const r = data.recipe;

          const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : (Array.isArray(r.reviews) ? r.reviews.length : 0);
          const totalStars = typeof r.totalStars === "number" ? r.totalStars : (Array.isArray(r.reviews) ? r.reviews.reduce((s: number, rev: { rating?: number }) => s + (rev?.rating ?? 0), 0) : 0);
          const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

          setRecipe({
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
          });

          const ownerId = typeof r.userId === "string" ? r.userId : null;
          setRecipeAuthor(
            ownerId
              ? {
                  userId: ownerId,
                  username:
                    typeof r.authorUsername === "string" ? r.authorUsername : null,
                }
              : null,
          );

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          setIngredients(
            ext.map((ing: any) => ({
              name: ing.name,
              quantity: Number(ing.amount ?? 0),
              unit: ing.unit ?? "",
            }))
          );

          await fetchSimilarRecipes(id);
        }

        /* EXTERNAL FIRESTORE RECIPE */
        else if (isExternalFirestoreRecipeId(id)) {
          setRecipeAuthor(null);
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

          setRecipe({
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
          });

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          setIngredients(
            ext.map((ing: any) => ({
              name: ing.name,
              quantity: Number(ing.amount ?? 0),
              unit: ing.unit ?? "",
            }))
          );

          await fetchSimilarRecipes(id);

        // External recipe: include nutrition so we can show calories on this page
        } else {
          setRecipeAuthor(null);
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

          setRecipe({
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
          });

          setIngredients(
            (r.extendedIngredients ?? []).map((ing) => ({
              name: ing.name,
              amount: Number((ing.amount ?? 1).toFixed(2)),
              unit: ing.unit ?? "serving",
            })),
          );

          await fetchSimilarRecipes(id);
        }
      } catch (error) {
        console.error("Error fetching recipe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, router]);

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
          onPress={() => {
            if (navigation.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/home");
          }}
          className="absolute left-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
        </TouchableOpacity>

        {/* Favorite Button */}
        <View className="absolute right-4 top-20 flex-row gap-2">
          <TouchableOpacity
            onPress={openSaveModal}
            className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
          >
            <IconSymbol name="bookmark-outline" size={22} color="--color-red-primary" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleFavorite}
            className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
          >
            <IconSymbol
              name={isFavorited ? "cards-heart" : "cards-heart-outline"}
              size={24}
              color="--color-red-primary"
              style={{ transform: [{ translateY: 1 }, { translateX: 0.5 }] }}
            />
          </TouchableOpacity>
        </View>
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

            {recipeAuthor ? (
              <TouchableOpacity
                activeOpacity={0.85}
                className="flex-row items-center gap-3 bg-background rounded-xl p-3 shadow-sm border border-border"
                onPress={() =>
                  router.push({
                    pathname: "/profile/[userId]",
                    params: { userId: recipeAuthor.userId },
                  })
                }
              >
                <View className="w-12 h-12 rounded-full bg-red-primary/15 items-center justify-center">
                  <Text className="text-lg font-bold text-red-primary">
                    {(recipeAuthor.username || "?").trim().slice(0, 1).toUpperCase() || "?"}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-muted-foreground text-xs">Recipe by</Text>
                  <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
                    {recipeAuthor.username || "Savr creator"}
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-0.5">
                    View profile and recipes
                  </Text>
                </View>
                <IconSymbol name="chevron-right" size={22} color="--color-muted-foreground" />
              </TouchableOpacity>
            ) : null}

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
                onPress={() => {
                  void copyRecipeDeepLink();
                }}
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

                {similarLoading ? (
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

      <Modal
        visible={saveModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSaveModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => setSaveModalOpen(false)}
          >
            <Pressable
              className="bg-background rounded-t-3xl max-h-[85%]"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="p-5 gap-4">
                <Text className="text-xl font-bold text-foreground">Save to collection</Text>
                <Text className="text-muted-foreground text-sm">
                  Pick a board or create a new one. This is separate from favorites.
                </Text>

                <View className="gap-2">
                  <Text className="text-foreground font-medium text-sm">New collection</Text>
                  <View className="flex-row gap-2">
                    <TextInput
                      placeholder="Board name"
                      placeholderTextColor="#888"
                      value={newCollectionName}
                      onChangeText={setNewCollectionName}
                      className="flex-1 border border-border rounded-xl px-3 py-2.5 text-foreground"
                      editable={saveActionId !== "__create__"}
                    />
                    <TouchableOpacity
                      className="bg-red-primary px-4 rounded-xl items-center justify-center"
                      onPress={() => void createCollectionAndSave()}
                      disabled={saveActionId === "__create__"}
                    >
                      {saveActionId === "__create__" ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white font-semibold">Add</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <Text className="text-foreground font-medium text-sm">Your collections</Text>
                {saveCollectionsLoading ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator size="large" color="red" />
                  </View>
                ) : saveCollections.length === 0 ? (
                  <Text className="text-muted-foreground text-sm py-2">
                    You do not have any collections yet. Create one above.
                  </Text>
                ) : (
                  <ScrollView className="max-h-64" nestedScrollEnabled>
                    {saveCollections.map((c) => {
                      const saved = collectionContainsRecipe(c);
                      const busy = saveActionId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          className="flex-row items-center justify-between py-3 border-b border-border"
                          onPress={() => void toggleRecipeInCollection(c.id, saved)}
                          disabled={busy}
                        >
                          <View className="flex-1 pr-3">
                            <Text className="text-foreground font-medium" numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                              {c.recipeIds.length}{" "}
                              {c.recipeIds.length === 1 ? "recipe" : "recipes"}
                            </Text>
                          </View>
                          {busy ? (
                            <ActivityIndicator size="small" color="red" />
                          ) : (
                            <IconSymbol
                              name={saved ? "checkbox-marked-circle" : "plus-circle-outline"}
                              size={26}
                              color={saved ? "--color-red-primary" : "--color-muted-foreground"}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                <TouchableOpacity
                  className="py-3 rounded-xl bg-muted-background items-center"
                  onPress={() => setSaveModalOpen(false)}
                >
                  <Text className="font-medium text-foreground">Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
