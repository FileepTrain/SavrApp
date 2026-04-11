import AsyncStorage from "@react-native-async-storage/async-storage";

// Normalized shape written to the per-recipe cache and read by the recipe detail page.
// All files that write recipe detail cache entries must produce this shape.
export interface CachedRecipeEntry {
  recipe: {
    title: string;
    image?: string | null;
    /** Extra photos from firebase storage */
    galleryImages?: Array<{ url: string; uploadedBy: string | null }>;
    readyInMinutes?: number;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    summary?: string;
    instructions?: string;
    equipment?: { name: string; image?: string | null }[];
    calories?: number;
    rating?: number;
    reviewsLength?: number;
    viewCount?: number;
    price?: number;
  };
  ingredients: {
    name: string;
    amount?: number;
    quantity?: number;
    unit?: string;
  }[];
}

// Stable keys for each cached dataset.
export const CACHE_KEYS = {
  MEAL_PLANS: "CACHE_MEAL_PLANS",
  PERSONAL_RECIPES: "CACHE_PERSONAL_RECIPES",
  PANTRY: "CACHE_PANTRY",
  // Plain array of favorited recipe ID strings. Used for isFavorited checks and server sync.
  FAVORITES_IDS: "CACHE_FAVORITES_IDS",
  // Full recipe objects for the offline favorites list display.
  FAVORITES_LIST: "CACHE_FAVORITES_LIST",
  // Most recently viewed recipes (newest first), max 20 entries
  RECIPE_VIEW_HISTORY: "CACHE_RECIPE_VIEW_HISTORY",
  // Per-recipe detail entries use a dynamic key; use recipeDetailKey() below.
  /** Cached array of the signed-in user's collections (list + grid UI). */
  COLLECTIONS_MINE: "CACHE_COLLECTIONS_MINE",
  /** Cached array of followed collections. */
  COLLECTIONS_FOLLOWED: "CACHE_COLLECTIONS_FOLLOWED",
} as const;

// Returns the AsyncStorage key for a single cached recipe detail.
export function recipeDetailKey(id: string): string {
  return `CACHE_RECIPE_DETAIL:${id}`;
}

/**
 * Detail payload for one collection (own or followed). `ownerScope` is the
 * collection owner's Firebase uid, or the literal `"me"` for boards you own.
 */
export function collectionDetailKey(
  ownerScope: string,
  collectionId: string,
): string {
  return `CACHE_COLLECTION_DETAIL:${ownerScope}:${collectionId}`;
}

// Serialises data to JSON and writes it to AsyncStorage.
// Failures are silently swallowed so that a storage error never breaks the online path.
export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Non-fatal: cache writes must not interrupt normal app flow.
  }
}

// Reads and deserialises a cached value. Returns null when the key is absent or JSON is corrupt.
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Removes a single cache entry (e.g. when user data is no longer valid).
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
