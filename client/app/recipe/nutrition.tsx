import { ThemedSafeView } from "@/components/themed-safe-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

/** ✅ Keep the page simple: only show these nutrients (like your UI expects) */
const DISPLAY_NUTRIENTS = [
  "Calories",
  "Protein",
  "Fat",
  "Carbohydrates",
  "Fiber",
] as const;

function pickDisplayNutrients(all: Nutrient[]): Nutrient[] {
  if (!Array.isArray(all)) return [];
  const map = new Map(all.map((n) => [String(n.name || "").toLowerCase(), n]));
  return DISPLAY_NUTRIENTS.map((name) => map.get(name.toLowerCase()))
    .filter(Boolean) as Nutrient[];
}

export default function NutritionPage() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const id = useMemo(
    () => (Array.isArray(recipeId) ? recipeId[0] : recipeId) ?? "",
    [recipeId]
  );

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Nutrition");
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!id) return;

      setLoading(true);
      setError("");
      setNutrients([]);

      try {
        // =========================
        // Personal recipe
        // =========================
        if (isPersonalRecipeId(id)) {
          const idToken = await AsyncStorage.getItem("idToken");
          if (!idToken) throw new Error("No token provided");

          // 1) load recipe
          const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to load recipe");

          const r = data?.recipe;
          setTitle(r?.title ?? "Nutrition");

          const storedNutrients: Nutrient[] =
            r?.nutrition?.nutrients && Array.isArray(r.nutrition.nutrients)
              ? r.nutrition.nutrients
              : [];

          // 2) if missing nutrition, compute it (and use response)
          if (!storedNutrients.length) {
            const computeRes = await fetch(
              `${SERVER_URL}/api/recipes/${id}/nutrition`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${idToken}` },
              }
            );
            const computeJson = await computeRes.json();
            if (!computeRes.ok) {
              throw new Error(
                computeJson?.error || "Failed to compute nutrition"
              );
            }

            const computedNutrients: Nutrient[] =
              computeJson?.nutrition?.nutrients &&
              Array.isArray(computeJson.nutrition.nutrients)
                ? computeJson.nutrition.nutrients
                : [];

            setNutrients(pickDisplayNutrients(computedNutrients));
            return;
          }

          // 3) show stored nutrition (filtered)
          setNutrients(pickDisplayNutrients(storedNutrients));
          return;
        }

        // =========================
        // External recipe
        // =========================
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

        setNutrients(pickDisplayNutrients(extNutrients));
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
      <ScrollView className="px-6 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold mb-4">{title}</Text>

        {!!error && <Text className="text-red-600 mb-3">{error}</Text>}

        {nutrients.length === 0 ? (
          <Text className="opacity-70">No nutrition data available.</Text>
        ) : (
          <View className="bg-white rounded-xl p-4 shadow">
            {nutrients.map((n, idx) => (
              <View
                key={`${n.name}-${idx}`}
                className="flex-row justify-between py-2 border-b border-gray-100"
              >
                <Text className="font-semibold">{n.name}</Text>
                <Text className="opacity-80">
                  {Number(n.amount).toFixed(n.name === "Calories" ? 0 : 1)}{" "}
                  {n.unit}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedSafeView>
  );
}
