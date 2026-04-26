// app/(toolbar)/calendar/meal-plan.tsx
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import type { Recipe } from "@/contexts/meal-plan-selection-context";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useMealPlanFilter } from "@/contexts/meal-plan-filter-context";
import { useMealPlans } from "@/contexts/meal-plans-context";
import { useNetwork } from "@/contexts/network-context";
import { CACHE_KEYS, type CachedRecipeEntry, readCache, recipeDetailKey } from "@/utils/offline-cache";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View, Modal, ScrollView, Switch, Platform } from "react-native";
import { useThemePalette } from "@/components/theme-provider";
import Button from "@/components/ui/button";
import { SwipeableRecipeCardRemovable } from "@/components/swipeable-recipe-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  mealSlotEntriesFromPlanField,
  type MealPlanSlotEntry,
} from "@/utils/meal-plan-slot";
import { loadUserCookware } from "@/utils/cookware";

import { SERVER_URL } from "@/utils/server-url";

const NativeDateTimePicker =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@react-native-community/datetimepicker").default as React.ComponentType<{
        value: Date;
        mode: "date";
        display: "calendar";
        onChange: (event: unknown, selectedDate?: Date) => void;
      }>);

function mergeRecipeWithSlotEntry(recipe: Recipe, entry: MealPlanSlotEntry): Recipe {
  const fromRecipe =
    typeof recipe.servings === "number" &&
    Number.isFinite(recipe.servings) &&
    recipe.servings > 0
      ? Math.floor(recipe.servings)
      : undefined;
  return {
    ...recipe,
    servings: fromRecipe ?? entry.baseServings,
  };
}

function countRecordFromSlots(
  b: MealPlanSlotEntry[],
  l: MealPlanSlotEntry[],
  d: MealPlanSlotEntry[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of [...b, ...l, ...d]) out[e.id] = e.targetServings;
  return out;
}

function batchRecordFromSlots(
  b: MealPlanSlotEntry[],
  l: MealPlanSlotEntry[],
  d: MealPlanSlotEntry[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of [...b, ...l, ...d]) out[e.id] = e.batchMultiplier;
  return out;
}

/** Spoonacular / cache may expose servings as number or string. */
function coercePositiveServings(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const n = Number(String(value).trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return undefined;
}

function getRecipeBaseServings(recipe: Recipe): number {
  return coercePositiveServings(recipe.servings) ?? 1;
}

/**
 * Days one meal slot spans: recipes are used in order, each for `targetServings` consecutive days
 * (same rule as `habitDays` / server `assignRecipeIdsForSlot`). Total for the slot = sum of those values.
 */
function slotSpanDaysFromTargetServings(
  recipes: Recipe[],
  targetServingsByRecipeId: Record<string, number>,
): number {
  if (!recipes.length) return 0;
  let sum = 0;
  for (const recipe of recipes) {
    const raw = targetServingsByRecipeId[recipe.id];
    const n =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
    sum += n;
  }
  return sum;
}

/** Inclusive plan length: longest breakfast / lunch / dinner rotation (at least 1 day). */
function maxEstimatedPlanDaysFromSlots(
  breakfast: Recipe[],
  lunch: Recipe[],
  dinner: Recipe[],
  targetServingsByRecipeId: Record<string, number>,
  _batchMultiplier: Record<string, number>,
): number {
  const b = slotSpanDaysFromTargetServings(breakfast, targetServingsByRecipeId);
  const l = slotSpanDaysFromTargetServings(lunch, targetServingsByRecipeId);
  const d = slotSpanDaysFromTargetServings(dinner, targetServingsByRecipeId);
  const max = Math.max(b, l, d);
  return max > 0 ? max : 1;
}

function endDateFromStartAndMaxDays(start: Date, maxDays: number): Date {
  const out = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (maxDays <= 0) return out;
  out.setDate(out.getDate() + maxDays - 1);
  return out;
}

function dateOnlyToLocalDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (y == null || m == null || d == null) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** `YYYY-MM-DD` for `<input type="date" />` (local calendar). */
function formatLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeRecipeFromApi(json: unknown, fallbackId: string): Recipe {
  const body = json as { recipe?: Recipe } | Recipe | null;
  const r = body && typeof body === "object" && "recipe" in body ? (body as { recipe?: Recipe }).recipe : (body as Recipe | null);
  if (!r || typeof r !== "object") return { id: fallbackId };
  const servings = coercePositiveServings((r as Recipe).servings);
  return {
    id: String((r as Recipe).id ?? fallbackId),
    title: (r as Recipe).title,
    calories: typeof (r as Recipe).calories === "number" ? (r as Recipe).calories : undefined,
    rating: typeof (r as Recipe).rating === "number" ? (r as Recipe).rating : undefined,
    reviews: Array.isArray((r as Recipe).reviews) ? (r as Recipe).reviews : undefined,
    image: (r as Recipe).image ?? ((r as Recipe).imageUrl as string | undefined),
    servings,
  };
}

/** Fills title/image/etc. from the offline recipe detail cache when the API did not return a row. */
async function recipeFromDetailCache(rid: string): Promise<Recipe | null> {
  const cached = await readCache<CachedRecipeEntry>(recipeDetailKey(rid));
  if (!cached?.recipe?.title) return null;
  const r = cached.recipe;
  const revLen = typeof r.reviewsLength === "number" ? r.reviewsLength : 0;
  const servings = coercePositiveServings(r.servings);
  return {
    id: rid,
    title: r.title,
    calories: typeof r.calories === "number" ? r.calories : undefined,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    reviews: revLen > 0 ? Array.from({ length: revLen }, () => ({})) : undefined,
    image: r.image ?? undefined,
    servings,
  };
}

async function hydrateRecipesFromDetailCache(ids: string[], byId: Record<string, Recipe>): Promise<void> {
  await Promise.all(
    ids.map(async (rid) => {
      const existing = byId[rid];
      if (existing?.title) return;
      const fromCache = await recipeFromDetailCache(rid);
      if (fromCache) byId[rid] = fromCache;
    }),
  );
}

const CAL_SLIDER_MIN = 100;
const CAL_SLIDER_MAX = 1200;
const CAL_SLIDER_STEP = 25;

type MealSlot = "Breakfast" | "Lunch" | "Dinner";

function singleQueryParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) return String(v[0]).trim();
  return undefined;
}

export default function MealPlanPage() {
  const theme = useThemePalette();
  const routeParams = useLocalSearchParams<{ date?: string; mealPlanId?: string }>();

  const mealPlanIdParam = useMemo(() => {
    const id = singleQueryParam(routeParams.mealPlanId);
    return id ?? null;
  }, [routeParams.mealPlanId]);

  const dateParam = useMemo(() => {
    const d = singleQueryParam(routeParams.date);
    return d ?? null;
  }, [routeParams.date]);

  const [start_date, setStartDate] = useState(new Date());
  const [end_date, setEndDate] = useState(new Date());
  const [loadingPlan, setLoadingPlan] = useState(() => !!mealPlanIdParam);

  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<"start" | null>(null);

  const [visible, setVisible] = useState(false);
  const [pendingMealSlot, setPendingMealSlot] = useState<MealSlot | null>(null);
  //Meal state arrays
  const [breakfastRecipe, setBreakfastRecipe] = useState<Recipe[]>([]);
  const [lunchRecipe, setLunchRecipe] = useState<Recipe[]>([]);
  const [dinnerRecipe, setDinnerRecipe] = useState<Recipe[]>([]);

  //button states
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  //calorie states
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [calorieMin, setCalorieMin] = useState(400);
  const [calorieMax, setCalorieMax] = useState(700);
  /** When on, auto meal plan ranks filtered candidates by overlap with pantry ingredients. */
  const [prioritizePantryItems, setPrioritizePantryItems] = useState(false);

  //filter state
  const { appliedFilters, openFilterModal } = useMealPlanFilter();

  // target servings per day (by recipe id)
  const [count, setCount] = useState<Record<string, number>>({});
  /** Ingredient batch multiplier (× base recipe); min 1. */
  const [batchCount, setBatchCount] = useState<Record<string, number>>({});

  const { pendingSelectedRecipe, setPendingSelectedRecipe } = useMealPlanSelection();
  const { refetch: refetchMealPlans, createMealPlan, updateMealPlan } = useMealPlans();
  const { isOnline } = useNetwork();

  // Load existing plan only when `mealPlanId` changes
  useEffect(() => {
    if (!mealPlanIdParam) return undefined;

    let cancelled = false;
    const run = async () => {
      setLoadingPlan(true);
      try {
        const idToken = await AsyncStorage.getItem("idToken");
        if (!idToken) {
          Alert.alert("Not signed in", "Sign in to edit meal plans.");
          return;
        }
        const res = await fetch(
          `${SERVER_URL}/api/meal-plans/${encodeURIComponent(mealPlanIdParam)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const cachedList = await readCache<
            {
              id: string;
              breakfast?: string | null;
              lunch?: string | null;
              dinner?: string | null;
              start_date?: string | null;
              end_date?: string | null;
            }[]
          >(CACHE_KEYS.MEAL_PLANS);
          const plan = cachedList?.find((p) => String(p.id) === String(mealPlanIdParam));
          if (!plan) {
            throw new Error(typeof data?.error === "string" ? data.error : "Failed to load meal plan");
          }
          const start = plan.start_date ? new Date(plan.start_date) : new Date();
          if (!cancelled) {
            setStartDate(start);
          }
          const bEntries = mealSlotEntriesFromPlanField(plan.breakfast);
          const lEntries = mealSlotEntriesFromPlanField(plan.lunch);
          const dEntries = mealSlotEntriesFromPlanField(plan.dinner);
          const allIds = Array.from(new Set([...bEntries, ...lEntries, ...dEntries].map((e) => e.id)));
          const byId: Record<string, Recipe> = {};
          await hydrateRecipesFromDetailCache(allIds, byId);
          if (!cancelled) {
            setCount(countRecordFromSlots(bEntries, lEntries, dEntries));
            setBatchCount(batchRecordFromSlots(bEntries, lEntries, dEntries));
            setBreakfastRecipe(
              bEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)),
            );
            setLunchRecipe(lEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
            setDinnerRecipe(dEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
          }
          return;
        }
        const plan = data?.mealPlan;
        if (!plan || cancelled) return;

        const start = plan.start_date ? new Date(plan.start_date) : new Date();
        if (!cancelled) {
          setStartDate(start);
        }

        const bEntries = mealSlotEntriesFromPlanField(plan.breakfast);
        const lEntries = mealSlotEntriesFromPlanField(plan.lunch);
        const dEntries = mealSlotEntriesFromPlanField(plan.dinner);
        const allIds = Array.from(new Set([...bEntries, ...lEntries, ...dEntries].map((e) => e.id)));

        const fetchOne = async (recipeId: string) => {
          const isPersonal = !/^\d+$/.test(recipeId);
          const url = isPersonal
            ? `${SERVER_URL}/api/recipes/${encodeURIComponent(recipeId)}`
            : `${SERVER_URL}/api/external-recipes/${encodeURIComponent(recipeId)}/details`;
          const r = await fetch(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          const json = await r.json().catch(() => ({}));
          if (!r.ok) return null;
          return normalizeRecipeFromApi(json, recipeId);
        };

        const entries = await Promise.all(allIds.map(async (rid) => [rid, await fetchOne(rid)] as const));
        if (cancelled) return;
        const byId: Record<string, Recipe> = {};
        for (const [rid, rec] of entries) {
          if (rec) byId[rid] = rec;
        }
        await hydrateRecipesFromDetailCache(allIds, byId);

        if (!cancelled) {
          setCount(countRecordFromSlots(bEntries, lEntries, dEntries));
          setBatchCount(batchRecordFromSlots(bEntries, lEntries, dEntries));
          setBreakfastRecipe(
            bEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)),
          );
          setLunchRecipe(lEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
          setDinnerRecipe(dEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
        }
      } catch (e) {
        if (!cancelled && mealPlanIdParam) {
          const cachedList = await readCache<
            {
              id: string;
              breakfast?: string | null;
              lunch?: string | null;
              dinner?: string | null;
              start_date?: string | null;
              end_date?: string | null;
            }[]
          >(CACHE_KEYS.MEAL_PLANS);
          const plan = cachedList?.find((p) => String(p.id) === String(mealPlanIdParam));
          if (plan) {
            const start = plan.start_date ? new Date(plan.start_date) : new Date();
            setStartDate(start);
            const bEntries = mealSlotEntriesFromPlanField(plan.breakfast);
            const lEntries = mealSlotEntriesFromPlanField(plan.lunch);
            const dEntries = mealSlotEntriesFromPlanField(plan.dinner);
            const allIds = Array.from(new Set([...bEntries, ...lEntries, ...dEntries].map((e) => e.id)));
            const byId: Record<string, Recipe> = {};
            await hydrateRecipesFromDetailCache(allIds, byId);
            setCount(countRecordFromSlots(bEntries, lEntries, dEntries));
            setBatchCount(batchRecordFromSlots(bEntries, lEntries, dEntries));
            setBreakfastRecipe(
              bEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)),
            );
            setLunchRecipe(lEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
            setDinnerRecipe(dEntries.map((e) => mergeRecipeWithSlotEntry(byId[e.id] ?? { id: e.id }, e)));
          } else if (!cancelled) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to load meal plan.");
          }
        } else if (!cancelled) {
          Alert.alert("Error", e instanceof Error ? e.message : "Failed to load meal plan.");
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mealPlanIdParam]);

  // Preset start date for "new plan" only — end date is derived from recipes.
  useEffect(() => {
    if (mealPlanIdParam) return;
    if (!dateParam) return;
    const d = dateOnlyToLocalDate(dateParam);
    if (d) {
      setStartDate(d);
    }
  }, [mealPlanIdParam, dateParam]);

  // End date follows the longest estimated stretch across all meals (inclusive of start).
  useEffect(() => {
    if (loadingPlan) return;
    const maxDays = maxEstimatedPlanDaysFromSlots(
      breakfastRecipe,
      lunchRecipe,
      dinnerRecipe,
      count,
      batchCount,
    );
    const nextEnd = endDateFromStartAndMaxDays(start_date, maxDays);
    setEndDate((prev) =>
      prev.getFullYear() === nextEnd.getFullYear() &&
        prev.getMonth() === nextEnd.getMonth() &&
        prev.getDate() === nextEnd.getDate()
        ? prev
        : nextEnd,
    );
  }, [loadingPlan, start_date, breakfastRecipe, lunchRecipe, dinnerRecipe, count, batchCount]);

  const incrementBatch = (id: string) => {
    setBatchCount((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 1) + 1,
    }));
  };
  const decrementBatch = (id: string) => {
    setBatchCount((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] ?? 1) - 1),
    }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        Alert.alert("Not signed in", "Sign in to save meal plans.");
        return;
      }
      const toSlotEntry = (r: Recipe): MealPlanSlotEntry => ({
        id: r.id,
        baseServings: getRecipeBaseServings(r),
        targetServings: count[r.id] || 1,
        batchMultiplier: batchCount[r.id] || 1,
        title: r.title,
      });
      const body = {
        breakfast: breakfastRecipe.map(toSlotEntry),
        lunch: lunchRecipe.map(toSlotEntry),
        dinner: dinnerRecipe.map(toSlotEntry),
        start_date: start_date.toISOString(),
        end_date: end_date.toISOString(),
      };
      if (mealPlanIdParam) {
        await updateMealPlan(mealPlanIdParam, body);
      } else {
        await createMealPlan(body);
      }
      Alert.alert(
        "Saved",
        mealPlanIdParam ? "Your meal plan has been updated." : "Your meal plan has been saved.",
      );
      await refetchMealPlans();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save meal plan.");
    } finally {
      setSaving(false);
    }
  }, [
    start_date,
    end_date,
    breakfastRecipe,
    lunchRecipe,
    dinnerRecipe,
    count,
    batchCount,
    mealPlanIdParam,
    refetchMealPlans,
    createMealPlan,
    updateMealPlan,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (pendingSelectedRecipe && pendingMealSlot) {
        const r = pendingSelectedRecipe;
        const seedDays = Math.max(1, getRecipeBaseServings(r));
        if (pendingMealSlot === "Breakfast") {
          setBreakfastRecipe((prev) => [...prev, r]);
        } else if (pendingMealSlot === "Lunch") {
          setLunchRecipe((prev) => [...prev, r]);
        } else if (pendingMealSlot === "Dinner") {
          setDinnerRecipe((prev) => [...prev, r]);
        }
        setCount((c) => {
          const existing = c[r.id];
          if (typeof existing === "number" && existing > 0) return c;
          return { ...c, [r.id]: seedDays };
        });
        setBatchCount((b) => ({ ...b, [r.id]: b[r.id] != null && b[r.id]! >= 1 ? b[r.id]! : 1 }));
        setPendingSelectedRecipe(null);
        setPendingMealSlot(null);
      }
    }, [pendingSelectedRecipe, pendingMealSlot, setPendingSelectedRecipe]),
  );

  const openAddRecipeModal = (slot: MealSlot) => {
    setPendingMealSlot(slot);
    setVisible(true);
  };

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);

    if (!selectedDate) return;
    if (activeField === "start") {
      setStartDate(selectedDate);
    }
  };

  const handleDelete = (recipeId: string, meal: MealSlot) => {
    setCount((prev) => {
      const next = { ...prev };
      delete next[recipeId];
      return next;
    });
    setBatchCount((prev) => {
      const next = { ...prev };
      delete next[recipeId];
      return next;
    });
    if (meal === "Breakfast") {
      setBreakfastRecipe((prev) => prev.filter((recipe) => recipe.id !== recipeId));
    } else if (meal === "Lunch") {
      setLunchRecipe((prev) => prev.filter((recipe) => recipe.id !== recipeId));
    } else if (meal === "Dinner") {
      setDinnerRecipe((prev) => prev.filter((recipe) => recipe.id !== recipeId));
    }
  };

  const handleAutoMealPlan = useCallback(async () => {
    setAutoGenerating(true);
    try {
      const userCookwareList = appliedFilters.useMyCookwareOnly
        ? Array.from(await loadUserCookware())
        : [];
      const params = new URLSearchParams({
        calorieMin: String(Math.min(calorieMin, calorieMax)),
        calorieMax: String(Math.max(calorieMin, calorieMax)),
        targetDays: "30",
        maxRecipesPerMeal: "4",
        budgetMin: String(appliedFilters.budgetMin),
        budgetMax: String(appliedFilters.budgetMax),
        allergies: appliedFilters.allergies.join(","),
        foodTypes: appliedFilters.foodTypes.join(","),
        cookware: appliedFilters.cookware.join(","),
        useMyCookwareOnly: String(appliedFilters.useMyCookwareOnly),
      });
      if (appliedFilters.useMyCookwareOnly && userCookwareList.length > 0) {
        params.set("userCookware", userCookwareList.join(","));
      }

      if (prioritizePantryItems) {
        params.set("prioritizePantry", "true");
        let pantryNames: string[] = [];
        const idToken = await AsyncStorage.getItem("idToken");
        if (idToken) {
          try {
            const pantryRes = await fetch(`${SERVER_URL}/api/pantry`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
              },
            });
            const pantryData = await pantryRes.json().catch(() => ({}));
            if (pantryRes.ok && Array.isArray(pantryData.items)) {
              pantryNames = pantryData.items
                .map((it: { name?: string }) => String(it?.name ?? "").trim())
                .filter(Boolean);
            }
          } catch {
            // fall through to cache
          }
        }
        if (pantryNames.length === 0) {
          const cached = await readCache<{ name: string }[]>(CACHE_KEYS.PANTRY);
          if (cached?.length) {
            pantryNames = cached.map((it) => String(it?.name ?? "").trim()).filter(Boolean);
          }
        }
        for (const name of pantryNames) {
          params.append("pantry", name);
        }
      }

      const res = await fetch(
        `${SERVER_URL}/api/external-recipes/auto-meal-plan?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to auto generate meal plan");
      }

      const meals = data?.meals ?? {};
      const toRecipe = (r: any): Recipe & { __autoTargetServings?: number; __autoBatchMultiplier?: number } => ({
        id: String(r?.id ?? ""),
        title: r?.title ?? undefined,
        calories: typeof r?.calories === "number" ? r.calories : undefined,
        rating: typeof r?.rating === "number" ? r.rating : undefined,
        image: r?.image ?? undefined,
        servings: coercePositiveServings(r?.servings),
        __autoTargetServings:
          typeof r?.autoTargetServings === "number" && r.autoTargetServings > 0
            ? Math.floor(r.autoTargetServings)
            : undefined,
        __autoBatchMultiplier:
          typeof r?.autoBatchMultiplier === "number" && r.autoBatchMultiplier > 0
            ? Math.floor(r.autoBatchMultiplier)
            : undefined,
      });

      const allRecipes = (arr: unknown) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter((r: any) => r?.id != null).map((r: any) => toRecipe(r));
      };

      let breakfastList = allRecipes(meals.breakfast);
      let lunchList = allRecipes(meals.lunch);
      let dinnerList = allRecipes(meals.dinner);

      // Auto meal-plan search payload used to omit `servings`; fill from details when missing (cache / old server).
      const idToken = await AsyncStorage.getItem("idToken");
      const needServingsIds = [
        ...new Set(
          [...breakfastList, ...lunchList, ...dinnerList]
            .filter((r) => !coercePositiveServings(r.servings))
            .map((r) => r.id),
        ),
      ];
      const servingsById: Record<string, number> = {};
      if (idToken && needServingsIds.length > 0) {
        await Promise.all(
          needServingsIds.map(async (rid) => {
            try {
              const hres = await fetch(
                `${SERVER_URL}/api/external-recipes/${encodeURIComponent(rid)}/details?includeNutrition=false`,
                { headers: { Authorization: `Bearer ${idToken}` } },
              );
              const j = await hres.json().catch(() => ({}));
              const sv = coercePositiveServings(j?.recipe?.servings);
              if (sv) servingsById[rid] = sv;
            } catch {
              /* non-fatal */
            }
          }),
        );
      }
      const mergeServings = (list: Recipe[]) =>
        list.map((item) => {
          const s = coercePositiveServings(item.servings) ?? servingsById[item.id];
          return s != null ? { ...item, servings: s } : item;
        });
      breakfastList = mergeServings(breakfastList);
      lunchList = mergeServings(lunchList);
      dinnerList = mergeServings(dinnerList);

      setBreakfastRecipe(breakfastList);
      setLunchRecipe(lunchList);
      setDinnerRecipe(dinnerList);

      // Auto picks never went through the recipe picker, so `count` / `batchCount` were empty — end
      // date + habitDays use `targetServings` per recipe; seed from each recipe's serving size.
      const picked = [...breakfastList, ...lunchList, ...dinnerList];
      setCount(() => {
        const next: Record<string, number> = {};
        for (const r of picked) {
          const suggested = (r as { __autoTargetServings?: number }).__autoTargetServings;
          next[r.id] =
            typeof suggested === "number" && suggested > 0
              ? Math.floor(suggested)
              : Math.max(1, getRecipeBaseServings(r));
        }
        return next;
      });
      setBatchCount(() => {
        const next: Record<string, number> = {};
        for (const r of picked) {
          const suggested = (r as { __autoBatchMultiplier?: number }).__autoBatchMultiplier;
          next[r.id] =
            typeof suggested === "number" && suggested > 0 ? Math.floor(suggested) : 1;
        }
        return next;
      });
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to auto generate meal plan.",
      );
    } finally {
      setAutoGenerating(false);
    }
  }, [calorieMin, calorieMax, appliedFilters, prioritizePantryItems]);

  const renderRecipeCard = (recipe: any, mealslot: MealSlot) => {
    if (!recipe) return null;
    return (
      <View className="mb-3 gap-2">
        <SwipeableRecipeCardRemovable
          id={recipe.id}
          title={recipe.title}
          calories={recipe.calories}
          rating={recipe.rating}
          reviewsLength={recipe.reviews?.length || 0}
          image={recipe.image ?? undefined}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
          onActionPress={() => {
            handleDelete(recipe.id, mealslot);
          }}
        />
      </View>
    );
  };

  const renderMealContainer = (meal: MealSlot, color: string, recipeData: Recipe[]) => {
    return (
      <View className="gap-2 py-4">
        {/*header*/}
        <View className="flex-row items-center">
          <View
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <Text className="font-bold text-xl"> {meal} </Text>
        </View>

        {recipeData.map((recipe: Recipe) => {
          const base = getRecipeBaseServings(recipe);
          const target = count[recipe.id] || 1;
          const batch = batchCount[recipe.id] || 1;
          return (
          <View key={recipe.id} className="w-full">
            {renderRecipeCard(recipe, meal)}
            <Text className="text-sm text-muted-foreground px-4">
              This recipe runs {target} day{target === 1 ? "" : "s"} in this meal (recipe serves{" "}
              {base}
              {batch > 1 ? ` · ${batch}× batch for shopping` : ""}). Plan length uses the longest
              meal slot.
            </Text>
            <View className="flex-row items-start justify-between w-full px-4 gap-3">
              <View className="mt-1 items-start min-w-[84px]">
                <Text className="text-xs text-muted-foreground mt-2">Recipe serves</Text>
                <Text className="text-lg font-semibold">{base}</Text>
              </View>
              <View className="mt-1 items-center flex-1">
                <Text className="text-base mt-2">Batches (×)</Text>
                <View className="flex-row items-center bg-gray-100 rounded-full shadow px-2 py-1 gap-4 mt-2">
                  <Pressable
                    onPress={() => decrementBatch(recipe.id)}
                    className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                  >
                    <Text className="text-lg">&lt;</Text>
                  </Pressable>
                  <Text className="min-w-[24px] text-center font-medium text-gray-800">
                    {batchCount[recipe.id] || 1}
                  </Text>
                  <Pressable
                    onPress={() => incrementBatch(recipe.id)}
                    className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                  >
                    <Text className="text-lg">&gt;</Text>
                  </Pressable>
                </View>
              </View>
              <View className="mt-1 items-end min-w-[84px]">
                <Text className="text-xs text-muted-foreground mt-2">Runs for</Text>
                <Text className="text-lg font-semibold">
                  {target} day{target === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </View>
          );
        })}
        <View className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: color }}>
          <Button
            variant="outline"
            icon={{
              name: "plus",
              position: "left",
              size: 16,
              color: color,
            }}
            className="h-14 w-full rounded-2xl border-0 px-4 shadow-sm"
            onPress={() => openAddRecipeModal(meal)}
          >
            <Text className="text-xl font-bold" style={{ color: color }}>
              Add {meal}
            </Text>
          </Button>
        </View>

      </View>
    );
  };

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] px-4 pt-safe-or-20">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <AccountWebColumn>
        {loadingPlan ? (
          <View className="py-16 items-center justify-center min-h-[200px]">
            <ActivityIndicator size="large" color="#bd9b64" />
            <Text className="text-muted-foreground mt-3">Loading meal plan…</Text>
          </View>
        ) : null}

        {!loadingPlan ? (
          <>
            <View className="flex-row gap-2">
              {/* Auto Meal Plan is disabled when offline because it requires an external API */}
              <Pressable
                className={`flex-1 h-12 rounded-lg shadow-sm items-center justify-center ${isOnline ? "bg-white" : "bg-gray-200 opacity-50"
                  }`}
                onPress={isOnline ? handleAutoMealPlan : undefined}
                disabled={autoGenerating || !isOnline}
              >
                <Text className={isOnline ? "" : "text-gray-400"}>
                  {autoGenerating ? "Generating..." : "Auto Meal Plan"}
                </Text>
              </Pressable>

              {/* auto meal plan filters -- opens meal filters*/}
              <Pressable
                className="h-12 w-12 bg-white rounded-lg shadow-sm items-center justify-center"
                onPress={openFilterModal}
                accessibilityRole="button"
                accessibilityLabel="Meal plan filters"
              >
                <IconSymbol name="filter-outline" size={22} color="--color-foreground" />
              </Pressable>

              {/* auto meal plan settings -- opens calorie range modal */}
              <Pressable
                className="h-12 w-12 bg-white rounded-lg shadow-sm items-center justify-center"
                onPress={() => setSettingsModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Meal plan settings"
              >
                <IconSymbol name="cog-outline" size={22} color="--color-foreground" />
              </Pressable>
            </View>

            <Text className="py-4"> Plan duration </Text>
            <View className="flex-row gap-4 w-full">
              <Pressable
                className="flex-1 bg-white p-4 rounded-lg shadow-sm"
                onPress={() => {
                  setActiveField("start");
                  setShowPicker(true);
                }}
              >
                <Text> Start date </Text>
                <Text>{start_date.toDateString()}</Text>
              </Pressable>

              <View className="flex-1 bg-white p-4 rounded-lg shadow-sm opacity-95">
                <Text> End date </Text>
                <Text>{end_date.toDateString()}</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Set by longest recipe stretch (all meals).
                </Text>
              </View>

              {showPicker && activeField === "start" && NativeDateTimePicker ? (
                <NativeDateTimePicker
                  value={start_date}
                  mode="date"
                  display="calendar"
                  onChange={onChange}
                />
              ) : null}
            </View>

            {Platform.OS === "web" && showPicker && activeField === "start" ? (
              <Modal
                transparent
                animationType="fade"
                visible
                onRequestClose={() => setShowPicker(false)}
              >
                <Pressable
                  className="flex-1 justify-center px-6"
                  style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                  onPress={() => setShowPicker(false)}
                >
                  <Pressable
                    className="rounded-xl bg-background p-4 self-center w-full max-w-sm"
                    onPress={() => {}}
                  >
                    <Text className="text-foreground font-semibold text-base mb-2">Start date</Text>
                    {createElement("input", {
                      type: "date",
                      value: formatLocalYMD(start_date),
                      onInput: (e: Event) => {
                        const v = (e.target as HTMLInputElement)?.value;
                        const parsed = v ? dateOnlyToLocalDate(v) : null;
                        if (parsed) setStartDate(parsed);
                      },
                      onChange: (e: Event) => {
                        const v = (e.target as HTMLInputElement)?.value;
                        const parsed = v ? dateOnlyToLocalDate(v) : null;
                        if (parsed) setStartDate(parsed);
                      },
                      style: {
                        width: "100%",
                        fontSize: 16,
                        padding: 10,
                        marginVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#ccc",
                        boxSizing: "border-box",
                      },
                    } as Record<string, unknown>)}
                    <Pressable
                      className="mt-3 rounded-lg bg-red-primary py-3 items-center"
                      onPress={() => setShowPicker(false)}
                    >
                      <Text className="text-white font-semibold">Done</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </Modal>
            ) : null}

            <View className="py-3">
              {/* Nutrient preview requires live API calls; it is hidden when offline */}
              <Button
                variant="outline"
                icon={{ name: "invoice-list-outline", position: "left", size: 18 }}
                className={`rounded-xl border-2 border-[#666] ${!isOnline ? "opacity-40" : ""}`}
                textClassName="font-semibold text-foreground"
                disabled={!isOnline}
                onPress={() => {
                  router.push({
                    pathname: "/calendar/meal-plan-nutrient-preview",
                    params: {
                      breakfastIds: JSON.stringify(breakfastRecipe.map(r => r.id)),
                      lunchIds: JSON.stringify(lunchRecipe.map(r => r.id)),
                      dinnerIds: JSON.stringify(dinnerRecipe.map(r => r.id)),
                    },
                  });
                }}
              >
                Preview nutrient
              </Button>
            </View>

            {/*Breakfast container*/}
            <View>{renderMealContainer("Breakfast", "#fcba03", breakfastRecipe)}</View>

            {/*Lunch container*/}
            <View>{renderMealContainer("Lunch", "#14cc0a", lunchRecipe)}</View>

            {/*dinner container*/}
            <View>{renderMealContainer("Dinner", "#bd9b64", dinnerRecipe)}</View>

            {/*Save button*/}
            <View className="w-full max-w-md self-center items-stretch">
              <Button
                variant="default"
                className="h-16 w-full rounded-2xl bg-red-primary shadow-sm"
                textClassName="text-xl font-bold text-white"
                onPress={() => {
                  handleSave();
                }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </View>

            {/* Recipe select modal: when offline, shows cached personal + favorited recipes only */}
            <Modal
              transparent
              visible={visible}
              animationType="fade"
              statusBarTranslucent={true}
            >
              {/* Backdrop */}
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => setVisible(false)}
              >
                {/* Stop press propagation */}
                <Pressable
                  onPress={() => {}}
                  style={{
                    width: 320,
                    maxWidth: "90%",
                    backgroundColor: theme["--color-background"],
                    borderRadius: 16,
                    padding: 24,
                    gap: 16,
                  }}
                >
                  <Text className="text-lg font-bold text-center text-foreground">Choose Recipe</Text>

                  {/* From Favorites is available both online and offline (favorites page
                  handles offline reading via its own cache). */}
                  <Button
                    variant="outline"
                    portalSafe
                    onPress={() => {
                      setVisible(false);
                      router.push({
                        pathname: "/account/favorites",
                        params: {
                          mode: "select",
                          ...(mealPlanIdParam ? { mealPlanId: mealPlanIdParam } : {}),
                          ...(dateParam ? { mealPlanDate: dateParam } : {}),
                        },
                      });
                    }}
                    icon={{ name: "heart-outline", position: "left" }}
                  >
                    From Favorites
                  </Button>

                  {/* Search requires a live network call; hide it when offline. */}
                  {isOnline && (
                    <Button
                      variant="outline"
                      portalSafe
                      onPress={() => {
                        setVisible(false);
                        router.push({
                          pathname: "/home/search",
                          params: {
                            mode: "select",
                            ...(mealPlanIdParam ? { mealPlanId: mealPlanIdParam } : {}),
                            ...(dateParam ? { mealPlanDate: dateParam } : {}),
                          },
                        });
                      }}
                      icon={{ name: "magnify", position: "left" }}
                    >
                      Search Recipes
                    </Button>
                  )}
                </Pressable>
              </Pressable>
            </Modal>

            {/* meal plan settings -- target calories per meal for auto generator */}
            <Modal
              transparent
              visible={settingsModalVisible}
              animationType="fade"
              statusBarTranslucent
            >
              <View className="flex-1 justify-center items-center">
                <Pressable
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                  }}
                  onPress={() => setSettingsModalVisible(false)}
                />
                <View
                  className="mx-4 w-[90%] max-w-sm rounded-2xl p-6 gap-5 shadow-lg"
                  style={{ backgroundColor: theme["--color-background"] }}
                >
                  <Text className="text-lg font-bold text-center text-foreground">
                    Meal plan settings
                  </Text>
                  <Text className="text-center text-sm text-muted-foreground">
                    Auto meal plan will prefer recipes between these calories (per meal)
                  </Text>

                  <View className="gap-2">
                    <Text className="font-semibold text-foreground">
                      Minimum: {Math.min(calorieMin, calorieMax)} cal
                    </Text>
                    <Slider
                      minimumValue={CAL_SLIDER_MIN}
                      maximumValue={CAL_SLIDER_MAX}
                      step={CAL_SLIDER_STEP}
                      value={calorieMin}
                      onValueChange={(v) => {
                        const next = Math.round(v / CAL_SLIDER_STEP) * CAL_SLIDER_STEP;
                        setCalorieMin(next);
                        if (next > calorieMax) setCalorieMax(next);
                      }}
                      minimumTrackTintColor="#bd9b64"
                      maximumTrackTintColor="#e5e5e5"
                      thumbTintColor="#bd9b64"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-foreground">
                      Maximum: {Math.max(calorieMin, calorieMax)} cal
                    </Text>
                    <Slider
                      minimumValue={CAL_SLIDER_MIN}
                      maximumValue={CAL_SLIDER_MAX}
                      step={CAL_SLIDER_STEP}
                      value={calorieMax}
                      onValueChange={(v) => {
                        const next = Math.round(v / CAL_SLIDER_STEP) * CAL_SLIDER_STEP;
                        setCalorieMax(next);
                        if (next < calorieMin) setCalorieMin(next);
                      }}
                      minimumTrackTintColor="#bd9b64"
                      maximumTrackTintColor="#e5e5e5"
                      thumbTintColor="#bd9b64"
                    />
                  </View>

                  <View className="flex-row items-center justify-between gap-3 py-1">
                    <View className="flex-1 pr-2">
                      <Text className="font-semibold text-foreground">Prioritize pantry items</Text>
                      <Text className="text-xs text-muted-foreground mt-1">
                        Auto meal plan will prefer recipes that use more ingredients you already have in
                        your pantry (after your filters still apply).
                      </Text>
                    </View>
                    <Switch
                      style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
                      trackColor={{ false: "#9c989e", true: "#bd9b64" }}
                      thumbColor="#ffffff"
                      value={prioritizePantryItems}
                      onValueChange={setPrioritizePantryItems}
                    />
                  </View>

                  <Button
                    variant="default"
                    portalSafe
                    className="rounded-xl"
                    onPress={() => setSettingsModalVisible(false)}
                  >
                    Done
                  </Button>
                </View>
              </View>
            </Modal>
          </>
        ) : null}
        </AccountWebColumn>
      </ScrollView>
    </ThemedSafeView>
  );
}
