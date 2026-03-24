import express from "express";
import {
  getFilteredFeed,
  getSimilarRecipes,
} from "../controllers/combinedRecipeController.js";

const router = express.Router();

router.get("/", getFilteredFeed);

router.get("/similar/:recipeId", getSimilarRecipes);

export default router;