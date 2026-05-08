"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CACHE_KEYS, CachedRecipeEntry, readCache, recipeDetailKey, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import { useNetwork } from "@/contexts/network-context";

import { SERVER_URL } from "@/utils/server-url";

/** Ingredient shape your backend expects */
export interface ExtendedIngredient {
  id?: number | null;
  name: string;
  original?: string | null;
  amount: number;
  unit: string;
  image?: string | null;
}

/** Recipe as a complete document object returned from GET /api/recipes */
export interface PersonalRecipeItem {
  id: string;
  title: string;
  summary?: string;
  image?: string | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  calories?: number;
  rating?: number;
  reviews?: unknown[];
  extendedIngredients?: ExtendedIngredient[];
  instructions?: string;
  [key: string]: unknown;
}

/** Payload for create/update (ALIGN WITH BACKEND) */
export interface RecipePayload {
  title: string;
  summary?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  extendedIngredients: ExtendedIngredient[];
  instructions: string;
  equipment?: string[];
}

export interface UpdateRecipeImageOptions {
  imageUri?: string | null;
  removeImage?: boolean;
}

interface PersonalRecipesState {
  recipes: PersonalRecipeItem[];
  loading: boolean;
  error: string | null;
}

interface PersonalRecipesContextValue extends PersonalRecipesState {
  refetch: () => Promise<void>;
  createRecipe: (data: RecipePayload, imageUri?: string | null) => Promise<void>;
  updateRecipe: (
    recipeId: string,
    data: RecipePayload,
    imageOptions?: UpdateRecipeImageOptions
  ) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  setRecipes: React.Dispatch<React.SetStateAction<PersonalRecipeItem[]>>;
}

const PersonalRecipesContext = createContext<PersonalRecipesContextValue | null>(null);

// Fetches personal recipes from the server, caches the list, and also caches each
// recipe's detail page entry so it is available offline without a prior individual visit.
async function fetchPersonalRecipes(): Promise<PersonalRecipeItem[]> {
  const idToken = await AsyncStorage.getItem("idToken");
  if (!idToken) return [];

  const res = await fetch(`${SERVER_URL}/api/recipes`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch recipes");

  const list: PersonalRecipeItem[] = Array.isArray(data?.recipes) ? data.recipes : [];

  // Persist the full list for the list screen.
  await writeCache(CACHE_KEYS.PERSONAL_RECIPES, list);

  // Cache each recipe individually so the detail page works offline.
  // The list endpoint already returns complete recipe data, so no extra requests are needed.
  await Promise.allSettled(list.map((recipe) => cachePersonalRecipeDetail(recipe)));

  return list;
}

// Builds a CachedRecipeEntry from a PersonalRecipeItem and writes it to the detail cache.
async function cachePersonalRecipeDetail(recipe: PersonalRecipeItem): Promise<void> {
  try {
    const reviewCount = typeof (recipe as any).reviewCount === "number"
      ? (recipe as any).reviewCount
      : (Array.isArray(recipe.reviews) ? recipe.reviews.length : 0);
    const totalStars = typeof (recipe as any).totalStars === "number"
      ? (recipe as any).totalStars
      : (Array.isArray(recipe.reviews)
        ? (recipe.reviews as any[]).reduce((s: number, rev: any) => s + (rev?.rating ?? 0), 0)
        : 0);
    const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

    const nutritionNutrients = (recipe as any)?.nutrition?.nutrients;
    const calories = Array.isArray(nutritionNutrients)
      ? Math.round(Number(nutritionNutrients.find((n: any) => n?.name === "Calories")?.amount ?? 0)) || undefined
      : recipe.calories;

    const entry: CachedRecipeEntry = {
      recipe: {
        title: recipe.title,
        image: recipe.image,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        readyInMinutes: (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0),
        servings: recipe.servings,
        summary: recipe.summary,
        instructions: recipe.instructions,
        calories,
        rating: avgRating,
        reviewsLength: reviewCount,
        viewCount: typeof (recipe as any).viewCount === "number" ? (recipe as any).viewCount : 0,
        price: (recipe as any).price,
      },
      ingredients: Array.isArray(recipe.extendedIngredients)
        ? recipe.extendedIngredients.map((ing) => ({
          name: ing.name,
          quantity: Number(ing.amount ?? 0),
          unit: ing.unit ?? "",
        }))
        : [],
    };

    await writeCache(recipeDetailKey(recipe.id), entry);
  } catch {
    // Non-fatal; if caching a single recipe fails the rest are unaffected.
  }
}

/** HELPER: append image to FormData */
const _appendImageToFormData = (formData: FormData, imageUri: string): void => {
  const filename = imageUri.split("/").pop() || "recipe-image.jpg";
  const match = filename.toLowerCase().match(/\.(jpe?g|png|gif|webp)$/);
  const mimeType = match
    ? match[1] === "jpg" || match[1] === "jpeg"
      ? "image/jpeg"
      : `image/${match[1]}`
    : "image/jpeg";

  formData.append("image", {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
};

export function PersonalRecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<PersonalRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } = useNetwork();

  // Ref keeps isOnline current inside stable useCallback closures, avoiding stale
  // closure captures that occur when callbacks are registered before a state update commits.
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Stable refetch: no dependency on isOnline state. Reads the ref at call time so
  // reconnect callbacks always see the correct (post-commit) online status.
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isOnlineRef.current) {
        const list = await fetchPersonalRecipes();
        setRecipes(list);
      } else {
        // Serve cached data while offline; avoid a failed network request.
        const cached = await readCache<PersonalRecipeItem[]>(CACHE_KEYS.PERSONAL_RECIPES);
        setRecipes(cached ?? []);
        if (!cached) setError("No cached recipes available offline.");
      }
    } catch (e) {
      // Fall back to cache if the server request fails (e.g. flaky connection).
      const cached = await readCache<PersonalRecipeItem[]>(CACHE_KEYS.PERSONAL_RECIPES);
      if (cached) {
        setRecipes(cached);
      } else {
        setError(e instanceof Error ? e.message : "Failed to fetch recipes");
        setRecipes([]);
      }
    } finally {
      setLoading(false);
    }
  }, []); // Stable -- reads isOnline via ref, not closure

  /** Create recipe in database - requires an internet connection */
  const createRecipe = useCallback(
    async (data: RecipePayload, imageUri?: string | null) => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");

      if (!Array.isArray(data.extendedIngredients) || data.extendedIngredients.length === 0) {
        throw new Error("At least one ingredient is required (extendedIngredients).");
      }

      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("summary", data.summary ?? "");
      formData.append("prepTime", String(data.prepTime ?? 0));
      formData.append("cookTime", String(data.cookTime ?? 0));
      formData.append("servings", String(data.servings ?? 1));
      formData.append("instructions", data.instructions ?? "");
      formData.append("extendedIngredients", JSON.stringify(data.extendedIngredients));
      formData.append("equipment", JSON.stringify(Array.isArray(data.equipment) ? data.equipment : []));

      if (imageUri) _appendImageToFormData(formData, imageUri);

      const res = await fetch(`${SERVER_URL}/api/recipes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(json?.error)
            ? json.error.join("\n")
            : json?.error || "Failed to create recipe"
        );
      }

      await refetch();
    },
    [refetch]
  );

  /** Update recipe in database - requires an internet connection */
  const updateRecipe = useCallback(
    async (recipeId: string, data: RecipePayload, imageOptions?: UpdateRecipeImageOptions) => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");

      if (!Array.isArray(data.extendedIngredients) || data.extendedIngredients.length === 0) {
        throw new Error("At least one ingredient is required (extendedIngredients).");
      }

      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("summary", data.summary ?? "");
      formData.append("prepTime", String(data.prepTime ?? 0));
      formData.append("cookTime", String(data.cookTime ?? 0));
      formData.append("servings", String(data.servings ?? 1));
      formData.append("instructions", data.instructions ?? "");
      formData.append("extendedIngredients", JSON.stringify(data.extendedIngredients));
      formData.append("equipment", JSON.stringify(Array.isArray(data.equipment) ? data.equipment : []));

      if (imageOptions?.removeImage) formData.append("removeImage", "true");
      else if (imageOptions?.imageUri) _appendImageToFormData(formData, imageOptions.imageUri);

      const res = await fetch(`${SERVER_URL}/api/recipes/${recipeId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(json?.error)
            ? json.error.join("\n")
            : json?.error || "Failed to update recipe"
        );
      }

      await refetch();
    },
    [refetch]
  );

  // Deletes a recipe. When offline the deletion is queued and the local state is updated
  // optimistically so the UI reflects the change immediately.
  const deleteRecipe = useCallback(
    async (id: string) => {
      if (!isOnlineRef.current) {
        await enqueueMutation({ type: "DELETE_PERSONAL_RECIPE", payload: { id } });
        const updated = recipes.filter((r) => r.id !== id);
        setRecipes(updated);
        await writeCache(CACHE_KEYS.PERSONAL_RECIPES, updated);
        return;
      }

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");

      const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to delete recipe");
      await refetch();
    },
    [recipes, refetch] // isOnline read via ref; no dep needed
  );

  useEffect(() => {
    refetch();
  }, []);

  // Refresh from server when connectivity is restored.
  useEffect(() => {
    registerReconnectCallback("personalRecipes", refetch);
    return () => unregisterReconnectCallback("personalRecipes");
  }, [refetch, registerReconnectCallback, unregisterReconnectCallback]);

  const value: PersonalRecipesContextValue = {
    recipes,
    loading,
    error,
    refetch,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    setRecipes,
  };

  return <PersonalRecipesContext.Provider value={value}>{children}</PersonalRecipesContext.Provider>;
}

export function usePersonalRecipes(): PersonalRecipesContextValue {
  const ctx = useContext(PersonalRecipesContext);
  if (!ctx) throw new Error("usePersonalRecipes must be used within PersonalRecipesProvider");
  return ctx;
}
