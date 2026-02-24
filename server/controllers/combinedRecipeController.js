/**
 * Combined recipe controller
 * Simplifies user-generated recipes and external recipes into a unified feed
 */

import { getAllRecipes } from "./recipeController.js";

/**
 * GET /api/combined-recipes
 * Optional query params: budgetMin, budgetMax, limit, q (search query)
 * Returns personal recipes (any user) that match the budget filter and optional search text.
 */
export const getFilteredFeed = async (req, res) => {
  try {
    // Rely on query params or default values
    const budgetMin = Number.isFinite(Number(req.query.budgetMin))
      ? Number(req.query.budgetMin)
      : 0;
    const budgetMax = Number.isFinite(Number(req.query.budgetMax))
      ? Number(req.query.budgetMax)
      : 100;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filters = { budgetMin, budgetMax, limit, q };
    const recipes = await getAllRecipes(filters);

    const results = recipes.map((r) => {
      const calories =
        r.calories != null
          ? r.calories
          : Array.isArray(r.nutrition?.nutrients)
            ? Math.round(
                Number(
                  r.nutrition.nutrients.find((n) => n?.name === "Calories")
                    ?.amount ?? 0,
                ),
              ) || null
            : null;
      return {
        id: r.id,
        title: r.title ?? null,
        image: r.image ?? null,
        calories: calories ?? undefined,
      };
    });

    return res.json({ success: true, results, totalCount: results.length });
  } catch (error) {
    console.error("Error getting combined recipe feed:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "COMBINED_FEED_FAILED",
    });
  }
};
