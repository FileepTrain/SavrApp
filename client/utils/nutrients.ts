import AsyncStorage from "@react-native-async-storage/async-storage";

const NUTRIENT_DISPLAY_STORAGE_KEY = "NUTRIENT_DISPLAY";
const SERVER_URL = "http://10.0.2.2:3000";

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
 * Load user's nutrient display preferences from server (with AsyncStorage fallback).
 * Returns the set of nutrient names to display; uses default if none saved.
 */
export async function loadNutrientDisplayPrefs(): Promise<Set<string>> {
  try {
    const idToken = await AsyncStorage.getItem("idToken");

    // Try to fetch from server first if user is logged in
    if (idToken) {
      try {
        const response = await fetch(
          `${SERVER_URL}/api/auth/get-preferences?fields=nutrientDisplay`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.nutrientDisplay)) {
            const valid = data.nutrientDisplay.filter((name: unknown) =>
              typeof name === "string" &&
              ALL_NUTRIENTS.includes(name as (typeof ALL_NUTRIENTS)[number]),
            );
            if (valid.length > 0) {
              await AsyncStorage.setItem(
                NUTRIENT_DISPLAY_STORAGE_KEY,
                JSON.stringify(valid),
              );
              return new Set(valid);
            }
          }
        }
      } catch (serverError) {
        console.warn(
          "Failed to fetch nutrient display from server, using local cache:",
          serverError,
        );
      }
    }

    // Fallback to local storage
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
 * Save user's nutrient display preferences to server and AsyncStorage.
 */
export async function saveNutrientDisplayPrefs(
  nutrients: Set<string>
): Promise<void> {
  const arr = Array.from(nutrients);

  // Save to local storage immediately for offline support
  try {
    await AsyncStorage.setItem(
      NUTRIENT_DISPLAY_STORAGE_KEY,
      JSON.stringify(arr),
    );
  } catch (error) {
    console.error("Error saving nutrient display prefs to local storage:", error);
  }

  // Sync to server if user is logged in
  try {
    const idToken = await AsyncStorage.getItem("idToken");
    if (idToken) {
      const response = await fetch(
        `${SERVER_URL}/api/auth/update-preferences`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nutrientDisplay: arr }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to sync nutrient display prefs to server:", errorData);
        // Don't throw - local save succeeded
      }
    }
  } catch (error) {
    console.error("Error syncing nutrient display prefs to server:", error);
    // Don't throw - local save succeeded
  }
}
