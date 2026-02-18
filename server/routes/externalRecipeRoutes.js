// routes/externalRecipeRoutes.js
import express from "express";
import {
  searchExternalRecipes,
  getExternalRecipeDetails,
  getExternalRecipeFeed,
} from "../controllers/externalRecipeController.js";

const router = express.Router();

// Homepage Feed route
router.get("/feed", getExternalRecipeFeed);

// Search route
router.get("/search", searchExternalRecipes);

// Details route
router.get("/:id/details", getExternalRecipeDetails);

export default router;