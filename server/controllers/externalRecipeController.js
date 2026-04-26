// controllers/externalRecipeController.js
import ExternalRecipeModel from "../models/externalRecipeModel.js";
import { _computePriceForRecipe } from "./combinedRecipeController.js";

// Whitelist of Spoonacular-supported intolerance values (all lowercase)
const SPOONACULAR_INTOLERANCES = new Set([
  "dairy",
  "egg",
  "gluten",
  "grain",
  "peanut",
  "seafood",
  "sesame",
  "shellfish",
  "soy",
  "sulfite",
  "tree nut",
  "wheat",
]);

/**
 * Normalize allergy values (coming from the client) into
 * Spoonacular-compatible intolerance strings.
 *
 * Accepts an array of strings or a comma-separated string.
 */
function normalizeAllergiesToIntolerances(allergiesValue) {
  const rawList = Array.isArray(allergiesValue)
    ? allergiesValue
    : typeof allergiesValue === "string"
      ? allergiesValue.split(",")
      : [];

  const seen = new Set();
  const result = [];

  for (const item of rawList) {
    if (!item) continue;
    let v = String(item).toLowerCase().trim();
    if (!v) continue;

    if (SPOONACULAR_INTOLERANCES.has(v) && !seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }

  return result;
}

function equipmentNamesFromDoc(equipment) {
  const arr = Array.isArray(equipment) ? equipment : [];
  return arr
    .map((e) => (typeof e === "string" ? e : (e && e.name) || ""))
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());
}

/**
 * Returns true if the recipe satisfies meal-plan auto filters (budget, cookware, diets, known allergy flags).
 * Recipes missing optional fields stay eligible where logic mirrors the external feed (e.g. unknown price).
 */
function recipePassesMealPlanAutoFilters(recipe, parsed) {
  if (!recipe || typeof recipe !== "object") return false;

  const budgetMin = parsed.budgetMin;
  const budgetMax = parsed.budgetMax;
  if (
    Number.isFinite(budgetMin) &&
    Number.isFinite(budgetMax) &&
    budgetMin <= budgetMax
  ) {
    const price = recipe.price;
    if (typeof price === "number" && (price < budgetMin || price > budgetMax)) return false;
  }

  const intolerances = parsed.allergyIntolerances;
  if (intolerances && intolerances.size > 0) {
    for (const t of intolerances) {
      if (t === "gluten" || t === "wheat" || t === "grain") {
        if (recipe.glutenFree === false) return false;
      } else if (t === "dairy") {
        if (recipe.dairyFree === false) return false;
      }
      // No reliable cached flags for egg, peanut, shellfish, etc.; do not exclude.
    }
  }

  const excludeCookware = parsed.excludeCookwareLower;
  if (excludeCookware && excludeCookware.size > 0) {
    const names = equipmentNamesFromDoc(recipe.equipment);
    if (names.some((n) => excludeCookware.has(n))) return false;
  }

  const userCookwareSet = parsed.userCookwareSet;
  if (userCookwareSet && userCookwareSet.size > 0) {
    const names = equipmentNamesFromDoc(recipe.equipment);
    if (names.length > 0 && names.some((n) => !userCookwareSet.has(n))) return false;
  }

  const foodTypes = parsed.foodTypesLower;
  if (foodTypes && foodTypes.length > 0) {
    const dietsSet = new Set(
      (Array.isArray(recipe.diets) ? recipe.diets : [])
        .map((d) => String(d).toLowerCase().trim())
        .filter(Boolean),
    );
    for (const ft of foodTypes) {
      if (!ft) continue;
      let ok = false;
      if (ft === "vegan" && recipe.vegan === true) ok = true;
      else if (ft === "vegetarian" && (recipe.vegetarian === true || recipe.vegan === true)) {
        ok = true;
      } else if (
        (ft === "gluten free" || ft === "glutenfree") &&
        recipe.glutenFree === true
      ) {
        ok = true;
      } else if (dietsSet.has(ft)) ok = true;
      if (!ok) return false;
    }
  }

  return true;
}

/**
 * Filter cached external recipe rows before auto meal-plan slot picking.
 * @param {object[]} recipes
 * @param {object} filters - budgetMin, budgetMax, allergies (array|string), cookware (array|string), useMyCookwareOnly, userCookware (array|string), foodTypes (array|string)
 */
export function filterRecipesForAutoMealPlan(recipes, filters) {
  if (!Array.isArray(recipes)) return [];

  const budgetMin = Number.isFinite(Number(filters?.budgetMin))
    ? Number(filters.budgetMin)
    : 0;
  const budgetMax = Number.isFinite(Number(filters?.budgetMax))
    ? Number(filters.budgetMax)
    : 100;

  const allergyList = normalizeAllergiesToIntolerances(filters?.allergies);
  const allergyIntolerances = new Set(allergyList);

  const cookwareRaw = Array.isArray(filters?.cookware)
    ? filters.cookware
    : typeof filters?.cookware === "string"
      ? filters.cookware.split(",")
      : [];
  const useMyCookwareOnly = Boolean(filters?.useMyCookwareOnly);
  const userCookwareRaw = Array.isArray(filters?.userCookware)
    ? filters.userCookware
    : typeof filters?.userCookware === "string"
      ? filters.userCookware.split(",")
      : [];

  const userCookwareSet =
    useMyCookwareOnly && userCookwareRaw.length > 0
      ? new Set(
          userCookwareRaw.map((c) => String(c).toLowerCase().trim()).filter(Boolean),
        )
      : null;

  const effectiveExclude = userCookwareSet
    ? cookwareRaw.filter((c) =>
        userCookwareSet.has(String(c).toLowerCase().trim()),
      )
    : cookwareRaw;
  const excludeCookwareLower = new Set(
    effectiveExclude.map((c) => String(c).toLowerCase().trim()).filter(Boolean),
  );

  const foodTypesRaw = Array.isArray(filters?.foodTypes)
    ? filters.foodTypes
    : typeof filters?.foodTypes === "string"
      ? filters.foodTypes.split(",")
      : [];
  const foodTypesLower = foodTypesRaw
    .map((s) => String(s).toLowerCase().trim())
    .filter(Boolean);

  const parsed = {
    budgetMin,
    budgetMax,
    allergyIntolerances,
    excludeCookwareLower,
    userCookwareSet,
    foodTypesLower,
  };

  return recipes.filter((r) => recipePassesMealPlanAutoFilters(r, parsed));
}

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
    glutenFree: typeof data.glutenFree === "boolean" ? data.glutenFree : null,
    dairyFree: typeof data.dairyFree === "boolean" ? data.dairyFree : null,
    vegan: typeof data.vegan === "boolean" ? data.vegan : null,
    vegetarian: typeof data.vegetarian === "boolean" ? data.vegetarian : null,
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
  const intolerances = normalizeAllergiesToIntolerances(filters?.allergies);

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
  if (intolerances.length > 0) { //could have multiple at once
    url.searchParams.set("intolerances", intolerances.join(","));
  }

  console.log("[Spoonacular] GET /recipes/complexSearch", { query: q, number, offset: safeOffset, intolerances: intolerances.join(",") || undefined,});

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

function toDishTypeSet(value) {
  //using a set so each recipe is unique and no duplicates
  return new Set(
    (Array.isArray(value) ? value : [])
      .map((s) => String(s).toLowerCase().trim())
      .filter(Boolean),
  );
}

/** Weights for auto meal plan pantry fit (tweak-friendly). */
const PANTRY_SCORE_WEIGHT_MATCH_RATIO = 0.8;
const PANTRY_SCORE_WEIGHT_MISSING = 0.2;

function normalizePantryNamesFromQuery(req) {
  const raw = req.query?.pantry;
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function extendedIngredientDisplayName(ing) {
  if (!ing || typeof ing !== "object") return "";
  const n = ing.name ?? ing.original ?? "";
  return String(n).toLowerCase().trim();
}

/**
 * Simple pantry ↔ ingredient match (substring / token overlap).
 * @param {string} ingLower normalized ingredient text
 * @param {string[]} pantryLower non-empty pantry strings (lowercase)
 */
function ingredientMatchesPantry(ingLower, pantryLower) {
  if (!ingLower) return false;
  for (const p of pantryLower) {
    if (!p || p.length < 2) continue;
    if (ingLower.includes(p) || p.includes(ingLower)) return true;
    const pTokens = p.split(/\s+/).filter((t) => t.length >= 3);
    for (const t of pTokens) {
      if (ingLower.includes(t)) return true;
    }
  }
  return false;
}

/**
 * Weighted score: higher = more pantry overlap, fewer missing ingredients.
 * score = (match/total)*w1 + (1/(missing+1))*w2
 */
function scoreRecipePantryFit(recipe, pantryNamesLower) {
  if (!pantryNamesLower || pantryNamesLower.length === 0) return 0;
  const ingredients = Array.isArray(recipe?.extendedIngredients)
    ? recipe.extendedIngredients
    : [];
  const names = ingredients
    .map((ing) => extendedIngredientDisplayName(ing))
    .filter(Boolean);
  const total = names.length;
  if (total === 0) return 0;
  let match = 0;
  for (const ing of names) {
    if (ingredientMatchesPantry(ing, pantryNamesLower)) match += 1;
  }
  const missing = total - match;
  return (
    (match / total) * PANTRY_SCORE_WEIGHT_MATCH_RATIO +
    (1 / (missing + 1)) * PANTRY_SCORE_WEIGHT_MISSING
  );
}

function pickBestByPantryScore(pool, pantryLower) {
  if (pool.length === 0) return null;
  let bestScore = -Infinity;
  const ties = [];
  for (const r of pool) {
    const s = scoreRecipePantryFit(r, pantryLower);
    if (s > bestScore) {
      bestScore = s;
      ties.length = 0;
      ties.push(r);
    } else if (s === bestScore) {
      ties.push(r);
    }
  }
  if (ties.length === 0) return pool[0];
  return ties[Math.floor(Math.random() * ties.length)];
}

//this determines what recipes are chosen and how
function pickRecipeForSlot(
  candidates,
  slotDishTypes,
  usedIds,
  calorieRange = null,
  pantryPick = null,
) {
  const prioritizePantry =
    Boolean(pantryPick?.enabled) &&
    Array.isArray(pantryPick.namesLower) &&
    pantryPick.namesLower.length > 0;

  const slotSet = new Set(slotDishTypes.map((s) => String(s).toLowerCase().trim()));
  const unique = candidates.filter((r) => !usedIds.has(String(r.id)));
  if (unique.length === 0) return null;

  const directMatches = unique.filter((r) => {
    const recipeSet = toDishTypeSet(r.dishTypes);
    for (const dishType of slotSet) {
      if (recipeSet.has(dishType)) return true;
    }
    return false;
  });

  let pool = directMatches.length > 0 ? directMatches : unique;

  // prefer recipes whose calories fall in the selected range (per meal)
  if (
    calorieRange &&
    Number.isFinite(calorieRange.min) &&
    Number.isFinite(calorieRange.max) &&
    calorieRange.min <= calorieRange.max
  ) {
    const { min, max } = calorieRange;
    const inRange = pool.filter((r) => {
      const c = r.calories;
      return typeof c === "number" && Number.isFinite(c) && c >= min && c <= max;
    });
    if (inRange.length > 0) {
      pool = inRange;
    }
    // If none match the range, keep the unfiltered pool so we still return a pick
  }

  if (prioritizePantry) {
    return pickBestByPantryScore(pool, pantryPick.namesLower);
  }

  //keep top 10, those recipes usually fit range. If pool is too big you get weird picks
  const TOP_N = 10;
  const trimmedPool = pool.slice(0, TOP_N);
  //randomly choose from top ten
  const randomIndex = Math.floor(Math.random() * trimmedPool.length);
  return trimmedPool[randomIndex] ?? null;
}

function servingsAsPlanDays(recipe) {
  const n = Number(recipe?.servings);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * Picks multiple recipes for one slot until we roughly reach targetDays.
 * Keeps global uniqueness via `usedIds` so meals don't repeat the same recipe.
 */
function pickRecipesForSlot(
  candidates,
  slotDishTypes,
  usedIds,
  calorieRange,
  pantryPick,
  targetDays,
  maxRecipesPerSlot,
) {
  const picked = [];
  const cap = Math.max(1, Math.floor(Number(maxRecipesPerSlot) || 4));
  while (picked.length < cap) {
    const pick = pickRecipeForSlot(
      candidates,
      slotDishTypes,
      usedIds,
      calorieRange,
      pantryPick,
    );
    if (!pick) break;
    picked.push(pick);
    usedIds.add(String(pick.id));
  }

  if (picked.length === 0) return [];

  const safeTargetDays = Math.max(1, Math.floor(Number(targetDays) || 30));
  const baseServingsList = picked.map((r) => servingsAsPlanDays(r));
  const recipeCount = picked.length;

  // Aim for similar day coverage per recipe, not one global multiplier.
  // High-serving recipes usually stay at 1 batch; low-serving recipes get repeated more.
  const desiredPerRecipeDays = Math.max(1, Math.floor(safeTargetDays / recipeCount));
  const batchByIdx = baseServingsList.map((base) =>
    Math.max(1, Math.floor(desiredPerRecipeDays / Math.max(1, base))),
  );
  const targetByIdx = baseServingsList.map((base, i) => base * batchByIdx[i]);

  let total = targetByIdx.reduce((sum, days) => sum + days, 0);
  const guardMax = 200;
  let guard = 0;
  while (total < safeTargetDays && guard < guardMax) {
    // Add coverage to the recipe currently contributing the least days.
    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < targetByIdx.length; i++) {
      const score = targetByIdx[i];
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    batchByIdx[bestIdx] += 1;
    targetByIdx[bestIdx] += baseServingsList[bestIdx];
    total += baseServingsList[bestIdx];
    guard += 1;
  }

  return picked.map((r, i) => ({
    ...r,
    autoBaseServings: baseServingsList[i],
    autoBatchMultiplier: batchByIdx[i],
    autoTargetServings: targetByIdx[i],
  }));
}

// Builds a meal plan from cached external recipes, searches by dishTypes
export const getAutoMealPlanByDishTypes = async (req, res) => {
  try {
    const EXTERNAL_SOURCE = "spoonacular";
    //Some dishes don't have a meal type, they're excluded unless we manually give them one
    //also not all dish types accounted for
    const SLOT_DISH_TYPES = {
      breakfast: ["breakfast"],
      lunch: ["lunch", "main course", "antipasti", "antipasto"],
      dinner: ["dinner", "main course", "antipasti", "antipasto"],
    };

    const budgetMin = Number.isFinite(Number(req.query.budgetMin))
      ? Number(req.query.budgetMin)
      : 0;
    const budgetMax = Number.isFinite(Number(req.query.budgetMax))
      ? Number(req.query.budgetMax)
      : 100;
    const allergies =
      typeof req.query.allergies === "string"
        ? req.query.allergies.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(req.query.allergies)
          ? req.query.allergies.map((s) => String(s).trim()).filter(Boolean)
          : [];
    const cookwareExclude =
      typeof req.query.cookware === "string"
        ? req.query.cookware.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const useMyCookwareOnly =
      String(req.query.useMyCookwareOnly ?? "false").toLowerCase() === "true";
    const userCookwareRaw =
      typeof req.query.userCookware === "string" ? req.query.userCookware : "";
    const userCookware = userCookwareRaw
      ? userCookwareRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const foodTypes =
      typeof req.query.foodTypes === "string"
        ? req.query.foodTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(req.query.foodTypes)
          ? req.query.foodTypes.map((s) => String(s).trim()).filter(Boolean)
          : [];

    const prioritizePantry =
      String(req.query.prioritizePantry ?? "false").toLowerCase() === "true";
    const pantryRaw = normalizePantryNamesFromQuery(req);
    const pantryNamesLower = prioritizePantry
      ? pantryRaw.map((s) => String(s).toLowerCase().trim()).filter((s) => s.length >= 1)
      : [];
    const pantryPick = {
      enabled: prioritizePantry && pantryNamesLower.length > 0,
      namesLower: pantryNamesLower,
    };

    const mealPlanFilters = {
      budgetMin,
      budgetMax,
      allergies,
      cookware: cookwareExclude,
      useMyCookwareOnly,
      userCookware,
      foodTypes,
    };

    const hasMealPlanFilters =
      (budgetMin > 0 || budgetMax < 100) ||
      allergies.length > 0 ||
      cookwareExclude.length > 0 ||
      useMyCookwareOnly ||
      foodTypes.length > 0;

    const fetchLimit = hasMealPlanFilters ? 100 : 50;

    const [breakfastCandidates, lunchCandidates, dinnerCandidates] = await Promise.all([
      ExternalRecipeModel.searchCachedByDishTypes(
        EXTERNAL_SOURCE,
        SLOT_DISH_TYPES.breakfast,
        fetchLimit,
      ),
      ExternalRecipeModel.searchCachedByDishTypes(
        EXTERNAL_SOURCE,
        SLOT_DISH_TYPES.lunch,
        fetchLimit,
      ),
      ExternalRecipeModel.searchCachedByDishTypes(
        EXTERNAL_SOURCE,
        SLOT_DISH_TYPES.dinner,
        fetchLimit,
      ),
    ]);

    const breakfastFiltered = filterRecipesForAutoMealPlan(
      breakfastCandidates,
      mealPlanFilters,
    );
    const lunchFiltered = filterRecipesForAutoMealPlan(
      lunchCandidates,
      mealPlanFilters,
    );
    const dinnerFiltered = filterRecipesForAutoMealPlan(
      dinnerCandidates,
      mealPlanFilters,
    );

    const qMin = Number(req.query.calorieMin);
    const qMax = Number(req.query.calorieMax);
    const calorieRange =
      Number.isFinite(qMin) && Number.isFinite(qMax) && qMin <= qMax
        ? { min: qMin, max: qMax }
        : null;
    const qTargetDays = Number(req.query.targetDays);
    const targetDays =
      Number.isFinite(qTargetDays) && qTargetDays >= 7
        ? Math.min(Math.floor(qTargetDays), 60)
        : 30;
    const qMaxRecipesPerMeal = Number(req.query.maxRecipesPerMeal);
    const maxRecipesPerMeal =
      Number.isFinite(qMaxRecipesPerMeal) && qMaxRecipesPerMeal >= 1
        ? Math.min(Math.floor(qMaxRecipesPerMeal), 10)
        : 4;

    const usedIds = new Set();
    const breakfast = pickRecipesForSlot(
      breakfastFiltered,
      SLOT_DISH_TYPES.breakfast,
      usedIds,
      calorieRange,
      pantryPick,
      targetDays,
      maxRecipesPerMeal,
    );
    const lunch = pickRecipesForSlot(
      lunchFiltered,
      SLOT_DISH_TYPES.lunch,
      usedIds,
      calorieRange,
      pantryPick,
      targetDays,
      maxRecipesPerMeal,
    );
    const dinner = pickRecipesForSlot(
      dinnerFiltered,
      SLOT_DISH_TYPES.dinner,
      usedIds,
      calorieRange,
      pantryPick,
      targetDays,
      maxRecipesPerMeal,
    );

    const slimMealRecipe = (r) => {
      if (!r || typeof r !== "object") return r;
      const {
        extendedIngredients: _omit,
        reviewsLength: _r,
        viewCount: _v,
        ...rest
      } = r;
      return rest;
    };

    return res.json({
      success: true,
      meals: {
        breakfast: breakfast.map(slimMealRecipe),
        lunch: lunch.map(slimMealRecipe),
        dinner: dinner.map(slimMealRecipe),
      },
      meta: {
        source: "external-cache",
        slotDishTypes: SLOT_DISH_TYPES,
        calorieRange,
        mealPlanFilters,
        candidateCounts: {
          breakfast: {
            before: breakfastCandidates.length,
            after: breakfastFiltered.length,
          },
          lunch: { before: lunchCandidates.length, after: lunchFiltered.length },
          dinner: {
            before: dinnerCandidates.length,
            after: dinnerFiltered.length,
          },
        },
        prioritizePantry: pantryPick.enabled,
        pantryItemCount: pantryRaw.length,
        targetDays,
        maxRecipesPerMeal,
        generatedDaysBySlot: {
          breakfast: breakfast.reduce(
            (sum, r) => sum + Number(r?.autoTargetServings ?? servingsAsPlanDays(r)),
            0,
          ),
          lunch: lunch.reduce(
            (sum, r) => sum + Number(r?.autoTargetServings ?? servingsAsPlanDays(r)),
            0,
          ),
          dinner: dinner.reduce(
            (sum, r) => sum + Number(r?.autoTargetServings ?? servingsAsPlanDays(r)),
            0,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error generating auto meal plan from dishTypes:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "AUTO_MEAL_PLAN_BY_DISH_TYPES_FAILED",
    });
  }
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

// Pulls cached recipe from Firestore; optionally filters by budget, cookware, and My cookware
export const getExternalRecipeFeed = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 50);
    const budgetMin = Number.isFinite(Number(req.query.budgetMin)) ? Number(req.query.budgetMin) : 0;
    const budgetMax = Number.isFinite(Number(req.query.budgetMax)) ? Number(req.query.budgetMax) : 100;
    const cookwareExclude = typeof req.query.cookware === "string"
      ? req.query.cookware.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const useMyCookwareOnly = String(req.query.useMyCookwareOnly ?? "false").toLowerCase() === "true";
    const userCookwareRaw = typeof req.query.userCookware === "string" ? req.query.userCookware : "";
    const userCookware = userCookwareRaw ? userCookwareRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const userCookwareSet = useMyCookwareOnly && userCookware.length > 0
      ? new Set(userCookware.map((c) => String(c).toLowerCase().trim()))
      : null;
    // When My cookware is on, only exclude cookware the user HAS (no double effect)
    const effectiveExclude = userCookwareSet
      ? cookwareExclude.filter((c) => userCookwareSet.has(String(c).toLowerCase().trim()))
      : cookwareExclude;

    const fetchLimit = budgetMin > 0 || budgetMax < 100 || effectiveExclude.length > 0 || userCookwareSet
      ? Math.min(limit * 5, 100)
      : limit;
    let results = await ExternalRecipeModel.getLatestCached(fetchLimit);
    const viewCount = (r) => (r && Number.isFinite(Number(r.viewCount)) ? Number(r.viewCount) : 0);
    results.sort((a, b) => viewCount(b) - viewCount(a) || (Number(a.id) - Number(b.id)));
    if (budgetMin > 0 || budgetMax < 100) {
      results = results.filter((r) => {
        const price = r.price;
        if (price == null || typeof price !== "number") return true;
        return price >= budgetMin && price <= budgetMax;
      });
    }
    if (effectiveExclude.length > 0) {
      const excludeSet = new Set(effectiveExclude.map((c) => String(c).toLowerCase().trim()));
      results = results.filter((r) => {
        const names = equipmentNamesFromDoc(r.equipment);
        return !names.some((n) => excludeSet.has(n));
      });
    }
    if (userCookwareSet) {
      results = results.filter((r) => {
        const names = equipmentNamesFromDoc(r.equipment);
        if (names.length === 0) return true;
        return names.every((n) => userCookwareSet.has(n));
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
