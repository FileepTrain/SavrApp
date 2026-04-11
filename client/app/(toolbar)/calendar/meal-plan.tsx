// app/(toolbar)/calendar/meal-plan.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import type { Recipe } from "@/contexts/meal-plan-selection-context";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useMealPlans } from "@/contexts/meal-plans-context";
import { useNetwork } from "@/contexts/network-context";
import { CACHE_KEYS, type CachedRecipeEntry, readCache, recipeDetailKey } from "@/utils/offline-cache";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View, Modal, ScrollView } from "react-native";
import Button from "@/components/ui/button";
import { SwipeableRecipeCardRemovable } from "@/components/swipeable-recipe-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

function parseRecipeIds(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function dateOnlyToLocalDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (y == null || m == null || d == null) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normalizeRecipeFromApi(json: unknown, fallbackId: string): Recipe {
  const body = json as { recipe?: Recipe } | Recipe | null;
  const r = body && typeof body === "object" && "recipe" in body ? (body as { recipe?: Recipe }).recipe : (body as Recipe | null);
  if (!r || typeof r !== "object") return { id: fallbackId };
  return {
    id: String((r as Recipe).id ?? fallbackId),
    title: (r as Recipe).title,
    calories: typeof (r as Recipe).calories === "number" ? (r as Recipe).calories : undefined,
    rating: typeof (r as Recipe).rating === "number" ? (r as Recipe).rating : undefined,
    reviews: Array.isArray((r as Recipe).reviews) ? (r as Recipe).reviews : undefined,
    image: (r as Recipe).image ?? ((r as Recipe).imageUrl as string | undefined),
  };
}

/** Fills title/image/etc. from the offline recipe detail cache when the API did not return a row. */
async function recipeFromDetailCache(rid: string): Promise<Recipe | null> {
  const cached = await readCache<CachedRecipeEntry>(recipeDetailKey(rid));
  if (!cached?.recipe?.title) return null;
  const r = cached.recipe;
  const revLen = typeof r.reviewsLength === "number" ? r.reviewsLength : 0;
  return {
    id: rid,
    title: r.title,
    calories: typeof r.calories === "number" ? r.calories : undefined,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    reviews: revLen > 0 ? Array.from({ length: revLen }, () => ({})) : undefined,
    image: r.image ?? undefined,
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
  const [activeField, setActiveField] = useState<"start" | "end" | null>(null);

  const [visible, setVisible] = useState(false);
  const [pendingMealSlot, setPendingMealSlot] = useState<MealSlot | null>(null);
  //Meal state arrays
  const [breakfastRecipe, setBreakfastRecipe] = useState<Recipe[]>([]);
  const [lunchRecipe, setLunchRecipe] = useState<Recipe[]>([]);
  const [dinnerRecipe, setDinnerRecipe] = useState<Recipe[]>([]);

  //button states
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [calorieMin, setCalorieMin] = useState(400);
  const [calorieMax, setCalorieMax] = useState(700);

  const [count, setCount] = useState<Record<string, number>>({});

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
          const cachedList = await readCache<Array<{ id: string; breakfast?: string | null; lunch?: string | null; dinner?: string | null; start_date?: string | null; end_date?: string | null }>>(CACHE_KEYS.MEAL_PLANS);
          const plan = cachedList?.find((p) => String(p.id) === String(mealPlanIdParam));
          if (!plan) {
            throw new Error(typeof data?.error === "string" ? data.error : "Failed to load meal plan");
          }
          const start = plan.start_date ? new Date(plan.start_date) : new Date();
          const end = plan.end_date ? new Date(plan.end_date) : new Date();
          if (!cancelled) {
            setStartDate(start);
            setEndDate(end);
          }
          const bIds = parseRecipeIds(plan.breakfast ?? null);
          const lIds = parseRecipeIds(plan.lunch ?? null);
          const dIds = parseRecipeIds(plan.dinner ?? null);
          const allIds = Array.from(new Set([...bIds, ...lIds, ...dIds]));
          const byId: Record<string, Recipe> = {};
          await hydrateRecipesFromDetailCache(allIds, byId);
          if (!cancelled) {
            setBreakfastRecipe(bIds.map((rid) => byId[rid] ?? { id: rid }));
            setLunchRecipe(lIds.map((rid) => byId[rid] ?? { id: rid }));
            setDinnerRecipe(dIds.map((rid) => byId[rid] ?? { id: rid }));
          }
          return;
        }
        const plan = data?.mealPlan;
        if (!plan || cancelled) return;

        const start = plan.start_date ? new Date(plan.start_date) : new Date();
        const end = plan.end_date ? new Date(plan.end_date) : new Date();
        if (!cancelled) {
          setStartDate(start);
          setEndDate(end);
        }

        const bIds = parseRecipeIds(plan.breakfast);
        const lIds = parseRecipeIds(plan.lunch);
        const dIds = parseRecipeIds(plan.dinner);
        const allIds = Array.from(new Set([...bIds, ...lIds, ...dIds]));

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

        setBreakfastRecipe(bIds.map((rid) => byId[rid] ?? { id: rid }));
        setLunchRecipe(lIds.map((rid) => byId[rid] ?? { id: rid }));
        setDinnerRecipe(dIds.map((rid) => byId[rid] ?? { id: rid }));
      } catch (e) {
        if (!cancelled && mealPlanIdParam) {
          const cachedList = await readCache<
            Array<{
              id: string;
              breakfast?: string | null;
              lunch?: string | null;
              dinner?: string | null;
              start_date?: string | null;
              end_date?: string | null;
            }>
          >(CACHE_KEYS.MEAL_PLANS);
          const plan = cachedList?.find((p) => String(p.id) === String(mealPlanIdParam));
          if (plan) {
            const start = plan.start_date ? new Date(plan.start_date) : new Date();
            const end = plan.end_date ? new Date(plan.end_date) : new Date();
            setStartDate(start);
            setEndDate(end);
            const bIds = parseRecipeIds(plan.breakfast ?? null);
            const lIds = parseRecipeIds(plan.lunch ?? null);
            const dIds = parseRecipeIds(plan.dinner ?? null);
            const allIds = Array.from(new Set([...bIds, ...lIds, ...dIds]));
            const byId: Record<string, Recipe> = {};
            await hydrateRecipesFromDetailCache(allIds, byId);
            setBreakfastRecipe(bIds.map((rid) => byId[rid] ?? { id: rid }));
            setLunchRecipe(lIds.map((rid) => byId[rid] ?? { id: rid }));
            setDinnerRecipe(dIds.map((rid) => byId[rid] ?? { id: rid }));
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

  // Preset dates for "new plan" only — never override dates loaded for an existing plan.
  useEffect(() => {
    if (mealPlanIdParam) return;
    if (!dateParam) return;
    const d = dateOnlyToLocalDate(dateParam);
    if (d) {
      setStartDate(d);
      setEndDate(d);
    }
  }, [mealPlanIdParam, dateParam]);

  const increment = (id: string) => {
    setCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };
  const decrement = (id: string) => {
    setCount((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1),
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
      const body = {
        breakfast: breakfastRecipe.map((r) => r.id),
        lunch: lunchRecipe.map((r) => r.id),
        dinner: dinnerRecipe.map((r) => r.id),
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
    mealPlanIdParam,
    refetchMealPlans,
    createMealPlan,
    updateMealPlan,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (pendingSelectedRecipe && pendingMealSlot) {
        if (pendingMealSlot === "Breakfast") {
          setBreakfastRecipe((prev) => [...prev, pendingSelectedRecipe]);
        } else if (pendingMealSlot === "Lunch") {
          setLunchRecipe((prev) => [...prev, pendingSelectedRecipe]);
        } else if (pendingMealSlot === "Dinner") {
          setDinnerRecipe((prev) => [...prev, pendingSelectedRecipe]);
        }
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
      if (selectedDate > end_date) {
        setEndDate(selectedDate);
      }
      setStartDate(selectedDate);
    } else if (activeField === "end") {
      setEndDate(selectedDate);
    }
  };

  const handleDelete = (recipeId: string, meal: MealSlot) => {
    //delete from meals array
    if (meal === "Breakfast") {
      setBreakfastRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    } else if (meal === "Lunch") {
      setLunchRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    } else if (meal === "Dinner") {
      setDinnerRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    }
  };

  const handleAutoMealPlan = useCallback(async () => {
    setAutoGenerating(true);
    try {
      const params = new URLSearchParams({
        calorieMin: String(Math.min(calorieMin, calorieMax)),
        calorieMax: String(Math.max(calorieMin, calorieMax)),
      });
      const res = await fetch(
        `${SERVER_URL}/api/external-recipes/auto-meal-plan?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to auto generate meal plan");
      }

      const meals = data?.meals ?? {};
      const toRecipe = (r: any): Recipe => ({
        id: String(r?.id ?? ""),
        title: r?.title ?? undefined,
        calories: typeof r?.calories === "number" ? r.calories : undefined,
        rating: typeof r?.rating === "number" ? r.rating : undefined,
        image: r?.image ?? undefined,
      });

      console.log(meals.breakfast, meals.lunch, meals.dinner);

      setBreakfastRecipe(
        Array.isArray(meals.breakfast)
          ? meals.breakfast.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
      setLunchRecipe(
        Array.isArray(meals.lunch)
          ? meals.lunch.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
      setDinnerRecipe(
        Array.isArray(meals.dinner)
          ? meals.dinner.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to auto generate meal plan.",
      );
    } finally {
      setAutoGenerating(false);
    }
  }, [calorieMin, calorieMax]);

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

        {recipeData.map((recipe: Recipe) => (
          <View key={recipe.id}>
            {renderRecipeCard(recipe, meal)}
            <View className="flex-row">
              <Text className="flex-1 text-base">Servings per day:</Text>

              <View className="flex-row items-center bg-gray-100 rounded-full shadow px-2 py-1 gap-2">
                {/*decrease*/}
                <Pressable
                  onPress={() => decrement(recipe.id)}
                  className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                >
                  <Text className="text-lg">&lt;</Text>
                </Pressable>
                <Text className="min-w-[24px] text-center font-medium text-gray-800">
                  {count[recipe.id] || 1}
                </Text>
                {/*increase*/}
                <Pressable
                  onPress={() => increment(recipe.id)}
                  className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                >
                  <Text className="text-lg">&gt;</Text>
                </Pressable>
              </View>

            </View>
          </View>
        ))}
        <View className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: color }}>
          <Button
            variant="outline"
            icon={{
              name: "plus",
              position: "left",
              size: 16,
              color: color,
            }}
            className="h-14 flex px-20 rounded-2xl shadow-sm border-0"
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
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
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

              {/* meal plan settings -- opens calorie range modal */}
              <Pressable
                className="h-12 w-12 bg-white rounded-lg shadow-sm items-center justify-center"
                onPress={() => setSettingsModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Meal plan settings"
              >
                <IconSymbol name="cog" size={22} color="--color-foreground" />
              </Pressable>
            </View>

            <Text className="py-4"> Plan Duration </Text>
            {/* Plan Duration container */}
            <View className="flex-row gap-4 w-full">

              {/* start */}
              <Pressable className="flex-1 bg-white p-4 rounded-lg shadow-sm"
                onPress={() => {
                  setActiveField("start");
                  setShowPicker(true);
                }}
              >
                <Text> Start Date </Text>
                <Text> {start_date.toDateString()} </Text>
              </Pressable>

              {/* End */}
              <Pressable className="flex-1 bg-white p-4 rounded-lg shadow-sm"
                onPress={() => {
                  setActiveField("end");
                  setShowPicker(true);
                }}
              >
                <Text> End Date </Text>
                <Text> {end_date.toDateString()} </Text>
              </Pressable>

              {showPicker && (
                <DateTimePicker
                  value={activeField === "start" ? start_date : end_date}
                  mode="date"
                  display="calendar"
                  onChange={onChange}
                />
              )}
            </View>

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
            <View className="flex items-center">
              <Button
                variant="default"
                className="h-16 flex  px-20 bg-red-primary rounded-2xl shadow-sm"
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
                className="flex-1 bg-black/50 justify-center items-center"
                onPress={() => setVisible(false)}
              >
                {/* Stop press propagation */}
                <Pressable className="w-80 bg-background rounded-2xl p-6 gap-4">
                  <Text className="text-lg font-bold text-center text-foreground">Choose Recipe</Text>

                  {/* From Favorites is available both online and offline (favorites page
                  handles offline reading via its own cache). */}
                  <Button
                    variant="outline"
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
                  className="absolute inset-0 bg-black/50"
                  onPress={() => setSettingsModalVisible(false)}
                />
                <View className="mx-4 w-[90%] max-w-sm rounded-2xl bg-background p-6 gap-5 shadow-lg">
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

                  <Button
                    variant="default"
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
      </ScrollView>
    </ThemedSafeView>
  );
}
