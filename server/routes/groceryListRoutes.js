import express from "express";
import { getGroceryList, addItemToGroceryList, removeItemFromGroceryList, updateGroceryListItem, clearGroceryList, calculateGroceryListPrice } from "../controllers/groceryListController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Get user's grocery list, or create one if it doesn't exist
router.get("/", verifyToken, getGroceryList);
// Add item to grocery list
router.post("/items", verifyToken, addItemToGroceryList);
// Remove item from grocery list
router.delete("/items/:itemId", verifyToken, removeItemFromGroceryList);
// update item from grocery list
router.patch("/items/:itemId", verifyToken, updateGroceryListItem);
// Remove all items from grocery list
router.delete("/", verifyToken, clearGroceryList);
// Calculate estimated cost of grocery list
router.get("/price", verifyToken, calculateGroceryListPrice)
export default router;