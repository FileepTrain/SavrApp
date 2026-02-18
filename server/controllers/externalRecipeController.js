// controllers/externalRecipeController.js
import ExternalRecipeModel from "../models/externalRecipeModel.js";
import ExternalIngredientModel from "../models/externalIngredientModel.js";

// Search external recipes from spoonacular and firestore
export const searchExternalRecipes = async (req, res) => {
  try {
    const q = (req.query.q ?? "").trim();
    const number = Math.min(parseInt(req.query.number ?? "10", 10), 20);
    const offset = Math.max(parseInt(req.query.offset ?? "0", 10), 0);

    if (!q) {
      return res.status(400).json({
        error: "Missing query parameter: q",
        code: "MISSING_QUERY",
      });
    }

    const EXTERNAL_SOURCE = "spoonacular";

    // Search cached recipes in Firestore first
    const cached = await ExternalRecipeModel.searchCachedByTitle(
      EXTERNAL_SOURCE,
      q,
      number
    );

    if (cached.length >= number) {
      return res.json({
        success: true,
        results: cached,
        totalResults: cached.length,
        _meta: { cachedCount: cached.length, externalCount: 0, offset },
      });
    }

    // Query Spoonacular if not in cache
    const remaining = number - cached.length;

    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("query", q);
    url.searchParams.set("number", String(remaining));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("addRecipeInformation", "false");
    url.searchParams.set("instructionsRequired", "true");

    const resp = await fetch(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = await resp.json();
    const quotaLeft = resp.headers.get("x-api-quota-left");
    if (quotaLeft) res.set("x-api-quota-left", quotaLeft);

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || "Spoonacular request failed",
        code: "SPOONACULAR_ERROR",
        details: data,
      });
    }

    const cachedIds = new Set(cached.map((r) => r.id));

    const externalResults = Array.isArray(data?.results)
      ? data.results
          .filter((r) => !cachedIds.has(r.id))
          .map((r) => ({ ...r, _cached: false }))
      : [];

    return res.json({
      success: true,
      results: [...cached, ...externalResults],
      totalResults: data?.totalResults ?? 0,
      _meta: {
        cachedCount: cached.length,
        externalCount: externalResults.length,
        offset,
      },
    });
  } catch (error) {
    console.error("Error searching Spoonacular:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_SEARCH_FAILED",
    });
  }
};

// Acquire Recipe Details
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

    // Try Firestore first
    const existing = await ExternalRecipeModel.findByExternal(
      EXTERNAL_SOURCE,
      id
    );
    if (existing) {
      const recipeFromDb = { ...existing };
      if (!includeNutrition) delete recipeFromDb.nutrition;
      return res.json({ success: true, recipe: recipeFromDb });
    }

    // Fetch from Spoonacular
    const url = new URL(
      `https://api.spoonacular.com/recipes/${encodeURIComponent(id)}/information`
    );
    url.searchParams.set("includeNutrition", includeNutrition ? "true" : "false");

    const resp = await fetch(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = await resp.json();

    const quotaLeft = resp.headers.get("x-api-quota-left");
    if (quotaLeft) res.set("x-api-quota-left", quotaLeft);

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || "Spoonacular request failed",
        code: "SPOONACULAR_ERROR",
        details: data,
      });
    }

    const rawExtended = Array.isArray(data.extendedIngredients)
      ? data.extendedIngredients
      : [];

    // Cache ingredient
    try {
      await ExternalIngredientModel.upsertManyFromExternal(
        EXTERNAL_SOURCE,
        rawExtended
      );
    } catch (ingErr) {
      console.error("Failed to persist external ingredients:", ingErr);
    }

    const simplified = {
      id: data.id,
      title: data.title,
      image: data.image,
      sourceUrl: data.sourceUrl,
      readyInMinutes: data.readyInMinutes,
      servings: data.servings,
      summary: data.summary ?? null,
      instructions: data.instructions ?? null,
      ingredientIds: rawExtended.map((ing) => ing.id).filter(Boolean),
      extendedIngredients: rawExtended.map((ing) => ({
        id: ing.id,
        name: ing.name,
        original: ing.original,
        amount: ing.amount,
        unit: ing.unit,
        image: ing.image,
      })),
      nutrition: includeNutrition ? data.nutrition : null,
      dishTypes: data.dishTypes ?? null,
      diets: data.diets ?? null,
      cuisines: data.cuisines ?? null,
    };

    // Attempts to grab external recipes
    try {
      await ExternalRecipeModel.upsertFromExternal(EXTERNAL_SOURCE, id, simplified);
    } catch (insertErr) {
      console.error("Failed to persist external recipe:", insertErr);
    }

    return res.json({ success: true, recipe: simplified });
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