import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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

interface MealPlansState {
  mealPlans: MealPlanItem[];
  loading: boolean;
  error: string | null;
}

interface MealPlansContextValue extends MealPlansState {
  refetch: () => Promise<void>;
  setMealPlans: React.Dispatch<React.SetStateAction<MealPlanItem[]>>;
}

const MealPlansContext = createContext<MealPlansContextValue | null>(null);

async function fetchMealPlans(): Promise<MealPlanItem[]> {
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

  return Array.isArray(data?.mealPlans) ? data.mealPlans : [];
}

export function MealPlansProvider({ children }: { children: React.ReactNode }) {
  const [mealPlans, setMealPlans] = useState<MealPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMealPlans();
      setMealPlans(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch meal plans");
      setMealPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value: MealPlansContextValue = {
    mealPlans,
    loading,
    error,
    refetch,
    setMealPlans,
  };

  return <MealPlansContext.Provider value={value}>{children}</MealPlansContext.Provider>;
}

export function useMealPlans(): MealPlansContextValue {
  const ctx = useContext(MealPlansContext);
  if (!ctx) throw new Error("useMealPlans must be used within MealPlansProvider");
  return ctx;
}

