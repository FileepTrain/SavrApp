// controllers/externalRecipeController.js
import ExternalRecipeModel from "../models/externalRecipeModel.js";
import { _computePriceForRecipe } from "./combinedRecipeController.js";

/**
 * Extract only the nutrients array from Spoonacular's nutrition object.
 * Spoonacular returns nutrition with nutrients, properties, flavonoids, ingredient nutrition, etc.
 * We store only { nutrients: [...] } to avoid storing the rest.
 */
function nutritionOnlyNutrients(nutrition) {
  if (
    !nutrition ||
    !nutrition.nutrients ||
    !Array.isArray(nutrition.nutrients)
  ) {
    return null;
  }
  return { nutrients: nutrition.nutrients };
}

/** Extract the calorie count from the summary text of an external recipe */
function extractCaloriesFromSummary(summary) {
  if (!summary || typeof summary !== "string") return undefined;
  const match = summary.match(/(\d+)\s*calories/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Returns true if the recipe passes all active filters.
 * Recipe shape: { price?, ... } (and later: extendedIngredients, equipment, readyInMinutes, etc.)
 * Add new filter logic here when new filter types are introduced.
 */
function passesFilters(recipe, filters) {
  if (!filters || typeof filters !== "object") return true;

  if (filters.budget) {
    const { min, max } = filters.budget;
    const price = recipe.price;
    // Only exclude when we have a price and it's outside the range; recipes without price still show
    if (typeof price === "number" && (price < min || price > max)) return false;
  }

  // Future: if (filters.allergies?.length) { ... }
  // Future: if (filters.cookware?.length) { ... }

  return true;
}

/**
 * Build simplified recipe payload from a Spoonacular recipe object (e.g. from complexSearch).
 * Includes normalized nutrition (when API provides it), computed price from ingredients,
 * flattened, numbered instruction steps, and a deduped list of equipment used.
 */
async function buildSimplifiedPayloadFromSpoonacular(data) {
  const nutrition = data.nutrition || null;

  // complexSearch returns ingredients under nutrition.ingredients (and sometimes extendedIngredients)
  const nutritionIngredients = Array.isArray(nutrition?.ingredients)
    ? nutrition.ingredients
    : [];
  const rawExtended =
    nutritionIngredients.length > 0
      ? nutritionIngredients
      : Array.isArray(data.extendedIngredients)
        ? data.extendedIngredients
        : [];

  const extendedIngredients = rawExtended.map((ing) => ({
    id: ing.id,
    name: ing.name,
    // original: ing.original ?? null,
    amount: ing.amount,
    unit: ing.unit,
    // image: ing.image ?? null,
  }));

  const instructionSteps = [];
  const equipmentMap = new Map();

  // Parse analyzedInstructions to get instruction steps and equipment used.
  if (Array.isArray(data.analyzedInstructions)) {
    for (const block of data.analyzedInstructions) {
      const steps = Array.isArray(block?.steps) ? block.steps : [];
      for (const step of steps) {
        if (step && typeof step.step === "string" && step.step.trim()) {
          instructionSteps.push(step.step);
        }

        // Collect a unique list of equipment used across all steps.
        const equipments = Array.isArray(step?.equipment) ? step.equipment : [];
        for (const eq of equipments) {
          // Ignore empty/invalid equipment objects or equipment already added
          if (!eq || !eq.name || equipmentMap.has(eq.name)) continue;

          equipmentMap.set(eq.name, {
            name: eq.name ?? eq.localizedName ?? null,
            image: eq.image ?? null,
          });
        }
      }
    }
  }

  const instructionsText =
    instructionSteps.length > 0
      ? instructionSteps.join("\n")
      : (data.instructions ?? null);

  const equipment = Array.from(equipmentMap.values());

  const price = await _computePriceForRecipe({ extendedIngredients });

  return {
    id: data.id,
    title: data.title,
    image: data.image,
    sourceUrl: data.sourceUrl,
    readyInMinutes: data.readyInMinutes,
    servings: data.servings,
    summary: data.summary ?? null,
    instructions: instructionsText,
    ingredientIds: rawExtended.map((ing) => ing.id).filter(Boolean),
    extendedIngredients,
    equipment,
    nutrition: nutritionOnlyNutrients(nutrition) ?? null,
    calories: extractCaloriesFromSummary(data.summary) ?? null,
    price: price ?? null,
    dishTypes: data.dishTypes ?? null,
    diets: data.diets ?? null,
    cuisines: data.cuisines ?? null,
  };
}

/**
 * Helper for combined feed: search external recipes and return items in a simplified
 * shape suitable for combined feed consumers.
 *
 * Parameters:
 * - filters: { q, budgetMin, budgetMax, ...etc later on }
 * - limit: max number of external items to return (capped at 20)
 * - offset: pagination offset (number)
 */
export const searchExternalRecipes = async ({ filters, limit, offset }) => {
  const q = (filters?.q ?? "").trim();
  const number = Math.min(parseInt(limit ?? "10", 10), 20);
  const safeOffset = Math.max(parseInt(offset ?? "0", 10), 0);

  if (!q || !number) {
    return {
      results: [],
      totalResults: 0,
      _meta: { cachedCount: 0, externalCount: 0, offset: safeOffset },
    };
  }

  const EXTERNAL_SOURCE = "spoonacular";

  // Always call Spoonacular complexSearch to get the canonical result set - result is divided into cached and new external recipes that need to be cached
  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", q);
  url.searchParams.set("number", String(number));
  url.searchParams.set("offset", String(safeOffset));
  url.searchParams.set("addRecipeInformation", "true");
  url.searchParams.set("addRecipeNutrition", "true");
  url.searchParams.set("addRecipeInstructions", "true");
  url.searchParams.set("instructionsRequired", "true");

  console.log("[Spoonacular] GET /recipes/complexSearch", { query: q, number, offset: safeOffset });

  const resp = await fetch(url, {
    headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.message || "Spoonacular request failed");
  }

  const apiResults = Array.isArray(data?.results) ? data.results : [];
  let totalResults = data?.totalResults ?? apiResults.length;

  // Hydrate from Firestore, caching any recipes we haven't seen before
  let cachedCount = 0;
  let newlyCachedCount = 0;

  const resultsWithPrice = [];

  for (const recipeData of apiResults) {
    const id = recipeData.id;
    if (id == null) continue;

    // Check if the recipe is already cached in Firestore
    let doc = await ExternalRecipeModel.findByExternal(
      EXTERNAL_SOURCE,
      String(id),
    );

    let wasCached = !!doc;

    // If the recipe is not cached, build the simplified payload and upsert it into Firestore
    if (!doc) {
      try {
        const simplified =
          await buildSimplifiedPayloadFromSpoonacular(recipeData);
        await ExternalRecipeModel.upsertFromExternal(
          EXTERNAL_SOURCE,
          id,
          simplified,
        );
        // Retrieve the recipe document that was just upserted into Firestore
        doc = await ExternalRecipeModel.findByExternal(
          EXTERNAL_SOURCE,
          String(id),
        );
        wasCached = false;
      } catch (err) {
        console.warn(
          "Failed to cache/price recipe from complexSearch (external search)",
          id,
          err?.message || err,
        );
      }
    }

    if (wasCached) {
      cachedCount += 1;
    } else {
      newlyCachedCount += 1;
    }

    // Add the cached / newly cached recipe to the resultsWithPrice array (include rating and viewCount for search screen)
    const reviewCount = doc && Number.isFinite(Number(doc.reviewCount)) ? Number(doc.reviewCount) : 0;
    const totalStars = doc && Number.isFinite(Number(doc.totalStars)) ? Number(doc.totalStars) : 0;
    const rating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;
    const viewCount = doc && Number.isFinite(Number(doc.viewCount)) ? Number(doc.viewCount) : 0;

    if (doc) {
      resultsWithPrice.push({
        id: Number(doc.id),
        title: doc.title ?? recipeData.title ?? null,
        image: doc.image ?? recipeData.image ?? null,
        calories: doc.calories ?? null,
        price: typeof doc.price === "number" ? doc.price : null,
        rating,
        reviewsLength: reviewCount,
        viewCount,
        _cached: wasCached,
      });
    } else {
      resultsWithPrice.push({
        id: Number(id),
        title: recipeData.title ?? null,
        image: recipeData.image ?? null,
        calories: null,
        price: null,
        rating: 0,
        reviewsLength: 0,
        viewCount: 0,
        _cached: false,
      });
    }
  }

  let results = resultsWithPrice;

  // Apply filters to the results
  let hasActiveFilters = false;
  const coreFilters = {};
  if (
    filters &&
    Number.isFinite(filters.budgetMin) &&
    Number.isFinite(filters.budgetMax)
  ) {
    coreFilters.budget = {
      min: Number(filters.budgetMin),
      max: Number(filters.budgetMax),
    };
    hasActiveFilters = true;
  }

  if (hasActiveFilters) {
    results = results.filter((r) => passesFilters(r, coreFilters));
  }

  // Order by view count (most viewed first)
  results.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));

  return {
    results,
    totalResults,
    filteredCount: results.length,
    _meta: {
      cachedCount,
      externalCount: newlyCachedCount,
      offset: safeOffset,
    },
  };
};

// Acquire Recipe Details from Firestore
export const getExternalRecipeDetails = async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    const includeNutrition =
      String(req.query.includeNutrition ?? "false").toLowerCase() === "true";

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid recipe id",
        code: "INVALID_RECIPE_ID",
      });
    }

    const EXTERNAL_SOURCE = "spoonacular";

    // External recipes are cached when they appear in search; details are read-only from the database
    const recipeFromDb = await ExternalRecipeModel.findByExternal(
      EXTERNAL_SOURCE,
      id,
    );
    if (!recipeFromDb) {
      return res.status(404).json({
        error:
          "Recipe not found. External recipes are loaded when you search; try searching for this recipe first.",
        code: "RECIPE_NOT_FOUND",
      });
    }

    if (!includeNutrition) {
      delete recipeFromDb.nutrition;
    } else if (recipeFromDb.nutrition) {
      recipeFromDb.nutrition = nutritionOnlyNutrients(recipeFromDb.nutrition);
    }

    // Track view (external recipes have no owner, so always increment)
    ExternalRecipeModel.incrementViewCount(EXTERNAL_SOURCE, id).catch((err) =>
      console.warn("External recipe view count increment failed:", err?.message),
    );

    return res.json({ success: true, recipe: recipeFromDb });
  } catch (error) {
    console.error("Error getting recipe details:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_DETAILS_FAILED",
    });
  }
};

// Pulls cached recipe from Firestore; optionally filters by budget (budgetMin, budgetMax)
export const getExternalRecipeFeed = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
    const budgetMin = Number.isFinite(Number(req.query.budgetMin)) ? Number(req.query.budgetMin) : 0;
    const budgetMax = Number.isFinite(Number(req.query.budgetMax)) ? Number(req.query.budgetMax) : 100;
    const fetchLimit = budgetMin > 0 || budgetMax < 100 ? Math.min(limit * 5, 100) : limit;
    let results = await ExternalRecipeModel.getLatestCached(fetchLimit);
    // Always sort by most views first so order is consistent after filter/reset
    const viewCount = (r) => (r && Number.isFinite(Number(r.viewCount)) ? Number(r.viewCount) : 0);
    results.sort((a, b) => viewCount(b) - viewCount(a) || (Number(a.id) - Number(b.id)));
    if (budgetMin > 0 || budgetMax < 100) {
      results = results.filter((r) => {
        const price = r.price;
        if (price == null || typeof price !== "number") return true;
        return price >= budgetMin && price <= budgetMax;
      });
    }
    results = results.slice(0, limit);
    return res.json({ success: true, results });
  } catch (error) {
    console.error("Error getting external recipe feed:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_FEED_FAILED",
    });
  }
};
