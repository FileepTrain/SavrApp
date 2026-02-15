// controllers/recipeController.js
import admin from "firebase-admin";
import axios from "axios";
import { z } from "zod";

// ✅ Store personal recipes in their own collection
const RECIPES_COLL = "personal_recipes";
const SPOON_BASE = "https://api.spoonacular.com";

/**
 * ✅ Zod helper: coerce "string/number" -> number (works on older Zod)
 */
const NumberFromAny = (minValue, msg) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    },
    z.number().min(minValue, msg)
  );

const OptionalNumberFromAny = (minValue, msg) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    },
    z.number().min(minValue, msg).optional()
  );

/**
 * ✅ Ingredient + Recipe schemas
 * IMPORTANT: normalized storage shape in Firestore: extendedIngredients[]
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
});

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
 * Parse either:
 * - extendedIngredients (new schema shape)
 * - OR ingredients (older client shape: { name, quantity, unit })
 *
 * Accepts array or JSON string.
 */
function _parseAnyIngredients(rawExtended, rawIngredients) {
  const raw = rawExtended ?? rawIngredients;
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Normalize mixed ingredient shapes into extendedIngredients shape.
 * Supports:
 *  - { id, name, original, amount, unit, image }   (extended ingredient)
 *  - { name, quantity, unit }                      (old ingredient)
 */
function _normalizeToExtendedIngredients(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((x) => {
      if (!x) return null;

      // new shape (extended)
      if (x.name && (x.amount !== undefined || x.unit !== undefined)) {
        return {
          id: x.id ?? null,
          name: String(x.name),
          original: x.original ?? x.name ?? null,
          amount: x.amount ?? 0,
          unit: String(x.unit ?? ""),
          image: x.image ?? null,
        };
      }

      // old shape (ingredients)
      if (x.name && (x.quantity !== undefined || x.unit !== undefined)) {
        return {
          id: null,
          name: String(x.name),
          original: String(x.name),
          amount: x.quantity ?? 0,
          unit: String(x.unit ?? ""),
          image: null,
        };
      }

      return null;
    })
    .filter(Boolean);
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
 *
 * ✅ Stores ONLY { nutrients: [...] } to match externalRecipeController.
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
    (n) => String(n?.name || "").toLowerCase() === "calories"
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
    const body = req.body || {};

    const rawList = _parseAnyIngredients(body.extendedIngredients, body.ingredients);
    const normalized = _normalizeToExtendedIngredients(rawList);

    const incoming = {
      title: body.title ?? "",
      summary: body.summary ?? "",
      image: body.image ?? null,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      servings: body.servings,
      extendedIngredients: normalized,
      instructions: body.instructions ?? "",
    };

    const validated = RecipeSchema.safeParse(incoming);
    if (!validated.success) {
      const errors =
        validated.error?.issues?.map((i) => i.message) ?? ["Validation failed"];
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

      // ✅ FIX: actually store instructions on create
      instructions: recipeData.instructions,

      nutrition: null,
      calories: null,

      dishTypes: [],
      diets: [],
      cuisines: [],
      reviews: [],

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
          req.file.mimetype || "image/jpeg"
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

    // ✅ Auto-calc nutrition on create (best effort)
    try {
      const { nutrition, calories } = await _computeAndStoreNutritionForDoc(
        docRef,
        {
          title: docPayload.title,
          servings: docPayload.servings,
          extendedIngredients: docPayload.extendedIngredients,
          instructions: docPayload.instructions,
        }
      );

      return res.status(201).json({
        success: true,
        id: recipeId,
        message: "Recipe created successfully",
        nutrition,
        calories,
      });
    } catch (e) {
      console.warn(
        "Nutrition compute failed on create:",
        e?.response?.data || e?.message || e
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
        "Firestore missing composite index for (userId + createdAt desc). Falling back to unordered query."
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
 * GET /api/recipes/:id
 * NOTE: Requires auth, and enforces ownership.
 */
export const getRecipeById = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = await db.collection(RECIPES_COLL).doc(id).get();

    if (!docRef.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    const data = docRef.data();
    if (data?.userId !== uid) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    return res.json({
      success: true,
      recipe: { id: docRef.id, ...data },
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
 * If ingredients are provided, nutrition+calories are invalidated (set to null).
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
    const ingredientsWereProvided =
      body.extendedIngredients != null || body.ingredients != null;

    const rawList = ingredientsWereProvided
      ? _parseAnyIngredients(body.extendedIngredients, body.ingredients)
      : null;

    const normalized =
      rawList !== null
        ? _normalizeToExtendedIngredients(rawList)
        : existing.extendedIngredients ?? [];

    const incoming = {
      title: body.title ?? existing.title ?? "",
      summary: body.summary ?? existing.summary ?? "",
      image: body.image ?? existing.image ?? null,
      prepTime: body.prepTime ?? existing.prepTime ?? 0,
      cookTime: body.cookTime ?? existing.cookTime ?? 0,
      servings: body.servings ?? existing.servings ?? 1,
      extendedIngredients: normalized,
      instructions: body.instructions ?? existing.instructions ?? "",
    };

    const validated = RecipeSchema.safeParse(incoming);
    if (!validated.success) {
      const errors =
        validated.error?.issues?.map((i) => i.message) ?? ["Validation failed"];
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
      body?.removeImage === "true" || body?.removeImage === true;

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
          req.file.mimetype || "image/jpeg"
        );
      } catch (uploadError) {
        console.error("Error uploading recipe image:", uploadError);
        return res.status(500).json({
          error: uploadError.message || "Failed to upload image",
          code: "IMAGE_UPLOAD_FAILED",
        });
      }
    }

    await docRef.update({
      title: recipeData.title,
      summary: recipeData.summary ?? null,
      image: imageUrl,

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

      nutrition: ingredientsWereProvided ? null : existing.nutrition ?? null,
      calories: ingredientsWereProvided ? null : existing.calories ?? null,

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
 * ✅ POST /api/recipes/:id/nutrition
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

    // ✅ If nutrition exists and not forcing, return cached
    if (!force && recipe.nutrition) {
      return res.json({
        success: true,
        nutrition: recipe.nutrition,
        calories: recipe.calories ?? null,
        cached: true,
      });
    }

    // ✅ Otherwise compute + store
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
      error?.response?.data || error?.message || error
    );

    return res.status(status).json({
      error: spoonMsg || error.message || "Nutrition analysis failed",
      code: "NUTRITION_ANALYSIS_FAILED",
    });
  }
};
