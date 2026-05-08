// routes/spoonacular.js
import express from "express";
import {
  autocompleteIngredients,
  getIngredientInfo,
  getIngredientSubstitutes,
} from "../controllers/spoonacularController.js";

const router = express.Router();

// GET /api/spoonacular/ingredients/autocomplete?q=...
router.get("/ingredients/autocomplete", autocompleteIngredients);

// GET /api/spoonacular/ingredients/:id  -> returns possibleUnits
router.get("/ingredients/:id", getIngredientInfo);

// GET /api/spoonacular/ingredient-substitutes?ingredientId=...&ingredientName=...&amount=...&unit=...
router.get("/ingredient-substitutes", getIngredientSubstitutes);

export default router;
