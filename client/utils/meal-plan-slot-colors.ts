/** Default meal-slot accent colors (calendar + meal plan editor; saved per plan when customized). */
export const DEFAULT_MEAL_SLOT_COLORS = {
  breakfast: "#f0bb29",
  lunch: "#4fa34b",
  dinner: "#bd9b64",
} as const;

export type MealSlotColorKey = keyof typeof DEFAULT_MEAL_SLOT_COLORS;
