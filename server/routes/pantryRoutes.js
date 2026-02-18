import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { addPantryItem, getUserPantry } from "../controllers/pantryController.js";
import { deletePantryItem } from "../controllers/pantryController.js";

const router = express.Router();

// Pantry routes to add items to user's pantry
router.post("/", verifyToken, addPantryItem);

// Pantry routes to get items from user's pantry
router.get("/", verifyToken, getUserPantry);

// Pantry routes to delete items from user's pantry
router.delete("/:id", verifyToken, deletePantryItem);


export default router;