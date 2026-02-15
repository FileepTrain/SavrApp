// controllers/externalRecipeController.js
import ExternalRecipeModel from "../models/externalRecipeModel.js";

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

    // 1) Search cached recipes in Firestore first
    const cached = await ExternalRecipeModel.searchCachedByTitle(
      EXTERNAL_SOURCE,
      q,
      number
    );

    // If cached fills the page, return without hitting Spoonacular
    if (cached.length >= number) {
      return res.json({
        success: true,
        results: cached,
        totalResults: cached.length,
        _meta: { cachedCount: cached.length, externalCount: 0, offset },
      });
    }

    // 2) Need more -> query Spoonacular for remaining slots
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

    // 3) Merge cached + external results (avoid duplicates)
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

    // 1) Try Firestore first
    const existing = await ExternalRecipeModel.findByExternal(
      EXTERNAL_SOURCE,
      id
    );

    // If we have it cached AND either:
    // - nutrition is not requested, OR
    // - nutrition is requested AND we already have nutrients cached
    if (existing) {
      const hasCachedNutrients =
        Array.isArray(existing?.nutrition?.nutrients) &&
        existing.nutrition.nutrients.length > 0;

      if (!includeNutrition || hasCachedNutrients) {
        const recipeFromDb = { ...existing };
        if (!includeNutrition) delete recipeFromDb.nutrition;
        return res.json({ success: true, recipe: recipeFromDb });
      }
      // else: fall through and fetch from Spoonacular with nutrition=true
    }

    // 2) Fetch from Spoonacular
    // ✅ Always fetch with includeNutrition=true so we can store nutrients in DB
    const url = new URL(
      `https://api.spoonacular.com/recipes/${encodeURIComponent(id)}/information`
    );
    url.searchParams.set("includeNutrition", "true");

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

    // ✅ keep ONLY the nutrients array
    const nutrients = Array.isArray(data?.nutrition?.nutrients)
      ? data.nutrition.nutrients.map((n) => ({
          name: n.name,
          amount: n.amount,
          unit: n.unit,
          percentOfDailyNeeds: n.percentOfDailyNeeds,
        }))
      : [];

    // Simplify the object we store and return
    const simplified = {
      id: data.id,
      title: data.title,
      image: data.image,
      sourceUrl: data.sourceUrl,
      readyInMinutes: data.readyInMinutes,
      servings: data.servings,
      summary: data.summary ?? null,
      instructions: data.instructions ?? null,

      // keep ingredient list as-is (no extra caching)
      extendedIngredients: (data.extendedIngredients ?? []).map((ing) => ({
        id: ing.id,
        name: ing.name,
        original: ing.original,
        amount: ing.amount,
        unit: ing.unit,
        image: ing.image,
      })),

      // ✅ only store nutrients
      nutrition: { nutrients },

      dishTypes: data.dishTypes ?? null,
      diets: data.diets ?? null,
      cuisines: data.cuisines ?? null,
    };

    // 3) Persist to Firestore (upsert)
    try {
      await ExternalRecipeModel.upsertFromExternal(EXTERNAL_SOURCE, id, simplified);
    } catch (insertErr) {
      console.error("Failed to persist external recipe:", insertErr);
    }

    // 4) Return based on includeNutrition flag
    if (!includeNutrition) {
      const out = { ...simplified };
      delete out.nutrition;
      return res.json({ success: true, recipe: out });
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
