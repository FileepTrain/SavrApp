import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { addPantryItem, getUserPantry } from "../controllers/pantryController.js";
import { deletePantryItem } from "../controllers/pantryController.js";

const router = express.Router();

router.post("/", verifyToken, addPantryItem);
router.get("/", verifyToken, getUserPantry);
router.delete("/:id", verifyToken, deletePantryItem);


export default router;
