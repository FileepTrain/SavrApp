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
 * Create a new recipe
 * POST /api/recipes
 */
export const createRecipe = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    // Validate request body
    const validationResult = RecipeSchema.safeParse(req.body);

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

    // Destructure ingredients list from rest of recipe data
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
      userId: uid, // User that created the recipe
      ...recipeFields,
      ingredients: ingredientIds, // Array of ingredient IDs
      // Initialize default values
      diets: [],
      dishTypes: [],
      nutrition: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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

    // Validate request body
    const validationResult = RecipeSchema.safeParse(req.body);

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
    const { ingredients: ingredientsList, ...recipeFields } = recipeData;

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
