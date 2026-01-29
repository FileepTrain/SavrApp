import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createRecipe,
  getUserRecipes,
  getRecipeById,
  deleteRecipe,
} from "../controllers/recipeController.js";

const router = express.Router();

// POST /api/recipes - Create a new recipe
router.post("/", verifyToken, createRecipe);

// GET /api/recipes - Get all recipes for the authenticated user
router.get("/", verifyToken, getUserRecipes);

// GET /api/recipes/:id - Get a single recipe by ID
router.get("/:id", getRecipeById);

// DELETE /api/recipes/:id - Delete a recipe
router.delete("/:id", verifyToken, deleteRecipe);

export default router;
