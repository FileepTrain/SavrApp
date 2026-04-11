import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CACHE_KEYS,
  type CachedRecipeEntry,
  readCache,
  recipeDetailKey,
  writeCache,
} from "@/utils/offline-cache";
import type { RecipeViewHistoryEntry } from "@/utils/recipe-view-history";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

function isExternalFirestoreRecipeId(id: string): boolean {
  return id.startsWith("spoonacular_");
}

function isRawExternalRecipeId(id: string): boolean {
  return /^\d+$/.test(id);
}

function isPersonalRecipeId(id: string): boolean {
  return !isExternalFirestoreRecipeId(id) && !isRawExternalRecipeId(id);
}

/** Saves a minimal detail cache entry so collection grids work offline after one online load. */
async function persistFetchedListRecipe(recipeId: string, recipe: Record<string, unknown>): Promise<void> {
  try {
    const title = typeof recipe.title === "string" ? recipe.title.trim() : "";
    if (!title) return;
    const rid = String(recipe.id ?? recipeId);
    const reviews = Array.isArray(recipe.reviews) ? recipe.reviews : [];
    const reviewCount =
      typeof recipe.reviewCount === "number" ? recipe.reviewCount : reviews.length;
    const entry: CachedRecipeEntry = {
      recipe: {
        title,
        image: (recipe.image as string | null | undefined) ?? null,
        readyInMinutes: typeof recipe.readyInMinutes === "number" ? recipe.readyInMinutes : undefined,
        prepTime: typeof recipe.prepTime === "number" ? recipe.prepTime : undefined,
        cookTime: typeof recipe.cookTime === "number" ? recipe.cookTime : undefined,
        servings: typeof recipe.servings === "number" ? recipe.servings : undefined,
        calories: typeof recipe.calories === "number" ? recipe.calories : undefined,
        rating: typeof recipe.rating === "number" ? recipe.rating : undefined,
        reviewsLength: reviewCount,
        viewCount: typeof recipe.viewCount === "number" ? recipe.viewCount : undefined,
      },
      ingredients: [],
    };
    await writeCache(recipeDetailKey(rid), entry);
  } catch {
    // Non-fatal
  }
}

function listRowFromDetailCache(id: string, entry: CachedRecipeEntry): Record<string, unknown> {
  const rev = entry.recipe.reviewsLength ?? 0;
  return {
    id,
    title: entry.recipe.title,
    calories: entry.recipe.calories,
    rating: entry.recipe.rating,
    reviewCount: rev,
    reviews: rev > 0 ? Array.from({ length: rev }, () => ({})) : [],
    image: entry.recipe.image ?? null,
  };
}

/** Used when the API is unreachable; tries every local dataset that might hold list-card fields. */
async function recipeForListFromOfflineCaches(id: string): Promise<Record<string, unknown> | null> {
  const detail = await readCache<CachedRecipeEntry>(recipeDetailKey(id));
  if (detail?.recipe?.title) {
    return listRowFromDetailCache(id, detail);
  }

  const favorites = await readCache<unknown[]>(CACHE_KEYS.FAVORITES_LIST);
  if (Array.isArray(favorites)) {
    const row = favorites.find((r: unknown) => {
      if (!r || typeof r !== "object") return false;
      return String((r as { id?: string }).id) === String(id);
    }) as Record<string, unknown> | undefined;
    if (row && typeof row.title === "string" && row.title.trim()) {
      const reviews = row.reviews;
      const reviewCount =
        typeof row.reviewCount === "number"
          ? row.reviewCount
          : Array.isArray(reviews)
            ? reviews.length
            : 0;
      return {
        id: String(row.id ?? id),
        title: row.title,
        calories: typeof row.calories === "number" ? row.calories : undefined,
        rating: typeof row.rating === "number" ? row.rating : undefined,
        reviewCount,
        reviews: Array.isArray(reviews) ? reviews : reviewCount > 0 ? Array.from({ length: reviewCount }, () => ({})) : [],
        image: (row.image as string | null | undefined) ?? null,
      };
    }
  }

  const history = await readCache<RecipeViewHistoryEntry[]>(CACHE_KEYS.RECIPE_VIEW_HISTORY);
  if (Array.isArray(history)) {
    const h = history.find((e) => e.id === id);
    if (h?.title) {
      const rev = h.reviewsLength ?? 0;
      return {
        id: h.id,
        title: h.title,
        calories: h.calories,
        rating: h.rating,
        reviewCount: rev,
        reviews: rev > 0 ? Array.from({ length: rev }, () => ({})) : [],
        image: h.imageUrl ?? null,
      };
    }
  }

  if (isPersonalRecipeId(id) || isExternalFirestoreRecipeId(id)) {
    const personal = await readCache<Array<{ id: string; title?: string; image?: string | null; calories?: number; rating?: number; reviews?: unknown[] }>>(
      CACHE_KEYS.PERSONAL_RECIPES,
    );
    if (Array.isArray(personal)) {
      const p = personal.find((r) => String(r.id) === String(id));
      if (p?.title) {
        const reviews = p.reviews;
        const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
        return {
          id: String(p.id),
          title: p.title,
          calories: p.calories,
          rating: p.rating,
          reviewCount,
          reviews: Array.isArray(reviews) ? reviews : [],
          image: p.image ?? null,
        };
      }
    }
  }

  return null;
}

/** Fetches recipe data for list cards; matches recipe detail ID rules. Falls back to offline caches when offline. */
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
      if (res.ok) {
        const data = await res.json();
        const recipe = data.recipe ?? null;
        if (recipe) {
          const row = recipe as Record<string, unknown>;
          void persistFetchedListRecipe(id, row);
          return row;
        }
      }
    } else {
      const res = await fetch(`${SERVER_URL}/api/external-recipes/${id}/details`);
      if (res.ok) {
        const data = await res.json();
        const recipe = data.recipe ?? null;
        if (recipe) {
          const row = recipe as Record<string, unknown>;
          void persistFetchedListRecipe(id, row);
          return row;
        }
      }
    }
  } catch {
    // Network failure — try caches below.
  }

  return recipeForListFromOfflineCaches(id);
}
