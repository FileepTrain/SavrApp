import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  checkUsername,
  register,
  login,
  updateAccount,
  updateFavorites,
  getFavorites,
  updateCookware,
  getCookware,
  deleteAccount,
  getAllergies,
  updateAllergies,
  getDiets,
  updateDiets,
  getBudget,
  updateBudget,
} from "../controllers/authController.js";

const router = express.Router();

// POST /api/auth/check-username - Check if username is available
router.post("/check-username", checkUsername);

// POST /api/auth/register - Register a new user
router.post("/register", register);

// POST /api/auth/login - Login user
router.post("/login", login);

// PUT /api/auth/update-account - Update user account
router.put("/update-account", verifyToken, updateAccount);

// PUT /api/auth/update-favorites - Update user favorites
router.put("/update-favorites", verifyToken, updateFavorites);

// GET /api/auth/get-favorites - Get array of favorite recipes
router.get("/get-favorites", verifyToken, getFavorites);

// PUT /api/auth/update-cookware - Update user cookware preferences
router.put("/update-cookware", verifyToken, updateCookware);

// GET /api/auth/get-cookware - Get user cookware preferences
router.get("/get-cookware", verifyToken, getCookware);

// DELETE /api/auth/delete-account - Delete user account
router.delete("/delete-account", verifyToken, deleteAccount);

// GET /api/auth/get-allergies - Get array of user allergies
router.get("/get-allergies", verifyToken, getAllergies);

// PUT /api/auth/update-allergies - Update array of user allergies
router.put("/update-allergies", verifyToken, updateAllergies);

// GET /api/auth/get-diets - Get array of user diets
router.get("/get-diets", verifyToken, getDiets);

// PUT /api/auth/update-allergies - Update array of user diets
router.put("/update-diets", verifyToken, updateDiets);

// GET /api/auth/get-budget - Get user budget
router.get("/get-budget", verifyToken, getBudget);

// PUT /api/auth/update-budget - Update user budget
router.put("/update-budget", verifyToken, updateBudget);

export default router;
