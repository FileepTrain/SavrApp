import express from "express";
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
router.put("/update-account", updateAccount);

// DELETE /api/auth/delete-account - Delete user account
router.delete("/delete-account", deleteAccount);

export default router;
