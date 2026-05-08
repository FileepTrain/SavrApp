// routes/mealPlanRoutes.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createMealPlan,
  getMealPlan,
  getMealPlanById,
  updateMealPlan,
  deleteMealPlan,
  patchMealPlanHabitDay,
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

// PATCH /api/meal-plans/:planId/habit-day — toggle / set followedPlan for one calendar day
router.patch("/:planId/habit-day", verifyToken, patchMealPlanHabitDay);

// DELETE /api/meal-plans/:planId
router.delete("/:planId", verifyToken, deleteMealPlan);

export default router;