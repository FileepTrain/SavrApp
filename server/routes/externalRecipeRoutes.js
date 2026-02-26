// routes/externalRecipeRoutes.js
import express from "express";
import {
  getExternalRecipeDetails,
  getExternalRecipeFeed,
} from "../controllers/externalRecipeController.js";
import { getFilteredFeed } from "../controllers/combinedRecipeController.js";

const router = express.Router();

// Homepage Feed route
router.get("/feed", getExternalRecipeFeed);

// Search route - delegate to combined feed controller, but external-only
router.get("/search", (req, res, next) => {
  // Mark this request as external-only so the combined controller will skip personal recipes and only fetch external ones.
  req.query.externalOnly = "true";
  return getFilteredFeed(req, res, next);
});

// Details route
router.get("/:id/details", getExternalRecipeDetails);

export default router;
