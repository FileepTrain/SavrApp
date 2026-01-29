import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  checkUsername,
  register,
  login,
  updateAccount,
  deleteAccount,
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

// DELETE /api/auth/delete-account - Delete user account
router.delete("/delete-account", verifyToken, deleteAccount);

export default router;
