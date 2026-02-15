// routes/recipeRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { uploadRecipeImage } from "../middleware/multer.js";
import {
  createRecipe,
  getUserRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  computeRecipeNutrition,
} from "../controllers/recipeController.js";

const router = express.Router();

// POST /api/recipes - Create a new recipe (accepts JSON or multipart with optional image)
router.post("/", verifyToken, uploadRecipeImage, createRecipe);

// GET /api/recipes - Get all recipes for the authenticated user
router.get("/", verifyToken, getUserRecipes);

// GET /api/recipes/:id - Get a single recipe by ID (must be authed to avoid leaking recipes)
router.get("/:id", verifyToken, getRecipeById);

// PUT /api/recipes/:id - Update a recipe (accepts JSON or multipart with optional image)
router.put("/:id", verifyToken, uploadRecipeImage, updateRecipe);

// DELETE /api/recipes/:id - Delete a recipe
router.delete("/:id", verifyToken, deleteRecipe);

// POST /api/recipes/:id/nutrition - Computes nutrition if missing (or force via ?force=true)
router.post("/:id/nutrition", verifyToken, computeRecipeNutrition);

export default router;
