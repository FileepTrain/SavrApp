import express from "express";
import { getFilteredFeed } from "../controllers/combinedRecipeController.js";

const router = express.Router();

router.get("/", getFilteredFeed);

export default router;
