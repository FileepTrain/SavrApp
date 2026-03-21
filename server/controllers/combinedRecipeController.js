/**
 * Combined recipe controller
 * Simplifies user-generated recipes and external recipes into a unified feed
 * Contains similar, shared logic for price calculation, store lookup, etc.
 */

import admin from "firebase-admin";
import axios from "axios";
import {
  getAllRecipes,
  getAllPersonalRecipesForSimilarity,
  getAllExternalRecipesForSimilarity,
} from "./recipeController.js";
import { searchExternalRecipes } from "./externalRecipeController.js";
import { fetchPriceForTerm, getAccessToken } from "./krogerController.js";
import ExternalRecipeModel from "../models/externalRecipeModel.js";

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
    // Log full search request so you can debug / replay in terminal
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("[combined-recipes] Full URL:", fullUrl);
    console.log("[combined-recipes] Query params:", JSON.stringify(req.query, null, 2));

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
    const personalOnly =
      String(req.query.personalOnly ?? "false").toLowerCase() === "true";

    const personalOffset = Number.isFinite(Number(req.query.personalOffset))
      ? Number(req.query.personalOffset)
      : 0;
    const externalOffset = Number.isFinite(Number(req.query.externalOffset))
      ? Number(req.query.externalOffset)
      : Number.isFinite(Number(req.query.offset))
        ? Number(req.query.offset)
        : 0;

    const cookwareExclude = typeof req.query.cookware === "string"
      ? req.query.cookware.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const useMyCookwareOnly = String(req.query.useMyCookwareOnly ?? "false").toLowerCase() === "true";
    const userCookwareRaw = typeof req.query.userCookware === "string" ? req.query.userCookware : "";
    const userCookware = userCookwareRaw ? userCookwareRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const allergies =
      typeof req.query.allergies === "string"
        ? req.query.allergies.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(req.query.allergies)
          ? req.query.allergies.map((s) => String(s).trim()).filter(Boolean)
          : [];

    const filters = { budgetMin, budgetMax, limit, q, cookware: cookwareExclude, useMyCookwareOnly, userCookware, allergies }

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
        let calories = r.calories != null ? r.calories : null;
        if (calories == null && Array.isArray(r.nutrition?.nutrients)) {
          const cal = r.nutrition.nutrients.find((n) => String(n?.name || "").toLowerCase() === "calories");
          if (cal?.amount != null) calories = Math.round(Number(cal.amount));
        }
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

    // External results from cached external_recipes collection (no Spoonacular API call)
    let externalResults = [];
    let externalMeta = null;
    let externalTotalResults = null;
    if (!personalOnly && (q || externalOnly)) {
      const EXTERNAL_SOURCE = "spoonacular";
      const cached = await ExternalRecipeModel.searchCachedForFeed(
        EXTERNAL_SOURCE,
        q,
        limit,
        externalOffset,
        budgetMin,
        budgetMax,
        cookwareExclude,
        useMyCookwareOnly ? userCookware : null,
      );
      externalResults = Array.isArray(cached?.results) ? cached.results : [];
      externalMeta = cached?._meta ?? null;
      externalTotalResults =
        typeof cached?.totalResults === "number" ? cached.totalResults : externalResults.length;

      // Fallback to live Spoonacular search when cache has no matches.
      if (externalResults.length === 0 && q) {
        const live = await searchExternalRecipes({
          filters,
          limit,
          offset: externalOffset,
        });

        externalResults = Array.isArray(live?.results) ? live.results : [];
        externalMeta = {
          ...(externalMeta || {}),
          ...(live?._meta || {}),
          source: "spoonacular-live-fallback",
        };
        externalTotalResults =
          typeof live?.totalResults === "number" ? live.totalResults : externalResults.length;
      }
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

// Determine Similar Recipe in Firestore
function isExternalFirestoreRecipeId(id) {
  return String(id).startsWith("spoonacular_");
}

// Grabs the raw recipe id
function isRawExternalRecipeId(id) {
  return /^\d+$/.test(String(id));
}

// Makes text easier to read
function normalizeText(text = "") {
  return String(text).trim().toLowerCase();
}

// Tokenizes text into words
function tokenize(text = "") {
  return normalizeText(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("s") && word.length > 1) return word.slice(0, -1);
      return word;
    });
}

// Grab ingredients from recipe to compare
function getIngredientNames(recipe) {
  return (recipe?.extendedIngredients || [])
    .map((ing) => normalizeText(ing.name))
    .filter(Boolean)
    .map((word) => {
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("s") && word.length > 1) return word.slice(0, -1);
      return word;
    });
}

// Rate the recipes based on similarity
function getSimilarityScore(currentRecipe, candidateRecipe) {
  const currentIngredients = getIngredientNames(currentRecipe);
  const candidateIngredients = getIngredientNames(candidateRecipe);
  const currentIngredientSet = new Set(currentIngredients);
  const candidateIngredientSet = new Set(candidateIngredients);
  let ingredientOverlap = 0;
  for (const ing of candidateIngredientSet) {
    if (currentIngredientSet.has(ing)) {
      ingredientOverlap++;
    }
  }
  const currentWords = new Set([
    ...tokenize(currentRecipe?.title),
    ...tokenize(currentRecipe?.summary),
  ]);
  const candidateWords = new Set([
    ...tokenize(candidateRecipe?.title),
    ...tokenize(candidateRecipe?.summary),
  ]);
  let textOverlap = 0;
  for (const word of candidateWords) {
    if (currentWords.has(word)) {
      textOverlap++;
    }
  }
  const strongIngredientBonus = ingredientOverlap >= 2 ? 3 : 0;
  const titleWordBonus =
    tokenize(candidateRecipe?.title).some((word) => currentWords.has(word)) ? 2 : 0;
  return ingredientOverlap * 4 + textOverlap + strongIngredientBonus + titleWordBonus;
}

// Get similar recipes from Firestore
export const getSimilarRecipes = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 10);

    let doc;

    if (isExternalFirestoreRecipeId(recipeId)) {
      doc = await admin
        .firestore()
        .collection("external_recipes")
        .doc(recipeId)
        .get();
    } else if (!isRawExternalRecipeId(recipeId)) {
      doc = await admin
        .firestore()
        .collection("personal_recipes")
        .doc(recipeId)
        .get();
    } else {
      return res.status(400).json({
        error: "Raw numeric Spoonacular IDs are not supported for similar recipes yet",
        code: "UNSUPPORTED_RECIPE_TYPE",
      });
    }
    if (!doc.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    const currentRecipe = { id: doc.id, ...doc.data() };
    const personalCandidates = await getAllPersonalRecipesForSimilarity(100);
    const externalCandidates = await getAllExternalRecipesForSimilarity(100);
    const candidates = [...personalCandidates, ...externalCandidates];
    const ranked = candidates
      .filter((recipe) => String(recipe.id) !== String(recipeId))
      .map((recipe) => {
        const similarityScore = getSimilarityScore(currentRecipe, recipe);
        return {
          id: recipe.id,
          title: recipe.title ?? null,
          image: recipe.image ?? null,
          calories: recipe.calories ?? null,
          similarityScore,
        };
      })
      .filter((recipe) => recipe.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    return res.json({
      success: true,
      recipeId,
      results: ranked,
    });
  } catch (error) {
    console.error("Error getting similar recipes:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "SIMILAR_RECIPES_FAILED",
    });
  }
};