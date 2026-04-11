// controllers/recipeController.js
import admin from "firebase-admin";
import axios from "axios";
import { z } from "zod";
import { _computeAndStorePriceForDoc } from "./combinedRecipeController.js";

//  Store personal recipes in their own collection
const RECIPES_COLL = "personal_recipes";
const SPOON_BASE = "https://api.spoonacular.com";

/**
 *  Zod helper: coerce "string/number" -> number (works on older Zod)
 */
const NumberFromAny = (minValue, msg) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    },
    z.number().min(minValue, msg),
  );

const OptionalNumberFromAny = (minValue, msg) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }, z.number().min(minValue, msg).optional());

/**
 * Ingredient + Recipe schemas
 */
const IngredientSchema = z.object({
  id: OptionalNumberFromAny(0, "Ingredient id must be >= 0"),
  name: z.string().min(1, "Ingredient name is required"),
  original: z.string().optional().nullable(),
  amount: NumberFromAny(0, "Amount must be >= 0"),
  unit: z.string().min(1, "Unit is required"),
  image: z.string().nullable().optional(),
});

const RecipeSchema = z.object({
  title: z.string().min(1, "Recipe title is required"),
  summary: z.string().optional().default(""),
  image: z.string().nullable().optional(),
  prepTime: NumberFromAny(0, "Prep time must not be negative"),
  cookTime: NumberFromAny(0, "Cook time must not be negative"),
  servings: NumberFromAny(1, "Total servings must be at least 1"),
  extendedIngredients: z
    .array(IngredientSchema)
    .min(1, "At least one ingredient is required"),
  instructions: z.string().min(1, "Instructions are required"),
  equipment: z.array(z.string()).optional().default([]),
});

function _constructRecipeDocument(req) {
  const body = req.body || {};
  const equipmentRaw = body.equipment;
  const equipment = Array.isArray(equipmentRaw)
    ? equipmentRaw
    : typeof equipmentRaw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(equipmentRaw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
  return {
    title: body.title ?? "",
    summary: body.summary ?? "",
    image: body.image ?? null,
    prepTime: Number(body.prepTime),
    cookTime: Number(body.cookTime),
    servings: Number(body.servings),
    extendedIngredients: JSON.parse(body.extendedIngredients),
    instructions: body.instructions ?? "",
    equipment: equipment.filter((e) => typeof e === "string" && e.trim()),
  };
}

/**
 * Upload a file buffer to Firebase Storage and return a signed download URL.
 */
async function _uploadImageToStorage(buffer, path, contentType) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);

  await file.save(buffer, { metadata: { contentType } });

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

/**
 * Delete all files under users/[uid]/recipes/[recipeId]/ in Storage.
 */
async function _deleteRecipeImageFolder(uid, recipeId) {
  const bucket = admin.storage().bucket();
  const prefix = `users/${uid}/recipes/${recipeId}/`;
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((f) => f.delete()));
}

/**
 * Build a Spoonacular ingredient line like "2 tbsp olive oil"
 */
function _toIngredientLine(ing) {
  const amt = ing?.amount ?? "";
  const unit = ing?.unit ?? "";
  const name = ing?.name ?? ing?.original ?? "";
  return `${amt} ${unit} ${name}`.trim().replace(/\s+/g, " ");
}

/**
 * Compute nutrition via Spoonacular and store on the recipe doc.
 ** Stores ONLY { nutrients: [...] } to match externalRecipeController.
 */
async function _computeAndStoreNutritionForDoc(docRef, recipe) {
  const ings = Array.isArray(recipe.extendedIngredients)
    ? recipe.extendedIngredients
    : [];
  if (ings.length === 0) {
    return {
      nutrition: null,
      calories: null,
      skipped: true,
      reason: "NO_INGREDIENTS",
    };
  }

  const ingredientLines = ings.map(_toIngredientLine).filter(Boolean);
  if (ingredientLines.length === 0) {
    return {
      nutrition: null,
      calories: null,
      skipped: true,
      reason: "BAD_INGREDIENTS",
    };
  }

  const body = {
    title: recipe.title || "Personal Recipe",
    servings: Number(recipe.servings || 1),
    ingredients: ingredientLines,
    // Spoonacular doesn't *need* instructions for nutrition; keep it safe:
    instructions: recipe.instructions || "",
  };

  console.log("[Spoonacular] POST /recipes/analyze", {
    title: body.title,
    servings: body.servings,
    ingredientsCount: ingredientLines.length,
  });

  const resp = await axios.post(`${SPOON_BASE}/recipes/analyze`, body, {
    params: { includeNutrition: true },
    headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
  });

  const rawNutrients = Array.isArray(resp.data?.nutrition?.nutrients)
    ? resp.data.nutrition.nutrients
    : [];

  const nutrients = rawNutrients.map((n) => ({
    name: n.name,
    amount: n.amount,
    unit: n.unit,
    percentOfDailyNeeds: n.percentOfDailyNeeds,
  }));

  const caloriesNutrient = nutrients.find(
    (n) => String(n?.name || "").toLowerCase() === "calories",
  );

  const calories =
    caloriesNutrient?.amount != null ? Number(caloriesNutrient.amount) : null;

  const nutrition = { nutrients };

  await docRef.update({
    nutrition,
    calories,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { nutrition, calories, skipped: false };
}

/**
 * POST /api/recipes
 * Creates a personal recipe, and (best effort) computes nutrition immediately.
 */
export const createRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    // Construct recipe document from request body
    const recipeDocument = _constructRecipeDocument(req);
    // Validate recipe document
    const validated = RecipeSchema.safeParse(recipeDocument);
    if (!validated.success) {
      const errors = validated.error?.issues?.map((i) => i.message) ?? [
        "Validation failed",
      ];
      return res.status(400).json({
        error: errors,
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }

    const recipeData = validated.data;

    const docPayload = {
      userId: uid,

      title: recipeData.title,
      summary: recipeData.summary ?? null,
      image: null,

      prepTime: Number(recipeData.prepTime),
      cookTime: Number(recipeData.cookTime),
      readyInMinutes:
        Number(recipeData.prepTime ?? 0) + Number(recipeData.cookTime ?? 0),

      servings: Number(recipeData.servings),

      extendedIngredients: recipeData.extendedIngredients.map((ing) => ({
        id: ing.id ?? null,
        name: ing.name,
        original: ing.original ?? ing.name,
        amount: Number(ing.amount ?? 0),
        unit: String(ing.unit ?? "").toLowerCase(),
        image: ing.image ?? null,
      })),

      instructions: recipeData.instructions,
      equipment: Array.isArray(recipeData.equipment)
        ? recipeData.equipment
        : [],

      nutrition: null,
      calories: null,
      price: null,

      dishTypes: [],
      diets: [],
      cuisines: [],
      reviews: [],
      reviewCount: 0,
      totalStars: 0,
      viewCount: 0,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(RECIPES_COLL).add(docPayload);
    const recipeId = docRef.id;

    // Upload image if provided
    if (req.file && req.file.buffer) {
      const ext = (req.file.originalname || "image").split(".").pop() || "jpg";
      const path = `users/${uid}/recipes/${recipeId}/thumbnail.${ext}`;

      try {
        const imageUrl = await _uploadImageToStorage(
          req.file.buffer,
          path,
          req.file.mimetype || "image/jpeg",
        );

        await docRef.update({
          image: imageUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        docPayload.image = imageUrl;
      } catch (uploadError) {
        console.error("Error uploading recipe image:", uploadError);
        return res.status(500).json({
          error:
            uploadError.message ||
            "Failed to upload image. Check FIREBASE_STORAGE_BUCKET.",
          code: "IMAGE_UPLOAD_FAILED",
        });
      }
    }

    // Auto-calc nutrition on create (best effort)
    try {
      const { nutrition, calories } = await _computeAndStoreNutritionForDoc(
        docRef,
        {
          title: docPayload.title,
          servings: docPayload.servings,
          extendedIngredients: docPayload.extendedIngredients,
          instructions: docPayload.instructions,
        },
      );
      const price = await _computeAndStorePriceForDoc(docRef, {
        extendedIngredients: docPayload.extendedIngredients,
      });

      return res.status(201).json({
        success: true,
        id: recipeId,
        message: "Recipe created successfully",
        nutrition,
        calories,
        price,
      });
    } catch (e) {
      console.warn(
        "Nutrition compute failed on create:",
        e?.response?.data || e?.message || e,
      );

      return res.status(201).json({
        success: true,
        id: recipeId,
        message: "Recipe created successfully (nutrition pending)",
      });
    }
  } catch (error) {
    console.error("Error creating recipe:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "CREATE_RECIPE_FAILED",
    });
  }
};

/**
 * GET /api/recipes
 ** Returns all recipes of the authenticated user
 */
export const getUserRecipes = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    const snap = await db
      .collection(RECIPES_COLL)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, recipes });
  } catch (error) {
    const msg = String(error?.message || "");
    const needsIndex =
      error?.code === 9 || msg.toLowerCase().includes("requires an index");

    if (needsIndex) {
      console.warn(
        "Firestore missing composite index for (userId + createdAt desc). Falling back to unordered query.",
      );

      try {
        const snap2 = await db
          .collection(RECIPES_COLL)
          .where("userId", "==", uid)
          .get();

        const recipes2 = snap2.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a?.createdAt?.toMillis?.() ?? 0;
            const tb = b?.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });

        return res.json({ success: true, recipes: recipes2 });
      } catch (fallbackErr) {
        console.error("Fallback getUserRecipes failed:", fallbackErr);
        return res.status(500).json({
          error: "Failed to fetch recipes (fallback failed)",
          code: "FETCH_RECIPES_FAILED",
        });
      }
    }

    console.error("Error fetching recipes:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "FETCH_RECIPES_FAILED",
    });
  }
};

/**
 * Get all recipes (any user) that match optional filters and optional search query.
 * Used by combined-recipes feed. Does not require auth.
 * @param {Object} filters - { budgetMin, budgetMax, limit, q }
 * @returns {Promise<Array>} Array of recipe objects (id, title, image, summary, price, calories, ...)
 */
export const getAllRecipes = async (filters = {}) => {
  const db = admin.firestore();
  const budgetMin = Number.isFinite(Number(filters.budgetMin))
    ? Number(filters.budgetMin)
    : 0;
  const budgetMax = Number.isFinite(Number(filters.budgetMax))
    ? Number(filters.budgetMax)
    : 100;
  // Limit the number of recipes to fetch between 1 and 200
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 200);
  const q = typeof filters.q === "string" ? filters.q.trim().toLowerCase() : "";
  const offset = Number.isFinite(Number(filters.offset))
    ? Number(filters.offset)
    : 0;
  const cookwareExclude = Array.isArray(filters.cookware)
    ? filters.cookware
    : [];
  const useMyCookwareOnly = Boolean(filters.useMyCookwareOnly);
  const userCookware = Array.isArray(filters.userCookware)
    ? filters.userCookware
    : [];
  const userCookwareLower = new Set(
    userCookware.map((c) => String(c).toLowerCase().trim()).filter(Boolean),
  );
  // When My cookware is on, only apply exclude for cookware the user HAS (so adding "bowl" when user doesn't have bowl does nothing extra)
  const effectiveExclude =
    useMyCookwareOnly && userCookwareLower.size > 0
      ? cookwareExclude.filter((c) =>
          userCookwareLower.has(String(c).toLowerCase().trim()),
        )
      : cookwareExclude;

  console.log("[getAllRecipes] filters:", {
    budgetMin,
    budgetMax,
    limit,
    q,
    offset,
    cookwareExclude: cookwareExclude.length,
    useMyCookwareOnly,
  });

  const fetchLimit = 200;
  // Don't orderBy viewCount - Firestore excludes docs that don't have that field, which can return 0 results
  const snap = await db
    .collection(RECIPES_COLL)
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(fetchLimit)
    .get();

  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const filtered = docs.filter((r) => {
    const price = r.price;
    if (price != null && typeof price === "number") {
      if (price < budgetMin || price > budgetMax) return false;
    }
    if (q) {
      const title = (r.title ?? "").toLowerCase();
      const summary = (r.summary ?? "").toLowerCase();
      const text = `${title} ${summary}`;
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = tokens.every((token) => text.includes(token));
      if (!matches) return false;
    }
    const equipmentRaw = Array.isArray(r.equipment)
      ? r.equipment
      : Array.isArray(r.cookware)
        ? r.cookware
        : [];
    const equipmentLower = equipmentRaw
      .map((e) => (typeof e === "string" ? e : (e && e.name) || ""))
      .filter(Boolean)
      .map((s) => String(s).toLowerCase().trim());
    if (effectiveExclude.length > 0) {
      const excludeLower = new Set(
        effectiveExclude.map((c) => String(c).toLowerCase().trim()),
      );
      if (equipmentLower.some((e) => excludeLower.has(e))) return false;
    }
    if (useMyCookwareOnly && userCookwareLower.size > 0) {
      if (equipmentLower.some((e) => !userCookwareLower.has(e))) return false;
    }
    return true;
  });

  // Sort by viewCount desc (treat missing as 0) so "most viewed first" is preserved
  filtered.sort(
    (a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0),
  );

  const sliced = filtered.slice(offset, offset + limit);
  console.log(
    "[getAllRecipes] docs from DB:",
    docs.length,
    "| after filter:",
    filtered.length,
    "| returned (slice):",
    sliced.length,
  );

  // Return a set number of recipes containing all of its information
  return sliced;
};

/**
 * GET /api/recipes/:id
 ** Returns the details of a single recipe by its ID
 ** NOTE: Requires auth, and enforces ownership.
 */
export const getRecipeById = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = db.collection(RECIPES_COLL).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    const data = snap.data();
    const recipePayload = { id: snap.id, ...data };

    // Increment view count only when the viewer is not the recipe owner (don't track own views)
    if (data.userId !== uid) {
      try {
        await docRef.update({
          viewCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (incErr) {
        console.warn("View count increment failed:", incErr?.message);
      }
      recipePayload.viewCount = (Number(data.viewCount) || 0) + 1;
    }

    return res.json({
      success: true,
      recipe: recipePayload,
    });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "FETCH_RECIPE_FAILED",
    });
  }
};

/**
 * PUT /api/recipes/:id
 * If ingredients are provided, nutrition+calories are recalculated (best effort).
 */
export const updateRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = db.collection(RECIPES_COLL).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    const existing = snap.data();

    if (existing.userId !== uid) {
      return res.status(403).json({
        error: "You don't have permission to update this recipe",
        code: "FORBIDDEN",
      });
    }

    const body = req.body || {};
    const ingredientsWereProvided = body.extendedIngredients != null;

    // Construct recipe document from request body
    const recipeDocument = _constructRecipeDocument(req);
    // Validate recipe document
    const validated = RecipeSchema.safeParse(recipeDocument);
    if (!validated.success) {
      const errors = validated.error?.issues?.map((i) => i.message) ?? [
        "Validation failed",
      ];
      return res.status(400).json({
        error: errors,
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }

    const recipeData = validated.data;

    // Image handling
    let imageUrl = existing.image ?? null;
    const removeImage =
      req.body?.removeImage === "true" || req.body?.removeImage === true;

    if (removeImage) {
      try {
        await _deleteRecipeImageFolder(uid, id);
      } catch (e) {
        console.warn("Storage cleanup on image remove:", e.message);
      }
      imageUrl = null;
    } else if (req.file && req.file.buffer) {
      try {
        await _deleteRecipeImageFolder(uid, id);
      } catch (e) {
        console.warn("Storage cleanup before replace:", e.message);
      }

      const ext = (req.file.originalname || "image").split(".").pop() || "jpg";
      const path = `users/${uid}/recipes/${id}/thumbnail.${ext}`;

      try {
        imageUrl = await _uploadImageToStorage(
          req.file.buffer,
          path,
          req.file.mimetype || "image/jpeg",
        );
      } catch (uploadError) {
        console.error("Error uploading recipe image:", uploadError);
        return res.status(500).json({
          error: uploadError.message || "Failed to upload image",
          code: "IMAGE_UPLOAD_FAILED",
        });
      }
    }

    const extendedIngredients = recipeData.extendedIngredients.map((ing) => ({
      id: ing.id ?? null,
      name: ing.name,
      original: ing.original ?? ing.name,
      amount: Number(ing.amount ?? 0),
      unit: String(ing.unit ?? "").toLowerCase(),
      image: ing.image ?? null,
    }));

    await docRef.update({
      title: recipeData.title,
      summary: recipeData.summary ?? null,
      image: imageUrl,

      prepTime: Number(recipeData.prepTime),
      cookTime: Number(recipeData.cookTime),
      readyInMinutes:
        Number(recipeData.prepTime ?? 0) + Number(recipeData.cookTime ?? 0),

      servings: Number(recipeData.servings),

      extendedIngredients,

      instructions: recipeData.instructions,
      equipment: Array.isArray(recipeData.equipment)
        ? recipeData.equipment
        : [],

      nutrition: ingredientsWereProvided ? null : (existing.nutrition ?? null),
      calories: ingredientsWereProvided ? null : (existing.calories ?? null),

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Recalculate nutrition when ingredients were provided (best effort)
    if (ingredientsWereProvided) {
      try {
        const { nutrition, calories } = await _computeAndStoreNutritionForDoc(
          docRef,
          {
            title: recipeData.title,
            servings: recipeData.servings,
            extendedIngredients,
            instructions: recipeData.instructions,
          },
        );
        const price = await _computeAndStorePriceForDoc(docRef, {
          extendedIngredients,
        });

        return res.json({
          success: true,
          message: "Recipe updated successfully",
          nutrition,
          calories,
          price,
        });
      } catch (e) {
        console.warn(
          "Nutrition compute failed on update:",
          e?.response?.data || e?.message || e,
        );
      }
    }

    return res.json({
      success: true,
      message: "Recipe updated successfully",
    });
  } catch (error) {
    console.error("Error updating recipe:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UPDATE_RECIPE_FAILED",
    });
  }
};

/**
 * DELETE /api/recipes/:id
 */
export const deleteRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = db.collection(RECIPES_COLL).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    if (doc.data().userId !== uid) {
      return res.status(403).json({
        error: "You don't have permission to delete this recipe",
        code: "FORBIDDEN",
      });
    }

    await docRef.delete();

    try {
      await _deleteRecipeImageFolder(uid, id);
    } catch (e) {
      console.warn("Storage cleanup on recipe delete:", e.message);
    }

    return res.json({
      success: true,
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "DELETE_RECIPE_FAILED",
    });
  }
};

/**
 * POST /api/recipes/:id/nutrition
 * Computes nutrition if missing (nutrition is null), unless forced via ?force=true
 */
export const computeRecipeNutrition = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  const force = String(req.query.force || "").toLowerCase() === "true";

  try {
    const docRef = db.collection(RECIPES_COLL).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res
        .status(404)
        .json({ error: "Recipe not found", code: "RECIPE_NOT_FOUND" });
    }

    const recipe = snap.data();
    if (recipe.userId !== uid) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    //  If nutrition exists and not forcing, return cached
    if (!force && recipe.nutrition) {
      return res.json({
        success: true,
        nutrition: recipe.nutrition,
        calories: recipe.calories ?? null,
        cached: true,
      });
    }

    //  Otherwise compute + store
    const { nutrition, calories, skipped, reason } =
      await _computeAndStoreNutritionForDoc(docRef, recipe);

    if (skipped) {
      return res.status(400).json({
        error:
          reason === "NO_INGREDIENTS"
            ? "Recipe has no ingredients"
            : "Ingredients were invalid/unusable",
        code: reason,
      });
    }

    return res.json({ success: true, nutrition, calories, cached: false });
  } catch (error) {
    const status = error?.response?.status || 500;
    const spoonMsg = error?.response?.data?.message;

    console.error(
      "computeRecipeNutrition error:",
      error?.response?.data || error?.message || error,
    );

    return res.status(status).json({
      error: spoonMsg || error.message || "Nutrition analysis failed",
      code: "NUTRITION_ANALYSIS_FAILED",
    });
  }
};

export const getAllPersonalRecipesForSimilarity = async (limit = 100) => {
  const db = admin.firestore();

  const snap = await db
    .collection(RECIPES_COLL)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllExternalRecipesForSimilarity = async (limit = 100) => {
  const db = admin.firestore();

  const snap = await db
    .collection("external_recipes")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
