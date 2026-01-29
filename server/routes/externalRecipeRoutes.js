import express from "express";
import { searchExternalRecipes } from "../controllers/externalRecipeController.js";

const router = express.Router();

// GET /api/external-recipes/search?q=pasta&number=10&offset=0
router.get("/search", searchExternalRecipes);

export default router;
