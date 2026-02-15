import { ThemedSafeView } from "@/components/themed-safe-view";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

type Nutrient = {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds: number;
};

function isPersonalRecipeId(id: string): boolean {
  return !/^\d+$/.test(id);
}

export default function NutritionPage() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const id = useMemo(() => (Array.isArray(recipeId) ? recipeId[0] : recipeId) ?? "", [recipeId]);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Nutrition");
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      setLoading(true);
      setError("");

      try {
        // Personal recipe
        if (isPersonalRecipeId(id)) {
          const res = await fetch(`${SERVER_URL}/api/recipes/${id}`);
          const data = await res.json();

          if (!res.ok) throw new Error(data?.error || "Failed to load recipe");

          const r = data?.recipe;
          setTitle(r?.title ?? "Nutrition");

          // If your personal recipe schema differs, adjust here:
          const personalNutrients: Nutrient[] =
            r?.nutrition?.nutrients && Array.isArray(r.nutrition.nutrients)
              ? r.nutrition.nutrients
              : [];

          setNutrients(personalNutrients);
          return;
        }

        // External recipe
        const res = await fetch(
          `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load nutrition");

        const r = data?.recipe;
        setTitle(r?.title ?? "Nutrition");

        const extNutrients: Nutrient[] =
          r?.nutrition?.nutrients && Array.isArray(r.nutrition.nutrients)
            ? r.nutrition.nutrients
            : [];

        setNutrients(extNutrients);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
        setNutrients([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  if (loading) {
    return (
      <ThemedSafeView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedSafeView>
    );
  }

  return (
    <ThemedSafeView className="flex-1">
      <ScrollView
        className="px-6 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold mb-4">{title}</Text>

        {!!error && (
          <Text className="text-red-600 mb-3">{error}</Text>
        )}

        {nutrients.length === 0 ? (
          <Text className="opacity-70">No nutrition data available.</Text>
        ) : (
          <View className="bg-white rounded-xl p-4 shadow">
            {nutrients.map((n, idx) => (
              <View
                key={`${n.name}-${idx}`}
                className="flex-row justify-between py-2 border-b border-gray-100"
              >
                <View className="flex-1 pr-3">
                  <Text className="font-semibold">{n.name}</Text>
                  <Text className="opacity-70 text-xs">
                    {Number(n.amount).toFixed(2)} {n.unit}
                  </Text>
                </View>

                <Text className="font-medium">
                  {n.percentOfDailyNeeds != null
                    ? `${Number(n.percentOfDailyNeeds).toFixed(0)}%`
                    : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedSafeView>
  );
}
