import express from "express";
import { getIngredientsByIds } from "../controllers/ingredientController.js";

const router = express.Router();

// POST /api/ingredients/batch - Get ingredients by IDs
router.post("/batch", getIngredientsByIds);

export default router;
