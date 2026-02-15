// routes/spoonacular.js
import express from "express";
import { autocompleteIngredients, getIngredientInfo } from "../controllers/spoonacularController.js";

const router = express.Router();

// GET /api/spoonacular/ingredients/autocomplete?q=...
router.get("/ingredients/autocomplete", autocompleteIngredients);

// GET /api/spoonacular/ingredients/:id  -> returns possibleUnits
router.get("/ingredients/:id", getIngredientInfo);

export default router;
