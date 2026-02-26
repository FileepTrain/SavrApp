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
 * Parse filter params from request query into a normalized filters object.
 * Add new filter types here; passesFilters() should implement the matching logic for each.
 */
function parseFiltersFromQuery(query) {
  const filters = {};
  const budgetMin = Number.isFinite(Number(query?.budgetMin))
    ? Number(query.budgetMin)
    : null;
  const budgetMax = Number.isFinite(Number(query?.budgetMax))
    ? Number(query.budgetMax)
    : null;
  if (budgetMin != null && budgetMax != null) {
    filters.budget = { min: budgetMin, max: budgetMax };
  }
  // Future: filters.allergies = parseArray(query.allergies);
  // Future: filters.cookware = parseArray(query.cookware);
  return filters;
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
    if (typeof price !== "number" || price < min || price > max) return false;
  }

  // Future: if (filters.allergies?.length) { ... }
  // Future: if (filters.cookware?.length) { ... }

  return true;
}

/**
 * Build simplified recipe payload from a Spoonacular recipe object (e.g. from complexSearch).
 * Includes normalized nutrition (when API provides it), computed price from ingredients,
 * and flattened, numbered instruction steps.
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

  // Flatten analyzedInstructions into a single ordered list of step strings
  const instructionSteps = [];
  if (Array.isArray(data.analyzedInstructions)) {
    for (const block of data.analyzedInstructions) {
      const steps = Array.isArray(block?.steps) ? block.steps : [];
      for (const step of steps) {
        if (!step || typeof step.step !== "string" || !step.step.trim())
          continue;
        instructionSteps.push(step.step);
      }
    }
  }

  const instructionsText =
    instructionSteps.length > 0
      ? instructionSteps.join("\n")
      : (data.instructions ?? null);

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
    equipment: [],
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

  // 1. Get cached results first
  const cached = await ExternalRecipeModel.searchCachedByTitle(
    EXTERNAL_SOURCE,
    q,
    number,
  );
  const cachedIds = new Set(cached.map((r) => r.id));
  console.log("cachedIds", cachedIds);

  let externalFromApi = [];
  let totalResults = cached.length;

  // 2. If limit not reached, call Spoonacular complexSearch (single rich call)
  if (cached.length < number) {
    const remaining = number - cached.length;

    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("query", q);
    url.searchParams.set("number", String(remaining));
    url.searchParams.set("offset", String(safeOffset));
    url.searchParams.set("addRecipeInformation", "true");
    url.searchParams.set("addRecipeNutrition", "true");
    url.searchParams.set("addRecipeInstructions", "true");
    url.searchParams.set("instructionsRequired", "true");

    const resp = await fetch(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.message || "Spoonacular request failed");
    }

    // Exclude results already cached
    externalFromApi = Array.isArray(data?.results)
      ? data.results.filter((r) => !cachedIds.has(r.id))
      : [];
    totalResults = data?.totalResults ?? totalResults;

    // Cache any newly discovered recipes
    if (externalFromApi.length > 0) {
      for (const recipeData of externalFromApi) {
        const id = recipeData.id;
        if (id == null) continue;
        try {
          const simplified =
            await buildSimplifiedPayloadFromSpoonacular(recipeData);
          await ExternalRecipeModel.upsertFromExternal(
            EXTERNAL_SOURCE,
            id,
            simplified,
          );
        } catch (err) {
          console.warn(
            "Failed to cache/price recipe from complexSearch (combined feed)",
            id,
            err?.message || err,
          );
        }
      }
    }
  }

  // 3. Build candidate list (cached first, then newly discovered)
  const candidateIds = [
    ...cached.map((r) => r.id),
    ...externalFromApi.map((r) => r.id),
  ].slice(0, number);

  // 4. Hydrate from Firestore and attach price
  const resultsWithPrice = await Promise.all(
    candidateIds.map(async (id) => {
      const doc = await ExternalRecipeModel.findByExternal(
        EXTERNAL_SOURCE,
        String(id),
      );
      const hit =
        cached.find((r) => r.id === id) ||
        externalFromApi.find((r) => r.id === id);

      if (doc) {
        return {
          id: Number(doc.id),
          title: doc.title ?? hit?.title ?? null,
          image: doc.image ?? hit?.image ?? null,
          calories: doc.calories ?? hit?.calories ?? null,
          price: typeof doc.price === "number" ? doc.price : null,
          _cached: !!cached.find((r) => r.id === id),
        };
      }
      if (!hit) return null;
      return {
        id: hit.id,
        title: hit.title ?? null,
        image: hit.image ?? null,
        calories: hit.calories ?? null,
        price: null,
        _cached: false,
      };
    }),
  );

  let results = resultsWithPrice.filter(Boolean);

  // 5. Apply budget filter using the filters object (budgetMin/budgetMax)
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

  return {
    results: results,
    totalResults: hasActiveFilters ? results.length : totalResults,
    _meta: {
      cachedCount: cached.length,
      externalCount: externalFromApi.length,
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
    return res.json({ success: true, recipe: recipeFromDb });
  } catch (error) {
    console.error("Error getting recipe details:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_DETAILS_FAILED",
    });
  }
};

// Pulls cached recipe from Firestore
export const getExternalRecipeFeed = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
    const results = await ExternalRecipeModel.getLatestCached(limit);
    return res.json({ success: true, results });
  } catch (error) {
    console.error("Error getting external recipe feed:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_FEED_FAILED",
    });
  }
};
