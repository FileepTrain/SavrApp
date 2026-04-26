import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  CACHE_KEYS,
  CachedRecipeEntry,
  readCache,
  recipeDetailKey,
  writeCache,
} from "@/utils/offline-cache";
import {
  enqueueMutation,
  mergePendingMealPlanEdit,
  removeQueuedMealPlanCreate,
} from "@/utils/mutation-queue";
import { useNetwork } from "@/contexts/network-context";
import {
  mealSlotEntriesFromPlanField,
  slotEntriesToStoredString,
  type MealPlanSlotEntry,
} from "@/utils/meal-plan-slot";
import {
  buildMealPlanHabitDaysFromPlanFields,
  normalizeHabitDaysFromApi,
  planCoversCalendarDateLocal,
  type MealPlanHabitDay,
} from "@/utils/meal-plan-habit-days";

import { SERVER_URL } from "@/utils/server-url";

export type { MealPlanHabitDay };

export interface MealPlanItem {
  id: string;
  userID: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  start_date: string | null; // ISO
  end_date: string | null; // ISO
  /** Per-day recipe assignments + habit flag; from API or derived locally when offline. */
  habitDays?: MealPlanHabitDay[];
}

// Payload shape for creating a new meal plan (matches the server's POST /api/meal-plans body).
export interface CreateMealPlanPayload {
  breakfast: MealPlanSlotEntry[];
  lunch: MealPlanSlotEntry[];
  dinner: MealPlanSlotEntry[];
  start_date: string;
  end_date: string;
}

export type { MealPlanSlotEntry } from "@/utils/meal-plan-slot";

function slotToStored(entries: MealPlanSlotEntry[]): string | null {
  return slotEntriesToStoredString(entries);
}

function newClientMealPlanId(): string {
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPendingMealPlanId(planId: string): boolean {
  return planId.startsWith("pending_");
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
  updateMealPlan: (planId: string, payload: CreateMealPlanPayload) => Promise<void>;
  deleteMealPlan: (planId: string) => Promise<void>;
  /** Toggles `followedPlan` for one date (server); requires online. */
  toggleMealPlanHabitDay: (planId: string, dateKey: string) => Promise<void>;
  /** Double-tap calendar: toggles habit for every meal plan that includes `dateKey`; one refetch. */
  toggleHabitsForCalendarDate: (dateKey: string) => Promise<void>;
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

  const rawList = Array.isArray(data?.mealPlans) ? data.mealPlans : [];
  const list: MealPlanItem[] = rawList.map((raw: Record<string, unknown>) => {
    const start = raw.start_date != null ? String(raw.start_date) : null;
    const end = raw.end_date != null ? String(raw.end_date) : null;
    const habitFromApi = normalizeHabitDaysFromApi(raw.habitDays);
    const habitDays =
      habitFromApi ??
      (start && end
        ? buildMealPlanHabitDaysFromPlanFields(
            start,
            end,
            raw.breakfast,
            raw.lunch,
            raw.dinner,
          )
        : undefined);
    return {
      id: String(raw.id ?? ""),
      userID: String(raw.userID ?? ""),
      breakfast: raw.breakfast != null ? (raw.breakfast as string | null) : null,
      lunch: raw.lunch != null ? (raw.lunch as string | null) : null,
      dinner: raw.dinner != null ? (raw.dinner as string | null) : null,
      start_date: start,
      end_date: end,
      habitDays,
    };
  });

  // Persist the list so it can be served to the UI when the device is offline.
  await writeCache(CACHE_KEYS.MEAL_PLANS, list);

  // Collect all unique recipe IDs across every meal plan slot.
  const recipeIds = new Set<string>();
  for (const plan of list) {
    for (const e of mealSlotEntriesFromPlanField(plan.breakfast)) recipeIds.add(e.id);
    for (const e of mealSlotEntriesFromPlanField(plan.lunch)) recipeIds.add(e.id);
    for (const e of mealSlotEntriesFromPlanField(plan.dinner)) recipeIds.add(e.id);
  }

  // Pre-fetch and cache each recipe so the detail page loads offline without a prior manual visit.
  await Promise.allSettled(Array.from(recipeIds).map((id) => prefetchAndCacheRecipe(id, idToken)));

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

      const reviewCount =
        typeof r.reviewCount === "number"
          ? r.reviewCount
          : Array.isArray(r.reviews)
            ? r.reviews.length
            : 0;
      const totalStars =
        typeof r.totalStars === "number"
          ? r.totalStars
          : Array.isArray(r.reviews)
            ? r.reviews.reduce((s: number, rev: any) => s + (rev?.rating ?? 0), 0)
            : 0;
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
            ? Math.round(Number(r.nutrition.nutrients.find((n: any) => n?.name === "Calories")?.amount ?? 0)) ||
            undefined
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
      const calories =
        caloriesNutrient?.amount != null ? Math.round(Number(caloriesNutrient.amount)) : undefined;
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

function applyMealPlanPatchToList(
  list: MealPlanItem[],
  planId: string,
  payload: CreateMealPlanPayload,
): MealPlanItem[] {
  return list.map((p) => {
    if (p.id !== planId) return p;
    const nextHabit = buildMealPlanHabitDaysFromPlanFields(
      payload.start_date,
      payload.end_date,
      payload.breakfast,
      payload.lunch,
      payload.dinner,
    ).map((row) => {
      const old = p.habitDays?.find((h) => h.date === row.date);
      return { ...row, followedPlan: old?.followedPlan ?? false };
    });
    return {
      ...p,
      breakfast: slotToStored(payload.breakfast),
      lunch: slotToStored(payload.lunch),
      dinner: slotToStored(payload.dinner),
      start_date: payload.start_date,
      end_date: payload.end_date,
      habitDays: nextHabit,
    };
  });
}

export function MealPlansProvider({ children }: { children: React.ReactNode }) {
  const [mealPlans, setMealPlans] = useState<MealPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } = useNetwork();

  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isOnlineRef.current) {
        const list = await fetchAndCacheMealPlans();
        setMealPlans(list);
      } else {
        const cached = await readCache<MealPlanItem[]>(CACHE_KEYS.MEAL_PLANS);
        setMealPlans(cached ?? []);
        if (!cached) setError("No cached meal plans available offline.");
      }
    } catch (e) {
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
  }, []);

  const createMealPlan = useCallback(
    async (payload: CreateMealPlanPayload) => {
      if (!isOnlineRef.current) {
        const clientPlanId = newClientMealPlanId();
        await enqueueMutation({
          type: "CREATE_MEAL_PLAN",
          payload: { ...payload, clientPlanId },
        });

        const optimisticPlan: MealPlanItem = {
          id: clientPlanId,
          userID: "",
          breakfast: slotToStored(payload.breakfast),
          lunch: slotToStored(payload.lunch),
          dinner: slotToStored(payload.dinner),
          start_date: payload.start_date,
          end_date: payload.end_date,
          habitDays: buildMealPlanHabitDaysFromPlanFields(
            payload.start_date,
            payload.end_date,
            payload.breakfast,
            payload.lunch,
            payload.dinner,
          ),
        };
        setMealPlans((prev) => {
          const updated = [...prev, optimisticPlan];
          void writeCache(CACHE_KEYS.MEAL_PLANS, updated);
          return updated;
        });
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
    [refetch],
  );

  const updateMealPlan = useCallback(
    async (planId: string, payload: CreateMealPlanPayload) => {
      if (!isOnlineRef.current) {
        if (isPendingMealPlanId(planId)) {
          const merged = await mergePendingMealPlanEdit(planId, payload);
          if (!merged) {
            await enqueueMutation({
              type: "CREATE_MEAL_PLAN",
              payload: { ...payload, clientPlanId: planId },
            });
          }
        } else {
          await enqueueMutation({
            type: "UPDATE_MEAL_PLAN",
            payload: {
              planId,
              breakfast: payload.breakfast,
              lunch: payload.lunch,
              dinner: payload.dinner,
              start_date: payload.start_date,
              end_date: payload.end_date,
            },
          });
        }
        setMealPlans((prev) => {
          const updated = applyMealPlanPatchToList(prev, planId, payload);
          void writeCache(CACHE_KEYS.MEAL_PLANS, updated);
          return updated;
        });
        return;
      }

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Not signed in");

      const res = await fetch(`${SERVER_URL}/api/meal-plans/${encodeURIComponent(planId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update meal plan");
      }

      await refetch();
    },
    [refetch],
  );

  const deleteMealPlan = useCallback(
    async (planId: string) => {
      if (!isOnlineRef.current) {
        if (isPendingMealPlanId(planId)) {
          await removeQueuedMealPlanCreate(planId);
        } else {
          await enqueueMutation({ type: "DELETE_MEAL_PLAN", payload: { planId } });
        }
        setMealPlans((prev) => {
          const updated = prev.filter((p) => p.id !== planId);
          void writeCache(CACHE_KEYS.MEAL_PLANS, updated);
          return updated;
        });
        return;
      }

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Not signed in");

      const res = await fetch(`${SERVER_URL}/api/meal-plans/${encodeURIComponent(planId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete meal plan");
      }

      setMealPlans((prev) => {
        const updated = prev.filter((p) => p.id !== planId);
        void writeCache(CACHE_KEYS.MEAL_PLANS, updated);
        return updated;
      });
      await refetch();
    },
    [refetch],
  );

  const toggleMealPlanHabitDay = useCallback(
    async (planId: string, dateKey: string) => {
      if (!isOnlineRef.current) {
        throw new Error("Habit tracking requires an internet connection.");
      }
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Not signed in");

      const res = await fetch(
        `${SERVER_URL}/api/meal-plans/${encodeURIComponent(planId)}/habit-day`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ date: dateKey }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update habit day");
      }

      await refetch();
    },
    [refetch],
  );

  const toggleHabitsForCalendarDate = useCallback(
    async (dateKey: string) => {
      if (!isOnlineRef.current) {
        throw new Error("Habit tracking requires an internet connection.");
      }
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Not signed in");

      const targets = mealPlans.filter(
        (p) =>
          p.habitDays?.some((h) => h.date === dateKey) ||
          planCoversCalendarDateLocal(p.start_date, p.end_date, dateKey),
      );
      if (targets.length === 0) return;

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      };

      const results = await Promise.all(
        targets.map((p) =>
          fetch(`${SERVER_URL}/api/meal-plans/${encodeURIComponent(p.id)}/habit-day`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ date: dateKey }),
          }),
        ),
      );

      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update habit day");
      }

      await refetch();
    },
    [mealPlans, refetch],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

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
    updateMealPlan,
    deleteMealPlan,
    toggleMealPlanHabitDay,
    toggleHabitsForCalendarDate,
  };

  return <MealPlansContext.Provider value={value}>{children}</MealPlansContext.Provider>;
}

export function useMealPlans(): MealPlansContextValue {
  const ctx = useContext(MealPlansContext);
  if (!ctx) throw new Error("useMealPlans must be used within MealPlansProvider");
  return ctx;
}
