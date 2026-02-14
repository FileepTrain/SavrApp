import admin from "firebase-admin";
import { z } from "zod";

// Zod schemas for validation (used for both client and server)
const IngredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
});

const RecipeSchema = z.object({
  title: z.string().min(1, "Recipe title is required"),
  summary: z.string().optional().default(""),
  image: z.string().nullable().optional(),
  prepTime: z.number().min(0, "Prep time must not be negative"),
  cookTime: z.number().min(0, "Cook time must not be negative"),
  servings: z.number().min(1, "Total servings must be at least 1"),
  ingredients: z
    .array(IngredientSchema)
    .min(1, "At least one ingredient is required"),
  instructions: z.string().min(1, "Instructions are required"),
});

/**
 * HELPER: Construct the recipe object from the request body
 */
function _constructRecipeDocument(req) {
  const body = req.body || {};
  // Multipart form data sends all fields as STRINGS; return correct types according to the schema
  return {
    title: body.title ?? "",
    summary: body.summary ?? "",
    image: body.image ?? null,
    prepTime: Number(body.prepTime),
    cookTime: Number(body.cookTime),
    servings: Number(body.servings),
    ingredients: JSON.parse(body.ingredients),
    instructions: body.instructions ?? "",
  };
}

/**
 * HELPER: Upload a file buffer to Firebase Storage and return a long-lived download URL.
 * @param {Buffer} buffer - File buffer
 * @param {string} path - Storage path (e.g. "recipes/{uid}/image.jpg")
 * @param {string} contentType - MIME type (e.g. "image/jpeg")
 * @returns {Promise<string>} Download URL
 */
async function _uploadImageToStorage(buffer, path, contentType) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType },
  });
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return signedUrl;
}

/**
 * HELPER: Delete all files under users/[uid]/recipes/[recipeId]/ in Storage.
 */
async function _deleteRecipeImageFolder(uid, recipeId) {
  const bucket = admin.storage().bucket();
  const prefix = `users/${uid}/recipes/${recipeId}/`;
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((f) => f.delete()));
}

/**
 * Create a new recipe
 * POST /api/recipes
 */
export const createRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    const recipeDocument = _constructRecipeDocument(req);
    // Validate request body
    const validationResult = RecipeSchema.safeParse(recipeDocument);
    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map(
        (issue) => issue.message,
      ) ?? ["Validation failed"];
      return res.status(400).json({
        error: errors,
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }

    const recipeData = validationResult.data;
    // Destructure the recipe document to get the ingredients list
    const { ingredients: ingredientsList, ...recipeFields } = recipeData;

    // Create each ingredient as a document in the "ingredients" collection
    const ingredientIds = [];
    const batch = db.batch();

    for (const raw of ingredientsList) {
      // Validate ingredient schema
      const parsed = IngredientSchema.safeParse(raw);
      if (!parsed.success) {
        const errors = parsed.error?.issues?.map((issue) => issue.message) ?? [
          "Invalid ingredient",
        ];
        return res.status(400).json({
          error: errors,
          code: "VALIDATION_ERROR",
        });
      }
      // Create and save each ingredient as a document
      const ingredientRef = db.collection("ingredients").doc();
      batch.set(ingredientRef, {
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ingredientIds.push(ingredientRef.id);
    }

    await batch.commit();

    // Create the recipe document with one-to-many relationship to ingredients collection
    const docRef = await db.collection("recipes").add({
      userId: uid,
      ingredients: ingredientIds,
      ...recipeFields,
      // Initialize default values
      image: null,
      dishTypes: [],
      diets: [],
      nutrition: null,
      reviews: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const recipeId = docRef.id; // Use recipe ID for storage path

    // Upload image to users/[userId]/recipes/[recipeId]/thumbnail.[ext] and update recipe
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
      } catch (uploadError) {
        console.error("Error uploading recipe image to Storage:", uploadError);
        return res.status(500).json({
          error:
            uploadError.message ||
            "Failed to upload image. Check FIREBASE_STORAGE_BUCKET and that the bucket exists in Firebase Console.",
          code: "IMAGE_UPLOAD_FAILED",
        });
      }
    }

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Recipe created successfully",
    });
  } catch (error) {
    console.error("Error creating recipe:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "CREATE_RECIPE_FAILED",
    });
  }
};

/**
 * Get all recipes for the user
 * GET /api/recipes
 */
export const getUserRecipes = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    const snapshot = await db
      .collection("recipes")
      .where("userId", "==", uid)
      .get();

    const recipes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by createdAt descending
    recipes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });

    // Fetch ingredients for all recipes
    const recipesWithIngredients = await Promise.all(
      recipes.map(async (recipe) => {
        if (
          recipe.ingredients &&
          Array.isArray(recipe.ingredients) &&
          recipe.ingredients.length > 0
        ) {
          const ingredientPromises = recipe.ingredients.map((ingredientId) =>
            db.collection("ingredients").doc(ingredientId).get(),
          );
          const ingredientDocs = await Promise.all(ingredientPromises);

          recipe.ingredients = ingredientDocs
            .map((doc) => {
              if (!doc.exists) {
                return null;
              }
              return {
                id: doc.id,
                ...doc.data(),
              };
            })
            .filter((ingredient) => ingredient !== null);
        } else {
          recipe.ingredients = [];
        }
        return recipe;
      }),
    );

    res.json({
      success: true,
      recipes: recipesWithIngredients,
    });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "FETCH_RECIPES_FAILED",
    });
  }
};

/**
 * Get a single recipe by ID
 * GET /api/recipes/:id
 */
export const getRecipeById = async (req, res) => {
  const db = admin.firestore();
  const { id } = req.params;

  try {
    const docRef = await db.collection("recipes").doc(id).get();

    if (!docRef.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    const recipeData = docRef.data();
    const recipe = {
      id: docRef.id, // Recipe ID
      ...recipeData,
    };

    // Fetch ingredients if recipe has ingredient IDs
    if (
      recipeData.ingredients &&
      Array.isArray(recipeData.ingredients) &&
      recipeData.ingredients.length > 0
    ) {
      const ingredientPromises = recipeData.ingredients.map((ingredientId) =>
        db.collection("ingredients").doc(ingredientId).get(),
      );
      const ingredientDocs = await Promise.all(ingredientPromises);

      recipe.ingredients = ingredientDocs
        .map((doc) => {
          if (!doc.exists) {
            return null;
          }
          return {
            id: doc.id, // Ingredient ID
            ...doc.data(),
          };
        })
        .filter((ingredient) => ingredient !== null);
    } else {
      recipe.ingredients = [];
    }

    res.json({
      success: true,
      recipe,
    });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "FETCH_RECIPE_FAILED",
    });
  }
};

/**
 * Update an existing recipe
 * PUT /api/recipes/:id
 */
export const updateRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = db.collection("recipes").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    // Check ownership
    if (doc.data().userId !== uid) {
      return res.status(403).json({
        error: "You don't have permission to update this recipe",
        code: "FORBIDDEN",
      });
    }

    // Build recipe from body (multipart sends strings; JSON sends typed values)
    const recipeDocument =
      req.file || typeof req.body?.ingredients === "string"
        ? _constructRecipeDocument(req)
        : req.body;

    // Validate request body
    const validationResult = RecipeSchema.safeParse(recipeDocument);
    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map(
        (issue) => issue.message,
      ) ?? ["Validation failed"];
      return res.status(400).json({
        error: errors,
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }

    const recipeData = validationResult.data;
    // Destructure the recipe document to get the ingredients list
    const { ingredients: ingredientsList, ...recipeFields } = recipeData;

    // Resolve new image URL: remove, replace, or keep existing
    let imageUrl = doc.data().image ?? null;
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
        console.error("Error uploading recipe image to Storage:", uploadError);
        return res.status(500).json({
          error: "Failed to upload image",
          code: "IMAGE_UPLOAD_FAILED",
        });
      }
    }

    // Delete old ingredient documents
    const oldIngredientIds = doc.data().ingredients || [];
    if (oldIngredientIds.length > 0) {
      const batch = db.batch();
      for (const ingredientId of oldIngredientIds) {
        batch.delete(db.collection("ingredients").doc(ingredientId));
      }
      await batch.commit();
    }

    // Create new ingredient documents
    const ingredientIds = [];
    const batch = db.batch();
    for (const raw of ingredientsList) {
      const parsed = IngredientSchema.safeParse(raw);
      if (!parsed.success) {
        const errors = parsed.error?.issues?.map((issue) => issue.message) ?? [
          "Invalid ingredient",
        ];
        return res.status(400).json({
          error: errors,
          code: "VALIDATION_ERROR",
        });
      }
      const ingredientRef = db.collection("ingredients").doc();
      batch.set(ingredientRef, {
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ingredientIds.push(ingredientRef.id);
    }
    await batch.commit();

    // Update the recipe document
    await docRef.update({
      ...recipeFields,
      image: imageUrl,
      ingredients: ingredientIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Recipe updated successfully",
    });
  } catch (error) {
    console.error("Error updating recipe:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UPDATE_RECIPE_FAILED",
    });
  }
};

/**
 * Delete a recipe
 * DELETE /api/recipes/:id
 */
export const deleteRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { id } = req.params;

  try {
    const docRef = db.collection("recipes").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Recipe not found",
        code: "RECIPE_NOT_FOUND",
      });
    }

    // Check ownership
    if (doc.data().userId !== uid) {
      return res.status(403).json({
        error: "You don't have permission to delete this recipe",
        code: "FORBIDDEN",
      });
    }

    await docRef.delete();

    // Remove recipe image(s) from Storage
    try {
      await _deleteRecipeImageFolder(uid, id);
    } catch (e) {
      console.warn("Storage cleanup on recipe delete:", e.message);
    }

    res.json({
      success: true,
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "DELETE_RECIPE_FAILED",
    });
  }
};
