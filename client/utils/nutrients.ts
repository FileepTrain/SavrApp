import AsyncStorage from "@react-native-async-storage/async-storage";

const NUTRIENT_DISPLAY_STORAGE_KEY = "NUTRIENT_DISPLAY";

/** All nutrient options in display order (matches API names) */
export const ALL_NUTRIENTS = [
  "Calories",
  "Fat",
  "Saturated Fat",
  "Carbohydrates",
  "Net Carbohydrates",
  "Sugar",
  "Cholesterol",
  "Sodium",
  "Alcohol",
  "Alcohol %",
  "Protein",
  "Vitamin B3",
  "Selenium",
  "Vitamin B6",
  "Vitamin A",
  "Phosphorus",
  "Vitamin B5",
  "Potassium",
  "Vitamin B1",
  "Vitamin B2",
  "Magnesium",
  "Manganese",
  "Folate",
  "Iron",
  "Fiber",
  "Zinc",
  "Vitamin C",
  "Copper",
  "Vitamin B12",
  "Vitamin E",
  "Vitamin K",
  "Calcium",
  "Vitamin D",
] as const;

/** Default nutrients to show (current behavior) */
export const DEFAULT_DISPLAY_NUTRIENTS: readonly string[] = [
  "Calories",
  "Protein",
  "Fat",
  "Carbohydrates",
  "Fiber",
];

/**
 * Load user's nutrient display preferences from AsyncStorage.
 * Returns the set of nutrient names to display; uses default if none saved.
 */
export async function loadNutrientDisplayPrefs(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(NUTRIENT_DISPLAY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const arr = Array.isArray(parsed) ? parsed : [];
      const valid = arr.filter((name) =>
        ALL_NUTRIENTS.includes(name as (typeof ALL_NUTRIENTS)[number])
      );
      if (valid.length > 0) return new Set(valid);
    }
  } catch (error) {
    console.error("Error loading nutrient display prefs:", error);
  }
  return new Set(DEFAULT_DISPLAY_NUTRIENTS);
}

/**
 * Save user's nutrient display preferences to AsyncStorage.
 */
export async function saveNutrientDisplayPrefs(
  nutrients: Set<string>
): Promise<void> {
  const arr = Array.from(nutrients);
  await AsyncStorage.setItem(
    NUTRIENT_DISPLAY_STORAGE_KEY,
    JSON.stringify(arr)
  );
}
