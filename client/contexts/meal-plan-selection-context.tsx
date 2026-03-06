import React, { createContext, useContext, useState } from "react";

export type Recipe = {
  id: string;
  title?: string;
  calories?: number;
  rating?: number;
  reviews?: unknown[];
  image?: string;
  [key: string]: unknown;
};

type MealPlanSelectionContextValue = {
  pendingSelectedRecipe: Recipe | null;
  setPendingSelectedRecipe: (recipe: Recipe | null) => void;
};

const MealPlanSelectionContext = createContext<MealPlanSelectionContextValue | null>(null);

export function MealPlanSelectionProvider({ children }: { children: React.ReactNode }) {
  const [pendingSelectedRecipe, setPendingSelectedRecipe] = useState<Recipe | null>(null);

  const value: MealPlanSelectionContextValue = {
    pendingSelectedRecipe,
    setPendingSelectedRecipe,
  };

  return (
    <MealPlanSelectionContext.Provider value={value}>
      {children}
    </MealPlanSelectionContext.Provider>
  );
}

export function useMealPlanSelection(): MealPlanSelectionContextValue {
  const ctx = useContext(MealPlanSelectionContext);
  if (!ctx) {
    throw new Error("useMealPlanSelection must be used within MealPlanSelectionProvider");
  }
  return ctx;
}
