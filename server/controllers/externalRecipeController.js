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

    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("query", q);
    url.searchParams.set("number", String(number));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("addRecipeInformation", "false");
    url.searchParams.set("instructionsRequired", "true");

    const resp = await fetch(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = await resp.json();

    // Forward quota headers if present
    const quotaLeft = resp.headers.get("x-api-quota-left");
    if (quotaLeft) res.set("x-api-quota-left", quotaLeft);

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || "Spoonacular request failed",
        code: "SPOONACULAR_ERROR",
        details: data,
      });
    }

    return res.json({ success: true, ...data });
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
    const existing = await ExternalRecipeModel.findByExternal(EXTERNAL_SOURCE, id);
    if (existing) {
      const recipeFromDb = { ...existing };
      if (!includeNutrition) delete recipeFromDb.nutrition;
      return res.json({ success: true, recipe: recipeFromDb });
    }

    // 2) Not in DB -> fetch from Spoonacular
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

    // Simplify to the Spoonacular-shaped object we want to store and return.
    // This matches what your frontend expects from the earlier code.
    const simplified = {
      id: data.id,
      title: data.title,
      image: data.image,
      sourceUrl: data.sourceUrl,
      readyInMinutes: data.readyInMinutes,
      servings: data.servings,
      summary: data.summary ?? null,
      instructions: data.instructions ?? null,
      extendedIngredients: (data.extendedIngredients ?? []).map((ing) => ({
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

    // 3) Persist to Firestore (upsert)
    try {
      await ExternalRecipeModel.upsertFromExternal(EXTERNAL_SOURCE, id, simplified);
    } catch (insertErr) {
      // Log but don't block returning the recipe to the client
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
