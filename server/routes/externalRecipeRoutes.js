// routes/externalRecipeRoutes.js
import express from "express";
import {
  searchExternalRecipes,
  getExternalRecipeDetails,
} from "../controllers/externalRecipeController.js";

const router = express.Router();

// GET /api/external-recipes/search?q=pasta&number=10&offset=0
router.get("/search", searchExternalRecipes);

// GET /api/external-recipes/:id/details?includeNutrition=false
router.get("/:id/details", getExternalRecipeDetails);

export default router;
