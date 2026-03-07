/**
 * Combined recipe controller
 * Simplifies user-generated recipes and external recipes into a unified feed
 * Contains similar, shared logic for price calculation, store lookup, etc.
 */

import admin from "firebase-admin";
import axios from "axios";
import { getAllRecipes } from "./recipeController.js";
import { fetchPriceForTerm, getAccessToken } from "./krogerController.js";
import { searchExternalRecipes } from "./externalRecipeController.js";

const KROGER_API_BASE = process.env.KROGER_API_BASE;

/**
 * Compute price and write it to the given doc. Used when the doc already exists (e.g. user recipes).
 */
export async function _computeAndStorePriceForDoc(docRef, recipe) {
  const finalPrice = await _computePriceForRecipe(recipe);
  if (finalPrice == null) return null;
  await docRef.update({
    price: finalPrice,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return finalPrice;
}

/**
 * Compute recipe price from extended ingredients (Kroger lookup). Does not write to Firestore.
 * Used when building payloads so price can be stored in a single upsert.
 */
export async function _computePriceForRecipe(recipe) {
  try {
    const locationId = await _getStoreIdForRecipe("90713");
    if (!locationId) return null;

    const ingredientNames = (recipe.extendedIngredients || [])
      .map((ing) => ing.name)
      .filter(Boolean);

    if (ingredientNames.length === 0) return null;

    const results = await Promise.all(
      ingredientNames.map((name) =>
        fetchPriceForTerm(name, locationId, 5, "median", false),
      ),
    );

    let total = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ingredient = recipe.extendedIngredients[i];
      const quantity = Number(ingredient?.amount || 1);
      if (typeof r?.unitCost === "number") {
        total += r.unitCost * quantity;
      } else if (typeof r?.rawPrice === "number") {
        total += r.rawPrice;
      }
    }
    return Number(total.toFixed(2));
  } catch (err) {
    console.warn("Kroger price calculation failed:", err.message);
    return null;
  }
}

/**
 * Pull store ID used for ingredient price lookup.
 */
async function _getStoreIdForRecipe(zip = "90713") {
  try {
    const token = await getAccessToken();
    const resp = await axios.get(`${KROGER_API_BASE}/locations`, {
      params: {
        "filter.zipCode.near": zip,
        "filter.limit": 1,
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    const stores = resp.data?.data || [];
    return stores.length > 0 ? stores[0].locationId : null;
  } catch (err) {
    console.error("Kroger store lookup failed:", err.message);
    return null;
  }
}

/**
 * GET /api/combined-recipes
 * Optional query params: budgetMin, budgetMax, limit, q (search query)
 * Returns:
 * - personalResults: user recipes matching filters/search
 * - externalResults: external recipes (Spoonacular) in the same simplified shape
 * - results: combined list (personal first, then external) for backward compatibility
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
    const externalOnly =
      String(req.query.externalOnly ?? "false").toLowerCase() === "true";

    const personalOffset = Number.isFinite(Number(req.query.personalOffset))
      ? Number(req.query.personalOffset)
      : 0;
    const externalOffset = Number.isFinite(Number(req.query.externalOffset))
      ? Number(req.query.externalOffset)
      : Number.isFinite(Number(req.query.offset))
        ? Number(req.query.offset)
        : 0;

    const filters = { budgetMin, budgetMax, limit, q };

    let personalResults = [];
    let remaining = limit;
    let personalRequested = 0;
    let personalExhausted = false;
    if (!externalOnly && remaining > 0) {
      personalRequested = remaining;
      const recipes = await getAllRecipes({
        ...filters,
        offset: personalOffset,
      });
      personalResults = recipes.map((r) => {
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
        const count = Number.isFinite(Number(r.reviewCount)) ? Number(r.reviewCount) : (Array.isArray(r.reviews) ? r.reviews.length : 0);
        const totalStars = Number.isFinite(Number(r.totalStars)) ? Number(r.totalStars) : (Array.isArray(r.reviews) ? r.reviews.reduce((s, rev) => s + (rev?.rating ?? 0), 0) : 0);
        const rating = count > 0 ? Math.round((totalStars / count) * 10) / 10 : 0;
        const viewCount = Number.isFinite(Number(r.viewCount)) ? Number(r.viewCount) : 0;
        return {
          id: r.id,
          title: r.title ?? null,
          image: r.image ?? null,
          calories: calories ?? undefined,
          price: typeof r.price === "number" ? r.price : null,
          rating,
          reviewsLength: count,
          viewCount,
        };
      });
      if (personalResults.length < personalRequested) {
        personalExhausted = true;
      }
      remaining = Math.max(remaining - personalResults.length, 0);
    }

    // External results (only when searching with q)
    let externalResults = [];
    let externalMeta = null;
    let externalTotalResults = null;
    if (remaining > 0 && (q || externalOnly)) {
      const externalRecipes = await searchExternalRecipes({
        filters,
        limit: remaining,
        offset: String(externalOffset),
      });
      externalResults = Array.isArray(externalRecipes?.results)
        ? externalRecipes.results
        : [];
      externalMeta = externalRecipes?._meta ?? null;
      externalTotalResults =
        typeof externalRecipes?.totalResults === "number"
          ? externalRecipes.totalResults
          : null;
    }

    // Merge and sort by view count (most viewed first); ensure every item has viewCount for sort
    const combined = [...personalResults, ...externalResults].map((r) => ({
      ...r,
      viewCount: Number(r.viewCount) || 0,
    }));
    combined.sort((a, b) => b.viewCount - a.viewCount);

    return res.json({
      success: true,
      results: combined,
      personalResults,
      externalResults,
      totalCount: combined.length,
      externalMeta,
      meta: {
        limit,
        personalOffset,
        externalOffset,
        personalReturned: personalResults.length,
        externalReturned: externalResults.length,
        personalExhausted: externalOnly ? true : personalExhausted,
        externalTotalResults,
      },
    });
  } catch (error) {
    console.error("Error getting combined recipe feed:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "COMBINED_FEED_FAILED",
    });
  }
};
