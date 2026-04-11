import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CACHE_KEYS, CachedRecipeEntry, readCache, recipeDetailKey, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import { useNetwork } from "@/contexts/network-context";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

export interface MealPlanItem {
  id: string;
  userID: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  start_date: string | null; // ISO
  end_date: string | null; // ISO
}

// Payload shape for creating a new meal plan (matches the server's POST /api/meal-plans body).
export interface CreateMealPlanPayload {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  start_date: string;
  end_date: string;
}

interface MealPlansState {
  mealPlans: MealPlanItem[];
  loading: boolean;
  error: string | null;
}

interface MealPlansContextValue extends MealPlansState {
  refetch: () => Promise<void>;
  setMealPlans: React.Dispatch<React.SetStateAction<MealPlanItem[]>>;
  createMealPlan: (payload: CreateMealPlanPayload) => Promise<void>;
}

const MealPlansContext = createContext<MealPlansContextValue | null>(null);

// Fetches all meal plans for the current user and caches the result locally.
// Also pre-fetches each referenced recipe so they are available on the detail page offline.
async function fetchAndCacheMealPlans(): Promise<MealPlanItem[]> {
  const idToken = await AsyncStorage.getItem("idToken");
  if (!idToken) return [];

  const res = await fetch(`${SERVER_URL}/api/meal-plans`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to fetch meal plans");

  const list: MealPlanItem[] = Array.isArray(data?.mealPlans) ? data.mealPlans : [];

  // Persist the list so it can be served to the UI when the device is offline.
  await writeCache(CACHE_KEYS.MEAL_PLANS, list);

  // Collect all unique recipe IDs across every meal plan slot.
  const recipeIds = new Set<string>();
  for (const plan of list) {
    if (plan.breakfast) recipeIds.add(plan.breakfast);
    if (plan.lunch) recipeIds.add(plan.lunch);
    if (plan.dinner) recipeIds.add(plan.dinner);
  }

  // Pre-fetch and cache each recipe so the detail page loads offline without a prior manual visit.
  await Promise.allSettled(
    Array.from(recipeIds).map((id) => prefetchAndCacheRecipe(id, idToken))
  );

  return list;
}

// Fetches a single recipe, normalises it into CachedRecipeEntry shape, and stores it.
// Saving in the correct shape ensures the recipe detail page can read it offline.
async function prefetchAndCacheRecipe(id: string, idToken: string): Promise<void> {
  // Recipes whose id is not all digits are personal (Firestore) recipes.
  const isPersonal = !/^\d+$/.test(id);
  try {
    if (isPersonal) {
      const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const r = data?.recipe;
      if (!r) return;

      const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : (Array.isArray(r.reviews) ? r.reviews.length : 0);
      const totalStars = typeof r.totalStars === "number" ? r.totalStars : (Array.isArray(r.reviews) ? r.reviews.reduce((s: number, rev: any) => s + (rev?.rating ?? 0), 0) : 0);
      const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

      const entry: CachedRecipeEntry = {
        recipe: {
          title: r.title,
          image: r.image,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          readyInMinutes: (r.prepTime ?? 0) + (r.cookTime ?? 0),
          servings: r.servings,
          summary: r.summary,
          instructions: r.instructions,
          calories: Array.isArray(r?.nutrition?.nutrients)
            ? Math.round(Number(r.nutrition.nutrients.find((n: any) => n?.name === "Calories")?.amount ?? 0)) || undefined
            : r.calories,
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
      await writeCache(recipeDetailKey(id), entry);
    } else {
      const res = await fetch(`${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`);
      if (!res.ok) return;
      const data = await res.json();
      const r = data?.recipe;
      if (!r) return;

      const caloriesNutrient = r.nutrition?.nutrients?.find((n: any) => n.name === "Calories");
      const calories = caloriesNutrient?.amount != null ? Math.round(Number(caloriesNutrient.amount)) : undefined;
      const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : 0;
      const totalStars = typeof r.totalStars === "number" ? r.totalStars : 0;
      const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

      const entry: CachedRecipeEntry = {
        recipe: {
          title: r.title,
          image: r.image,
          readyInMinutes: r.readyInMinutes,
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
            amount: Number((ing.amount ?? 1).toFixed(2)),
            unit: ing.unit ?? "serving",
          }))
          : [],
      };
      await writeCache(recipeDetailKey(id), entry);
    }
  } catch {
    // Pre-fetch failures are non-fatal; the recipe will simply not be available offline.
  }
}

export function MealPlansProvider({ children }: { children: React.ReactNode }) {
  const [mealPlans, setMealPlans] = useState<MealPlanItem[]>([]);
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
        const list = await fetchAndCacheMealPlans();
        setMealPlans(list);
      } else {
        // Device is offline; serve the last known list from cache.
        const cached = await readCache<MealPlanItem[]>(CACHE_KEYS.MEAL_PLANS);
        setMealPlans(cached ?? []);
        if (!cached) setError("No cached meal plans available offline.");
      }
    } catch (e) {
      // Network request failed; fall back to cache rather than showing an empty state.
      const cached = await readCache<MealPlanItem[]>(CACHE_KEYS.MEAL_PLANS);
      if (cached) {
        setMealPlans(cached);
      } else {
        setError(e instanceof Error ? e.message : "Failed to fetch meal plans");
        setMealPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, []); // Stable -- reads isOnline via ref, not closure

  // Creates a meal plan. When online this calls the server directly; when offline the operation
  // is queued for replay and the local state is updated optimistically.
  const createMealPlan = useCallback(
    async (payload: CreateMealPlanPayload) => {
      if (!isOnlineRef.current) {
        await enqueueMutation({ type: "CREATE_MEAL_PLAN", payload });

        // Build a temporary local record so the calendar reflects the new plan immediately.
        const optimisticPlan: MealPlanItem = {
          id: `pending_${Date.now()}`,
          userID: "",
          breakfast: payload.breakfast[0] ?? null,
          lunch: payload.lunch[0] ?? null,
          dinner: payload.dinner[0] ?? null,
          start_date: payload.start_date,
          end_date: payload.end_date,
        };
        const updated = [...mealPlans, optimisticPlan];
        setMealPlans(updated);
        await writeCache(CACHE_KEYS.MEAL_PLANS, updated);
        return;
      }

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Not signed in");

      const res = await fetch(`${SERVER_URL}/api/meal-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save meal plan");
      }

      await refetch();
    },
    [mealPlans, refetch] // isOnline read via ref; no dep needed
  );

  useEffect(() => {
    refetch();
  }, []);

  // refetch is now stable, so registration happens once and the callback always
  // reads the current isOnline value from the ref.
  useEffect(() => {
    registerReconnectCallback("mealPlans", refetch);
    return () => unregisterReconnectCallback("mealPlans");
  }, [refetch, registerReconnectCallback, unregisterReconnectCallback]);

  const value: MealPlansContextValue = {
    mealPlans,
    loading,
    error,
    refetch,
    setMealPlans,
    createMealPlan,
  };

  return <MealPlansContext.Provider value={value}>{children}</MealPlansContext.Provider>;
}

export function useMealPlans(): MealPlansContextValue {
  const ctx = useContext(MealPlansContext);
  if (!ctx) throw new Error("useMealPlans must be used within MealPlansProvider");
  return ctx;
}
