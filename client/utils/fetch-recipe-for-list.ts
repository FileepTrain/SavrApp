import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = "http://10.0.2.2:3000";

function isExternalFirestoreRecipeId(id: string): boolean {
  return id.startsWith("spoonacular_");
}

function isRawExternalRecipeId(id: string): boolean {
  return /^\d+$/.test(id);
}

function isPersonalRecipeId(id: string): boolean {
  return !isExternalFirestoreRecipeId(id) && !isRawExternalRecipeId(id);
}

/** Fetches recipe data for list cards; matches recipe detail ID rules. */
export async function fetchRecipeForList(id: string): Promise<Record<string, unknown> | null> {
  try {
    const idToken = await AsyncStorage.getItem("idToken");

    if (isPersonalRecipeId(id) || isExternalFirestoreRecipeId(id)) {
      const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
        headers: {
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.recipe ?? null;
    }

    const res = await fetch(`${SERVER_URL}/api/external-recipes/${id}/details`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.recipe ?? null;
  } catch {
    return null;
  }
}
