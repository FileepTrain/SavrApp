//app/(toolbar)/account/favorites.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useNetwork } from "@/contexts/network-context";
import { CACHE_KEYS, CachedRecipeEntry, readCache, recipeDetailKey, writeCache } from "@/utils/offline-cache";
import { CommonActions } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import { RecipeCard } from "@/components/recipe-card";

const SERVER_URL = "http://10.0.2.2:3000";

function singleQueryParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) return String(v[0]).trim();
  return undefined;
}

// Normalises a raw recipe object returned by the favorites API and writes it to the
// per-recipe detail cache so the detail page can load without a prior individual visit.
async function cacheFavoriteRecipeDetail(r: any): Promise<void> {
  if (!r?.id) return;
  try {
    const isPersonal = !/^\d+$/.test(String(r.id));

    const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : (Array.isArray(r.reviews) ? r.reviews.length : 0);
    const totalStars = typeof r.totalStars === "number" ? r.totalStars : (Array.isArray(r.reviews) ? r.reviews.reduce((s: number, rev: any) => s + (rev?.rating ?? 0), 0) : 0);
    const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

    let calories: number | undefined;
    if (Array.isArray(r.nutrition?.nutrients)) {
      const cal = r.nutrition.nutrients.find((n: any) => n?.name === "Calories");
      calories = cal?.amount != null ? Math.round(Number(cal.amount)) || undefined : undefined;
    } else {
      calories = r.calories;
    }

    const entry: CachedRecipeEntry = {
      recipe: {
        title: r.title,
        image: r.image,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        readyInMinutes: isPersonal ? ((r.prepTime ?? 0) + (r.cookTime ?? 0)) : r.readyInMinutes,
        servings: r.servings,
        summary: r.summary,
        instructions: r.instructions,
        equipment: r.equipment ?? [],
        calories,
        rating: avgRating,
        reviewsLength: reviewCount,
        viewCount: typeof r.viewCount === "number" ? r.viewCount : 0,
        price: r.price,
      },
      ingredients: Array.isArray(r.extendedIngredients)
        ? r.extendedIngredients.map((ing: any) => ({
          name: ing.name,
          quantity: Number(ing.amount ?? 0),
          unit: ing.unit ?? "",
        }))
        : [],
    };

    await writeCache(recipeDetailKey(String(r.id)), entry);
  } catch {
    // Non-fatal.
  }
}

export default function FavoritesPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { mode, mealPlanId, mealPlanDate } = useLocalSearchParams<{
    mode?: string;
    mealPlanId?: string;
    mealPlanDate?: string;
  }>();
  const { setPendingSelectedRecipe } = useMealPlanSelection();
  const isSelectionMode = mode === "select";
  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } = useNetwork();

  // Ref keeps isOnline current inside stable useCallback closures, avoiding stale
  // closure captures when the reconnect callback fires before React re-renders.
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const handleSelectRecipe = (recipe: { id: string;[key: string]: unknown }) => {
    setPendingSelectedRecipe(recipe);
    const returnPlanId = singleQueryParam(mealPlanId);
    const returnDate = singleQueryParam(mealPlanDate);
    // Cross-tab pickers used to `push` a bare `/calendar/meal-plan`, which dropped `mealPlanId` and forced POST on save.
    if (returnPlanId || returnDate) {
      router.navigate({
        pathname: "/calendar/meal-plan",
        params: {
          ...(returnPlanId ? { mealPlanId: returnPlanId } : {}),
          ...(returnDate ? { date: returnDate } : {}),
        },
      });
      // `navigate` switches to Calendar but leaves Favorites on the Account stack; reset so Account tab opens on its root.
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "index" }],
          }),
        );
      }, 0);
    } else {
      router.back();
    }
  };
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Stable fetchFavorites: reads isOnline from ref at call time so reconnect callbacks
  // always see the post-commit online status without needing to re-register.
  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);

      if (!isOnlineRef.current) {
        // Read the full recipe objects from cache, then filter by the locally stored
        // favorite IDs so that any offline toggle is reflected immediately.
        const ids = await readCache<string[]>(CACHE_KEYS.FAVORITES_IDS) ?? [];
        const allCached = await readCache<any[]>(CACHE_KEYS.FAVORITES_LIST) ?? [];
        setFavorites(allCached.filter((r: any) => ids.includes(String(r.id))));
        return;
      }

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
      // Ensure only plain strings are stored; the server returns an array of IDs.
      const favoriteIds: string[] = (data.favoriteIds ?? []).map(String);

      const recipePromises = favoriteIds.map(async (id) => {
        try {
          // Non-numeric IDs are personal recipes or Firestore-stored external recipes;
          // both live under /api/recipes/:id and require authentication.
          const isFirestoreRecipe = !/^\d+$/.test(id);

          if (isFirestoreRecipe) {
            const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
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

      // Store the plain ID list so [recipeId].tsx can check isFavorited without
      // touching the full recipe objects cache.
      await writeCache(CACHE_KEYS.FAVORITES_IDS, favoriteIds);

      // Cache the full recipe objects for the offline display list.
      await writeCache(CACHE_KEYS.FAVORITES_LIST, validRecipes);

      // Cache each recipe individually so the detail page works offline.
      await Promise.allSettled(
        validRecipes.map((r: any) => cacheFavoriteRecipeDetail(r))
      );

      setFavorites(validRecipes);

    } catch (error) {
      console.error("Error fetching favorite recipes:", error);
      // If the server request fails, fall back to the previously cached list.
      const cached = await readCache<any[]>(CACHE_KEYS.FAVORITES_LIST);
      if (cached) setFavorites(cached);
    } finally {
      setLoading(false);
    }
  }, []); // Stable -- reads isOnline via ref, not closure

  // Re-fetch whenever this screen comes into focus so that a favorite toggled on the
  // detail page is immediately reflected here without requiring a full app restart.
  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites])
  );

  // Re-fetch after connectivity is restored and the mutation queue has been synced.
  useEffect(() => {
    registerReconnectCallback("favorites", fetchFavorites);
    return () => unregisterReconnectCallback("favorites");
  }, [fetchFavorites, registerReconnectCallback, unregisterReconnectCallback]);

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
            ListEmptyComponent={
              <Text className="text-center text-foreground opacity-60 mt-6">
                {isOnline ? "No favorited recipes yet." : "No favorited recipes available offline."}
              </Text>
            }
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
