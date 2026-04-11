// routes/mealPlanRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createMealPlan,
  getMealPlan,
  getMealPlanById,
  updateMealPlan,
  deleteMealPlan,
} from "../controllers/mealPlanController.js";

const router = express.Router();

// POST /api/meal-plans - Create a meal plan
router.post("/", verifyToken, createMealPlan);

// GET /api/meal-plans - Get meal plans for the current user
router.get("/", verifyToken, getMealPlan);

// GET /api/meal-plans/:planId
router.get("/:planId", verifyToken, getMealPlanById);

// PUT /api/meal-plans/:planId
router.put("/:planId", verifyToken, updateMealPlan);

// DELETE /api/meal-plans/:planId
router.delete("/:planId", verifyToken, deleteMealPlan);

export default router;