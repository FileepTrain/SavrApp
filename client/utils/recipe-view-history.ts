import type { CachedRecipeEntry } from "@/utils/offline-cache";
import { CACHE_KEYS, readCache, writeCache } from "@/utils/offline-cache";

const MAX_ENTRIES = 20;

export type RecipeViewHistoryEntry = {
  id: string;
  title: string;
  calories: number;
  rating: number;
  reviewsLength: number;
  imageUrl?: string | null;
};

type RecipeSnapshot = Pick<
  CachedRecipeEntry["recipe"],
  "title" | "image" | "calories" | "rating" | "reviewsLength"
>;

// Converts a recipe object to a history entry
export function recipeToHistoryEntry(
  recipeId: string,
  recipe: RecipeSnapshot,
): RecipeViewHistoryEntry {
  return {
    id: recipeId,
    title:
      typeof recipe.title === "string" && recipe.title.trim()
        ? recipe.title.trim()
        : "Recipe",
    calories: typeof recipe.calories === "number" ? recipe.calories : 0,
    rating: typeof recipe.rating === "number" ? recipe.rating : 0,
    reviewsLength:
      typeof recipe.reviewsLength === "number" ? recipe.reviewsLength : 0,
    imageUrl: recipe.image ?? null,
  };
}

// Records a new recipe view in the history
export async function recordRecipeViewHistory(
  entry: RecipeViewHistoryEntry,
): Promise<void> {
  const prev =
    (await readCache<RecipeViewHistoryEntry[]>(
      CACHE_KEYS.RECIPE_VIEW_HISTORY,
    )) ?? [];
  const rest = prev.filter((e) => e.id !== entry.id);
  const next = [entry, ...rest].slice(0, MAX_ENTRIES);
  await writeCache(CACHE_KEYS.RECIPE_VIEW_HISTORY, next);
}

// Loads the recipe view history from the cache
export async function loadRecipeViewHistory(): Promise<
  RecipeViewHistoryEntry[]
> {
  const list = await readCache<RecipeViewHistoryEntry[]>(
    CACHE_KEYS.RECIPE_VIEW_HISTORY,
  );
  return Array.isArray(list) ? list : [];
}

export async function clearRecipeViewHistory(): Promise<void> {
  await writeCache(CACHE_KEYS.RECIPE_VIEW_HISTORY, []);
}
