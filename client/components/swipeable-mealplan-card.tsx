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

  const slotIds = useMemo(
    () => [breakfastId, lunchId, dinnerId].filter((x): x is string => !!x),
    [breakfastId, lunchId, dinnerId]
  );

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
            {breakfastId ? (
              <View className="gap-2">
                <Text className="text-foreground font-semibold">Breakfast</Text>
                <RecipeCard
                  id={breakfastId}
                  variant="horizontal"
                  title={recipesById[breakfastId]?.title ?? "Breakfast recipe"}
                  calories={recipesById[breakfastId]?.calories ?? 0}
                  rating={recipesById[breakfastId]?.rating ?? 0}
                  reviewsLength={Array.isArray(recipesById[breakfastId]?.reviews) ? recipesById[breakfastId].reviews.length : 0}
                  imageUrl={recipesById[breakfastId]?.image ?? recipesById[breakfastId]?.imageUrl ?? null}
                />
              </View>
            ) : null}

            {lunchId ? (
              <View className="gap-2">
                <Text className="text-foreground font-semibold">Lunch</Text>
                <RecipeCard
                  id={lunchId}
                  variant="horizontal"
                  title={recipesById[lunchId]?.title ?? "Lunch recipe"}
                  calories={recipesById[lunchId]?.calories ?? 0}
                  rating={recipesById[lunchId]?.rating ?? 0}
                  reviewsLength={Array.isArray(recipesById[lunchId]?.reviews) ? recipesById[lunchId].reviews.length : 0}
                  imageUrl={recipesById[lunchId]?.image ?? recipesById[lunchId]?.imageUrl ?? null}
                />
              </View>
            ) : null}

            {dinnerId ? (
              <View className="gap-2">
                <Text className="text-foreground font-semibold">Dinner</Text>
                <RecipeCard
                  id={dinnerId}
                  variant="horizontal"
                  title={recipesById[dinnerId]?.title ?? "Dinner recipe"}
                  calories={recipesById[dinnerId]?.calories ?? 0}
                  rating={recipesById[dinnerId]?.rating ?? 0}
                  reviewsLength={Array.isArray(recipesById[dinnerId]?.reviews) ? recipesById[dinnerId].reviews.length : 0}
                  imageUrl={recipesById[dinnerId]?.image ?? recipesById[dinnerId]?.imageUrl ?? null}
                />
              </View>
            ) : null}
          </>)}
      </View>
    </View >
  );
}

