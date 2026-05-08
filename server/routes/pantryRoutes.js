import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  addPantryItem,
  getUserPantry,
  deletePantryItem,
  updatePantryItem,
  lookupPantryItemByBarcode,
  getBarcodeScanHistory,
  clearBarcodeScanHistory,
} from "../controllers/pantryController.js";

const router = express.Router();

// Barcode scan history routes
router.get("/barcode-history", verifyToken, getBarcodeScanHistory);
router.delete("/barcode-history", verifyToken, clearBarcodeScanHistory);

// Pantry route for barcode
router.get("/barcode/:upc", verifyToken, lookupPantryItemByBarcode);

// Pantry routes to add items to user's pantry
router.post("/", verifyToken, addPantryItem);

// Pantry routes to get items from user's pantry
router.get("/", verifyToken, getUserPantry);

// Pantry routes to update items from user's pantry
router.put("/:id", verifyToken, updatePantryItem);

// Pantry routes to delete items from user's pantry
router.delete("/:id", verifyToken, deletePantryItem);

export default router;