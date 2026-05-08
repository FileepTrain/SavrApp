import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useMealPlans } from "@/contexts/meal-plans-context";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://192.168.1.105:3000";

type MealValue = string | string[] | null | undefined;

type MealPlan = {
  id?: string;
  userID?: string;
  start_date?: string | null;
  end_date?: string | null;
  breakfast?: MealValue;
  lunch?: MealValue;
  dinner?: MealValue;
};

type RecipeDetails = {
  id: number | string;
  title?: string;
  calories?: number | null;
  image?: string | null;
  nutrients?: {
    name: string;
    amount: number;
  }[];
};

// Functions to calculate dates and meal
function toDateSafe(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateRange(start?: string | null, end?: string | null) {
  const s = toDateSafe(start);
  const e = toDateSafe(end);

  if (!s || !e) return "No date range";
  return `${s.toDateString()} - ${e.toDateString()}`;
}

function normalizeMealSlot(value: MealValue): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  return [String(value).trim()].filter((v) => v.length > 0);
}

function getNutrientAmount(
  nutrients: { name: string; amount: number }[] | undefined,
  target: string
) {
  if (!nutrients) return 0;

  const found = nutrients.find(
    (n) => n.name.toLowerCase() === target.toLowerCase()
  );

  return found?.amount ?? 0;
}

// Dashboard Page
export default function DashboardPage() {
  const { mealPlans, loading, error } = useMealPlans() as {
    mealPlans?: MealPlan[];
    loading: boolean;
    error: string | null;
  };

  const [mealDetails, setMealDetails] = useState<{
    breakfast: RecipeDetails | null;
    lunch: RecipeDetails | null;
    dinner: RecipeDetails | null;
  }>({
    breakfast: null,
    lunch: null,
    dinner: null,
  });

  const [loginStreak, setLoginStreak] = useState<number | null>(null);

  useEffect(() => {
    const loadLoginStreak = async () => {
      try {
        const stored = await AsyncStorage.getItem("loginStreak");
        setLoginStreak(stored ? Number(stored) : null);
      } catch (err) {
        console.warn("Failed to load login streak:", err);
      }
    };

    loadLoginStreak();
  }, []);

  const [mealsLoading, setMealsLoading] = useState(false);

  const now = useMemo(() => new Date(), []);

  const selectedPlan = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return null;

    const sorted = [...mealPlans].sort((a, b) => {
      const aStart = toDateSafe(a.start_date)?.getTime() ?? 0;
      const bStart = toDateSafe(b.start_date)?.getTime() ?? 0;
      return aStart - bStart;
    });

    const upcoming =
      sorted.find((plan) => {
        const start = toDateSafe(plan.start_date);
        if (!start) return false;
        return start > now;
      }) ?? null;

    if (upcoming) return upcoming;

    const active =
      sorted.find((plan) => {
        const start = toDateSafe(plan.start_date);
        const end = toDateSafe(plan.end_date);
        if (!start || !end) return false;

        const startDay = startOfDay(start);
        const endDay = endOfDay(end);

        return now >= startDay && now <= endDay;
      }) ?? null;

    return active;
  }, [mealPlans, now]);

  const breakfastIds = useMemo(
    () => normalizeMealSlot(selectedPlan?.breakfast),
    [selectedPlan?.breakfast]
  );
  const lunchIds = useMemo(
    () => normalizeMealSlot(selectedPlan?.lunch),
    [selectedPlan?.lunch]
  );
  const dinnerIds = useMemo(
    () => normalizeMealSlot(selectedPlan?.dinner),
    [selectedPlan?.dinner]
  );

  const breakfastId = breakfastIds[0] ?? null;
  const lunchId = lunchIds[0] ?? null;
  const dinnerId = dinnerIds[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    const fetchMealDetails = async () => {
      if (!selectedPlan) {
        if (!cancelled) {
          setMealDetails({
            breakfast: null,
            lunch: null,
            dinner: null,
          });
        }
        return;
      }

      if (!breakfastId && !lunchId && !dinnerId) {
        if (!cancelled) {
          setMealDetails({
            breakfast: null,
            lunch: null,
            dinner: null,
          });
        }
        return;
      }

      setMealsLoading(true);
      // Fetch recipe details for each meal slot
      try {
        const fetchRecipe = async (id: string | null): Promise<RecipeDetails | null> => {
          if (!id) return null;

          const res = await fetch(
            `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`
          );
          const data = await res.json();

          if (!res.ok) return null;

          const recipe = data?.recipe;
          if (!recipe) return null;

          let calories: number | null = null;

          if (typeof recipe.calories === "number") {
            calories = recipe.calories;
          } else if (Array.isArray(recipe?.nutrition?.nutrients)) {
            const cal = recipe.nutrition.nutrients.find(
              (n: any) => String(n?.name || "").toLowerCase() === "calories"
            );
            if (cal?.amount != null) {
              calories = Math.round(Number(cal.amount));
            }
          }

          return {
            id: recipe.id ?? id,
            title: recipe.title ?? "Untitled Recipe",
            calories,
            image: recipe.image ?? null,
            nutrients: Array.isArray(recipe?.nutrition?.nutrients)
              ? recipe.nutrition.nutrients
              : [],
          };
        };

        const [breakfast, lunch, dinner] = await Promise.all([
          fetchRecipe(breakfastId),
          fetchRecipe(lunchId),
          fetchRecipe(dinnerId),
        ]);

        if (!cancelled) {
          setMealDetails({
            breakfast,
            lunch,
            dinner,
          });
        }
      } catch (err) {
        console.error("Failed to fetch meal details:", err);
        if (!cancelled) {
          setMealDetails({
            breakfast: null,
            lunch: null,
            dinner: null,
          });
        }
      } finally {
        if (!cancelled) {
          setMealsLoading(false);
        }
      }
    };

    fetchMealDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedPlan?.id, breakfastId, lunchId, dinnerId]);

  const totalCalories = useMemo(() => {
    return (
      (mealDetails.breakfast?.calories ?? 0) +
      (mealDetails.lunch?.calories ?? 0) +
      (mealDetails.dinner?.calories ?? 0)
    );
  }, [mealDetails]);

  const totalNutrients = useMemo(() => {
    const meals = [
      mealDetails.breakfast,
      mealDetails.lunch,
      mealDetails.dinner,
    ];

    // Return calculate total nutrients for each meal
    return {
      protein: meals.reduce((sum, m) => sum + getNutrientAmount(m?.nutrients, "Protein"), 0),
      carbs: meals.reduce((sum, m) => sum + getNutrientAmount(m?.nutrients, "Carbohydrates"), 0),
      fat: meals.reduce((sum, m) => sum + getNutrientAmount(m?.nutrients, "Fat"), 0),
      fiber: meals.reduce((sum, m) => sum + getNutrientAmount(m?.nutrients, "Fiber"), 0),
    };
  }, [mealDetails]);

  const planDays = useMemo(() => {
    if (!selectedPlan) return 0;

    const start = toDateSafe(selectedPlan.start_date);
    const end = toDateSafe(selectedPlan.end_date);
    if (!start || !end) return 0;

    const msPerDay = 1000 * 60 * 60 * 24;

    return (
      Math.floor(
        (endOfDay(end).getTime() - startOfDay(start).getTime()) / msPerDay
      ) + 1
    );
  }, [selectedPlan]);

  const summaryDays = useMemo(() => {
    return Math.min(planDays, 7);
  }, [planDays]);

  const weeklyNutrients = useMemo(() => {
    return {
      protein: totalNutrients.protein * summaryDays,
      carbs: totalNutrients.carbs * summaryDays,
      fat: totalNutrients.fat * summaryDays,
      fiber: totalNutrients.fiber * summaryDays,
    };
  }, [totalNutrients, summaryDays]);

  const weeklyCalories = useMemo(() => {
    return totalCalories * summaryDays;
  }, [totalCalories, summaryDays]);

  // Calculate meal plan streak
  const mealPlanStreak = useMemo(() => {
    if (!mealPlans || mealPlans.length === 0) return 0;

    const coveredDays = new Set<string>();

    for (const plan of mealPlans) {
      const start = toDateSafe(plan.start_date);
      const end = toDateSafe(plan.end_date);
      if (!start || !end) continue;

      let cursor = startOfDay(start);
      const last = startOfDay(end);

      while (cursor <= last) {
        coveredDays.add(cursor.toISOString().slice(0, 10));
        const next = new Date(cursor);
        next.setDate(next.getDate() + 1);
        cursor = next;
      }
    }

    let streak = 0;
    let cursor = startOfDay(new Date());

    while (coveredDays.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      cursor = prev;
    }

    return streak;
  }, [mealPlans]);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20 bg-app-background">
      <ScrollView
        className="px-4 h-full"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="gap-4 pb-6">
          <View className="gap-2">
            <Text className="text-base font-medium text-muted-foreground">
              Weekly Summary
            </Text>

            <View className="rounded-xl shadow-sm bg-background p-4">
              <Text className="text-foreground text-lg font-semibold mb-3">
                This Week
              </Text>

              <View className="flex-row justify-between mb-4">
                <View>
                  <Text className="text-muted-foreground text-sm">
                    Total Calories
                  </Text>
                  <Text className="text-foreground text-2xl font-bold">
                    {mealsLoading ? "--" : `${weeklyCalories} kcal`}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="text-muted-foreground text-sm">
                    Avg / Day
                  </Text>
                  <Text className="text-foreground text-xl font-semibold">
                    {mealsLoading ? "--" : `${totalCalories}`}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Protein</Text>
                <Text className="text-muted-foreground">
                  {mealsLoading ? "--" : `${Math.round(weeklyNutrients.protein)} g`}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Carbs</Text>
                <Text className="text-muted-foreground">
                  {mealsLoading ? "--" : `${Math.round(weeklyNutrients.carbs)} g`}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Fat</Text>
                <Text className="text-muted-foreground">
                  {mealsLoading ? "--" : `${Math.round(weeklyNutrients.fat)} g`}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Fiber</Text>
                <Text className="text-muted-foreground">
                  {mealsLoading ? "--" : `${Math.round(weeklyNutrients.fiber)} g`}
                </Text>
              </View>
              </View>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-base font-medium text-muted-foreground">
              Upcoming Meal Plans
            </Text>

            <View className="rounded-xl shadow-sm bg-background overflow-hidden">
              {loading ? (
                <View className="px-4 py-4">
                  <ActivityIndicator size="small" color="red" />
                </View>
              ) : error ? (
                <View className="px-4 py-4">
                  <Text className="text-red-primary font-medium">
                    Failed to load meal plans
                  </Text>
                  <Text className="text-muted-foreground text-sm mt-1">
                    {error}
                  </Text>
                </View>
              ) : selectedPlan ? (
                <>
                  <View className="px-4 py-4 border-b border-muted-background">
                    <Text className="text-foreground text-[16px] font-medium tracking-[0.5px]">
                      Next Meal Plan
                    </Text>

                    <Text className="text-[12px] text-muted-foreground tracking-[0.5px]">
                      {formatDateRange(
                        selectedPlan.start_date,
                        selectedPlan.end_date
                      )}
                    </Text>
                  </View>

                  <View className="px-4 py-4 gap-4">
                    <View className="flex-row justify-between">
                      <Text className="text-foreground font-medium">
                        Breakfast Recipes
                      </Text>
                      <Text className="text-muted-foreground">
                        {breakfastIds.length}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <Text className="text-foreground font-medium">
                        Lunch Recipes
                      </Text>
                      <Text className="text-muted-foreground">
                        {lunchIds.length}
                      </Text>
                    </View>

                    <View className="flex-row justify-between">
                      <Text className="text-foreground font-medium">
                        Dinner Recipes
                      </Text>
                      <Text className="text-muted-foreground">
                        {dinnerIds.length}
                      </Text>
                    </View>

                    <View className="border-t border-muted-background pt-3 gap-4">
                      <Text className="text-foreground font-medium">
                        Planned Meals
                      </Text>

                      {mealsLoading ? (
                        <Text className="text-muted-foreground text-sm">
                          Loading meal details...
                        </Text>
                      ) : (
                        <>
                          {mealDetails.breakfast && (
                            <View>
                              <Text className="text-muted-foreground text-sm">
                                Breakfast
                              </Text>
                              <Text className="text-red-primary font-medium text-[16px]">
                                {mealDetails.breakfast.title}
                              </Text>
                              <Text className="text-muted-foreground text-sm">
                                {mealDetails.breakfast.calories ?? "--"} calories
                              </Text>
                            </View>
                          )}

                          {mealDetails.lunch && (
                            <View>
                              <Text className="text-muted-foreground text-sm">
                                Lunch
                              </Text>
                              <Text className="text-red-primary font-medium text-[16px]">
                                {mealDetails.lunch.title}
                              </Text>
                              <Text className="text-muted-foreground text-sm">
                                {mealDetails.lunch.calories ?? "--"} calories
                              </Text>
                            </View>
                          )}

                          {mealDetails.dinner && (
                            <View>
                              <Text className="text-muted-foreground text-sm">
                                Dinner
                              </Text>
                              <Text className="text-red-primary font-medium text-[16px]">
                                {mealDetails.dinner.title}
                              </Text>
                              <Text className="text-muted-foreground text-sm">
                                {mealDetails.dinner.calories ?? "--"} calories
                              </Text>
                            </View>
                          )}

                          {!mealDetails.breakfast &&
                            !mealDetails.lunch &&
                            !mealDetails.dinner && (
                              <Text className="text-muted-foreground text-sm">
                                No meals added
                              </Text>
                            )}
                        </>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                <View className="px-4 py-4">
                  <Text className="text-foreground font-medium">
                    No meal plans yet
                  </Text>
                  <Text className="text-muted-foreground text-sm mt-1">
                    Create a meal plan to see it here.
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-base font-medium text-muted-foreground">
              Streaks & Habits
            </Text>

            <View className="rounded-xl shadow-sm bg-background overflow-hidden">

              {/* Login Streak */}
              <View className="px-4 py-4 border-b border-muted-background flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-muted-background items-center justify-center">
                    <IconSymbol
                      name="fire"
                      size={20}
                      color="--color-foreground"
                    />
                  </View>

                  <View>
                    <Text className="text-[16px] font-medium text-foreground">
                      Login Streak
                    </Text>
                    <Text className="text-[12px] text-muted-foreground">
                      Consecutive days you opened the app
                    </Text>
                  </View>
                </View>

                <Text className="text-foreground font-semibold">
                  {loginStreak !== null ? `${loginStreak} days` : "--"}
                </Text>
              </View>

              {/* Meal Plan Streak */}
              <View className="px-4 py-4 border-b border-muted-background flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-muted-background items-center justify-center">
                    <IconSymbol
                      name="calendar-check"
                      size={20}
                      color="--color-foreground"
                    />
                  </View>

                  <View>
                    <Text className="text-[16px] font-medium text-foreground">
                      Meal Plan Streak
                    </Text>
                    <Text className="text-[12px] text-muted-foreground">
                      Consecutive days with planned meals
                    </Text>
                  </View>
                </View>

                <Text className="text-foreground font-semibold">
                  {loading ? "--" : `${mealPlanStreak} days`}
                </Text>
              </View>

              {/* Nutritional Goal */}
              <View className="px-4 py-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-muted-background items-center justify-center">
                    <IconSymbol
                      name="silverware-fork-knife"
                      size={20}
                      color="--color-foreground"
                    />
                  </View>

                  <View>
                    <Text className="text-[16px] font-medium text-foreground">
                      Nutritional Goal
                    </Text>
                    <Text className="text-[12px] text-muted-foreground">
                      Days near calorie target
                    </Text>
                  </View>
                </View>

                <Text className="text-foreground font-semibold">
                  --
                </Text>
              </View>

            </View>
          </View>
      </ScrollView>
    </ThemedSafeView>
  );
}