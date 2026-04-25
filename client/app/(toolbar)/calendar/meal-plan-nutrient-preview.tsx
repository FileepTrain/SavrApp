// Daily nutrient totals: 1 serving breakfast + 1 serving lunch + 1 serving dinner
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useNetwork } from "@/contexts/network-context";
import {
  ALL_NUTRIENTS,
  loadNutrientDisplayPrefs,
} from "@/utils/nutrients";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";

import { SERVER_URL } from "@/utils/server-url";

type NutrientRow = {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds: number;
};

function isPersonalRecipeId(id: string): boolean {
  return !/^\d+$/.test(id);
}

async function fetchRecipeNutritionAndServings(
  id: string
): Promise<{ nutrients: NutrientRow[]; servings: number }> {
  const servings = 1;
  const nutrients: NutrientRow[] = [];

  if (isPersonalRecipeId(id)) {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return { nutrients: [], servings: 1 };

    const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load recipe");

    const r = data?.recipe;
    const s = r?.servings != null ? Number(r.servings) : 1;
    let nut: NutrientRow[] =
      r?.nutrition?.nutrients && Array.isArray(r.nutrition.nutrients)
        ? r.nutrition.nutrients
        : [];

    if (nut.length === 0) {
      const computeRes = await fetch(
        `${SERVER_URL}/api/recipes/${id}/nutrition`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );
      const computeJson = await computeRes.json();
      if (computeRes.ok && computeJson?.nutrition?.nutrients) {
        nut = computeJson.nutrition.nutrients;
      }
    }

    return {
      nutrients: nut.map((n: any) => ({
        name: n.name ?? "",
        amount: Number(n.amount) || 0,
        unit: n.unit ?? "",
        percentOfDailyNeeds: Number(n.percentOfDailyNeeds) || 0,
      })),
      servings: s,
    };
  }

  const res = await fetch(
    `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to load recipe");

  const r = data?.recipe;
  const s = r?.servings != null ? Number(r.servings) : 1;
  const nut =
    r?.nutrition?.nutrients && Array.isArray(r.nutrition.nutrients)
      ? r.nutrition.nutrients
      : [];

  return {
    nutrients: nut.map((n: any) => ({
      name: n.name ?? "",
      amount: Number(n.amount) || 0,
      unit: n.unit ?? "",
      percentOfDailyNeeds: Number(n.percentOfDailyNeeds) || 0,
    })),
    servings: s,
  };
}

function mergeNutrients(
  results: { nutrients: NutrientRow[]; servings: number }[]
): NutrientRow[] {
  const byKey = new Map<
    string,
    { name: string; amount: number; unit: string; percentOfDailyNeeds: number }
  >();

  // Nutrient data from the API is already per serving; just sum across meals.
  for (const { nutrients } of results) {
    for (const n of nutrients) {
      const key = (n.name || "").toLowerCase().trim();
      if (!key) continue;
      const amount = Number(n.amount) || 0;
      const pct = Number(n.percentOfDailyNeeds) || 0;
      const existing = byKey.get(key);
      if (existing) {
        existing.amount += amount;
        existing.percentOfDailyNeeds += pct;
      } else {
        byKey.set(key, {
          name: n.name || "",
          amount,
          unit: n.unit ?? "",
          percentOfDailyNeeds: pct,
        });
      }
    }
  }

  return Array.from(byKey.values());
}

export default function MealPlanNutrientPreviewPage() {
  const params = useLocalSearchParams<{
    breakfastIds?: string;
    lunchIds?: string;
    dinnerIds?: string;
  }>();

  const { isOnline } = useNetwork();

  // Nutrient preview requires external API calls for nutrition data; it cannot function offline.
  if (!isOnline) {
    return (
      <ThemedSafeView className="flex-1 items-center justify-center px-8 gap-4">
        <Text className="text-foreground text-center text-lg font-semibold">
          Nutrient preview is unavailable offline
        </Text>
        <Text className="text-muted-foreground text-center">
          Connect to the internet to view nutrient totals for your meal plan.
        </Text>
      </ThemedSafeView>
    );
  }

  function parseIds(value?: string | string[]): string[] {
    if (!value) return [];
    const v = Array.isArray(value) ? value[0] : value;

    try {
      const parsed = JSON.parse(v);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((x) => (x != null ? String(x) : null))
        .filter((x): x is string => x !== null);
    } catch {
      return [];
    }
  }
  const breakfastIds = parseIds(params.breakfastIds);
  const lunchIds = parseIds(params.lunchIds);
  const dinnerIds = parseIds(params.dinnerIds);

  console.log("BreakfastIds:", breakfastIds);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayPrefs, setDisplayPrefs] = useState<Set<string>>(new Set());
  const [merged, setMerged] = useState<NutrientRow[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      setMerged([]);

      const prefs = await loadNutrientDisplayPrefs();
      setDisplayPrefs(prefs);

      const ids = [
        ...breakfastIds,
        ...lunchIds,
        ...dinnerIds,
      ]
        .filter(id => id !== undefined && id !== null)
        .map(id => String(id).trim())
        .filter(id => id.length > 0);

      console.log("Fetching nutrients for:", ids);


      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          ids.map(id => fetchRecipeNutritionAndServings(id))
        );
        const all = mergeNutrients(results);
        setMerged(all);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load nutrition");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [params.breakfastIds, params.lunchIds, params.dinnerIds]);

  const toShow = useMemo(() => {
    const prefsLower =
      displayPrefs.size > 0
        ? new Set(
          Array.from(displayPrefs).map((s) => s.toLowerCase().trim())
        )
        : null;
    const filtered =
      prefsLower == null
        ? merged
        : merged.filter((m) =>
          prefsLower.has((m.name || "").toLowerCase().trim())
        );
    const orderIdx = new Map(
      ALL_NUTRIENTS.map((name, i) => [name.toLowerCase().trim(), i])
    );
    return [...filtered].sort(
      (a, b) =>
        (orderIdx.get(a.name.toLowerCase().trim()) ?? 999) -
        (orderIdx.get(b.name.toLowerCase().trim()) ?? 999)
    );
  }, [merged, displayPrefs]);

  if (loading) {
    return (
      <ThemedSafeView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedSafeView>
    );
  }

  return (
    <ThemedSafeView className="flex-1 px-4">
      <ScrollView
        className="flex-1 pt-6"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <AccountWebColumn>
        {error ? (
          <Text className="text-red-primary mb-3 text-base">{error}</Text>
        ) : toShow.length === 0 ? (
          <Text className="opacity-70 text-base text-foreground">
            Add breakfast, lunch, and dinner to your meal plan to see totals.
          </Text>
        ) : (
          <View className="bg-white rounded-xl p-5 shadow mt-2">
            {toShow.map((n, idx) => (
              <View
                key={`${n.name}-${idx}`}
                className="flex-row justify-between items-center py-3.5 border-b border-gray-100"
              >
                <Text className="font-semibold text-foreground flex-1 text-[17px]">
                  {n.name}
                </Text>
                <View className="flex-row items-center gap-3">
                  <Text className="text-foreground opacity-90 text-[17px]">
                    {Number(n.amount).toFixed(n.name === "Calories" ? 0 : 1)}{" "}
                    {n.unit}
                  </Text>
                  <Text className="text-muted-foreground text-base min-w-[56px] text-right">
                    {Number(n.percentOfDailyNeeds).toFixed(1)}% daily
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        </AccountWebColumn>
      </ScrollView>
    </ThemedSafeView>
  );
}
