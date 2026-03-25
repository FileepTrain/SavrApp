import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecipeCard } from "@/components/recipe-card";
import { router } from "expo-router";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

export interface SwipeableMealPlanCardProps {
  id: string;
  startDateLabel: string;
  endDateLabel: string;
  breakfastId?: string | null;
  lunchId?: string | null;
  dinnerId?: string | null;
}

function parseRecipeIds(input?: string | null): string[] {
  if (!input) return [];

  // Meal plan stores multiple recipe ids as a comma-separated string, e.g. "638257,639715,1"
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function SwipeableMealPlanCard({
  id,
  startDateLabel,
  endDateLabel,
  breakfastId = null,
  lunchId = null,
  dinnerId = null,
}: SwipeableMealPlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [recipesById, setRecipesById] = useState<Record<string, any>>({});

  const breakfastRecipeIds = useMemo(() => parseRecipeIds(breakfastId), [breakfastId]);
  const lunchRecipeIds = useMemo(() => parseRecipeIds(lunchId), [lunchId]);
  const dinnerRecipeIds = useMemo(() => parseRecipeIds(dinnerId), [dinnerId]);

  const slotIds = useMemo(() => {
    // Flatten all meal recipe ids into one list for fetching.
    // Use a Set to avoid duplicate requests when the same recipe appears multiple times.
    const all = [...breakfastRecipeIds, ...lunchRecipeIds, ...dinnerRecipeIds];
    return Array.from(new Set(all));
  }, [breakfastRecipeIds, lunchRecipeIds, dinnerRecipeIds]);

  useEffect(() => {
    let cancelled = false;

    const fetchOne = async (recipeId: string, idToken?: string | null) => {
      const isPersonal = !/^\d+$/.test(recipeId);
      const url = isPersonal
        ? `${SERVER_URL}/api/recipes/${recipeId}`
        : `${SERVER_URL}/api/external-recipes/${recipeId}/details`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(url, { method: "GET", headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to fetch recipe");
      return json?.recipe ?? json;
    };

    const run = async () => {
      if (slotIds.length === 0) {
        setRecipesById({});
        setRecipesError(null);
        setRecipesLoading(false);
        return;
      }

      setRecipesLoading(true);
      setRecipesError(null);
      try {
        const idToken = await AsyncStorage.getItem("idToken");
        // Fetch each recipe detail in the meal plan
        const entries = await Promise.all(
          slotIds.map(async (rid) => {
            try {
              const data = await fetchOne(rid, idToken);
              return [rid, data] as const;
            } catch {
              return [rid, null] as const;
            }
          })
        );

        if (cancelled) return;
        const next: Record<string, any> = {};
        for (const [rid, data] of entries) next[rid] = data;
        setRecipesById(next);
      } catch (e) {
        if (cancelled) return;
        setRecipesError(e instanceof Error ? e.message : "Failed to load recipes");
      } finally {
        if (!cancelled) setRecipesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slotIds]);

  type MealSlotDisplay = "Breakfast" | "Lunch" | "Dinner";
  const renderRecipeCardsForMeal = (recipeIds: string[], meal: MealSlotDisplay) => {
    const titleFallback = `${meal} recipe`;

    return recipeIds.map((rid) => (
      <RecipeCard
        key={`${meal.toLowerCase()}-${rid}`}
        id={rid}
        variant="horizontal"
        title={recipesById[rid]?.title ?? titleFallback}
        calories={recipesById[rid]?.calories ?? 0}
        rating={recipesById[rid]?.rating ?? 0}
        reviewsLength={Array.isArray(recipesById[rid]?.reviews) ? recipesById[rid].reviews.length : 0}
        imageUrl={recipesById[rid]?.image ?? recipesById[rid]?.imageUrl ?? null}
      />
    ));
  };

  const renderRightActions = (
    _progress: unknown,
    _translation: unknown,
    swipeableMethods: { close: () => void }
  ) => (
    <View className="ml-2 flex flex-row">
      <Pressable
        onPress={() => {
          swipeableMethods.close();
          // TODO: Implement edit meal plan
          // router.push({ pathname: "/account/edit-recipe/[recipeId]", params: { recipeId: id } });
        }}
        className="bg-orange-500 justify-center items-center w-20 rounded-xl rounded-r-none gap-1"
      >
        <IconSymbol name="pencil-outline" size={28} color="--color-background" />
        <Text className="text-background text-sm font-medium">Edit</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          // TODO: Implement delete meal plan
          // handleDeleteRecipe();
          swipeableMethods.close();
        }}
        className="bg-red-primary justify-center items-center w-20 rounded-xl rounded-l-none gap-1"
      >
        <IconSymbol name="trash-can-outline" size={28} color="--color-background" />
        {loading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-background text-sm font-medium">Delete</Text>}
      </Pressable>
    </View>
  );

  return (
    <View className="overflow-hidden">
      {/* Swipeable header: Display the start and end dates of the meal plan */}
      <ReanimatedSwipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <View className="px-4 py-6 bg-background rounded-xl rounded-b-none overflow-hidden flex-col w-full drop-shadow-xl border-b border-muted-background">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-foreground font-semibold text-base">
                {startDateLabel} – {endDateLabel}
              </Text>
            </View>
            <IconSymbol name={"chevron-left"} size={20} color="--color-foreground" />
          </View>
        </View>
      </ReanimatedSwipeable>

      {/* Body: Render the recipes associated with the meal plan */}
      <View className="p-4 gap-3 bg-background rounded-xl rounded-t-none shadow-sm">
        {recipesLoading ? (
          <ActivityIndicator size="small" color="red" />
        ) : recipesError ? (
          <Text className="text-muted-foreground">{recipesError}</Text>
        ) : (
          <>
            {breakfastRecipeIds.length > 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#f0bb29" }}
                  />
                  <Text className="text-foreground font-semibold">Breakfast</Text>
                </View>
                {renderRecipeCardsForMeal(breakfastRecipeIds, "Breakfast")}
              </View>
            ) : null}

            {lunchRecipeIds.length > 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#4fa34b" }}
                  />
                  <Text className="text-foreground font-semibold">Lunch</Text>
                </View>
                {renderRecipeCardsForMeal(lunchRecipeIds, "Lunch")}
              </View>
            ) : null}

            {dinnerRecipeIds.length > 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#bd9b64" }}
                  />
                  <Text className="text-foreground font-semibold">Dinner</Text>
                </View>
                {renderRecipeCardsForMeal(dinnerRecipeIds, "Dinner")}
              </View>
            ) : null}
          </>)}
      </View>
    </View >
  );
}

