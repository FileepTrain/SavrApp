import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  checkUsername,
  register,
  login,
  updateAccount,
  deleteAccount,
  updateFavorites,
  getFavorites,
  getPreferences,
  updatePreferences,
  listRecipeCollections,
  createRecipeCollection,
  getRecipeCollection,
  updateRecipeCollection,
  deleteRecipeCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  followRecipeCollection,
  unfollowRecipeCollection,
  listFollowedRecipeCollections,
  getFollowCollectionStatus,
  oauthLogin,
} from "../controllers/authController.js";
import { uploadProfileImage } from "../middleware/multer.js";
import {
  getUserProfile,
  updateProfilePrivacy,
  uploadProfilePhoto,
  getPublicCollection,
} from "../controllers/userProfileController.js";

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

// Public-style profile (authenticated viewers; respects privacy)
router.get("/users/:userId/profile", verifyToken, getUserProfile);
router.get(
  "/users/:ownerUid/collections/:collectionId/public",
  verifyToken,
  getPublicCollection,
);
router.put("/profile-privacy", verifyToken, updateProfilePrivacy);
router.post("/profile-photo", verifyToken, uploadProfileImage, uploadProfilePhoto);

// GET /api/auth/get-favorites - Get array of favorite recipes
router.get("/get-favorites", verifyToken, getFavorites);

// Recipe collections (boards)
router.get("/collections", verifyToken, listRecipeCollections);
router.post("/collections", verifyToken, createRecipeCollection);
router.get("/collections/:collectionId", verifyToken, getRecipeCollection);
router.patch("/collections/:collectionId", verifyToken, updateRecipeCollection);
router.delete("/collections/:collectionId", verifyToken, deleteRecipeCollection);
router.post("/collections/:collectionId/recipes", verifyToken, addRecipeToCollection);
router.delete(
  "/collections/:collectionId/recipes/:recipeId",
  verifyToken,
  removeRecipeFromCollection,
);

router.get("/followed-collections/status", verifyToken, getFollowCollectionStatus);
router.get("/followed-collections", verifyToken, listFollowedRecipeCollections);
router.post("/followed-collections", verifyToken, followRecipeCollection);
router.delete(
  "/followed-collections/:ownerUid/:collectionId",
  verifyToken,
  unfollowRecipeCollection,
);

// GET /api/auth/get-preferences - Get user preferences (query: fields=cookware,diets,... or all)
router.get("/get-preferences", verifyToken, getPreferences);

// PUT /api/auth/update-preferences - Update user preferences (partial body OK)
router.put("/update-preferences", verifyToken, updatePreferences);

// DELETE /api/auth/delete-account - Delete user account
router.delete("/delete-account", verifyToken, deleteAccount);

// OAuth
router.post("/oauth-login", verifyToken, oauthLogin);

export default router;
