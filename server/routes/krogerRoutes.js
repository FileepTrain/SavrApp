import express from "express";
import { getQuickLocation, getPrice, getPriceBatch } from "../controllers/krogerController.js";

const router = express.Router();

// GET /api/kroger/quick-location - Find the nearest Kroger store based on ZIP code
router.get("/quick-location", getQuickLocation);

// GET /api/kroger/price - Look up product pricing and unit cost information
router.get("/price", getPrice);
// GET /api/kroger/price/batch
router.get("/price/batch", getPriceBatch);

export default router;