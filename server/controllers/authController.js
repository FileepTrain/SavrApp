import admin from "firebase-admin";
import axios from "axios";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

/**
 * Check if a username is available
 * POST /api/auth/check-username
 */
export const checkUsername = async (req, res) => {
  const { username } = req.body;
  const db = admin.firestore();

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const usernameDoc = await db.collection("usernames").doc(username).get();
    return res.json({ available: !usernameDoc.exists });
  } catch (error) {
    console.error("Error checking username:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UNKNOWN_ERROR",
    });
  }
};

/**
 * Register a new user account
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  const { email, password, username } = req.body;
  const db = admin.firestore();

  if (!email || !password || !username) {
    return res.status(400).json({
      error: "Email, password, and username are required",
      code: "MISSING_FIELDS",
    });
  }

  let uid = null;

  try {
    // 1) Check if username is already taken
    const usernameDocRef = db.collection("usernames").doc(username);
    const usernameDoc = await usernameDocRef.get();

    if (usernameDoc.exists) {
      return res.status(400).json({
        error: "Username is already taken",
        code: "USERNAME_TAKEN",
      });
    }

    // 2) Create auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });

    uid = userRecord.uid;

    const batch = db.batch();

    // 3) Store in users
    batch.set(db.collection("users").doc(uid), {
      email,
      username,
      onboarding: false, // legacy flag
      onboarded: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4) Store username -> uid mapping
    batch.set(usernameDocRef, {
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return res.status(201).json({
      success: true,
      uid,
      message: "User created successfully",
    });
  } catch (error) {
    // Optional rollback if auth user was created but Firestore failed
    if (uid) {
      try {
        await admin.auth().deleteUser(uid);
      } catch (rollbackErr) {
        console.error("Rollback failed (deleteUser):", rollbackErr);
      }
    }

    console.error("Error creating user:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    const db = admin.firestore();
    const firebaseResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true },
    );

    const { idToken, refreshToken, localId, displayName } =
      firebaseResponse.data;

    const userDoc = await db.collection("users").doc(localId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return res.json({
      success: true,
      uid: localId,
      idToken,
      refreshToken,
      email,
      username: displayName,
      onboarded: userData.onboarded,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error logging in:", error.response?.data || error.message);
    const fbError = error.response?.data?.error?.message || "LOGIN_FAILED";

    return res.status(400).json({
      error: fbError,
      code: fbError,
    });
  }
};

/**
 * Update user account
 * PUT /api/auth/update-account
 * Protected by verifyToken middleware (Authorization header)
 */
export const updateAccount = async (req, res) => {
  // uid comes from middleware now
  const uid = req.user?.uid;

  // allowed changes
  const { email, password, username } = req.body;

  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const db = admin.firestore();

    // Load current user doc
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User data not found",
        code: "USER_NOT_FOUND",
      });
    }

    const currentUsername = userDoc.data().username;

    // If username changing, ensure availability
    if (username && username !== currentUsername) {
      const usernameDoc = await db.collection("usernames").doc(username).get();
      if (usernameDoc.exists) {
        return res.status(400).json({
          error: "Username is already taken",
          code: "USERNAME_TAKEN",
        });
      }
    }

    // Update Firebase Auth
    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (username) updateData.displayName = username;

    // Only call updateUser if there is something to update
    if (Object.keys(updateData).length > 0) {
      await admin.auth().updateUser(uid, updateData);
    }

    // Update Firestore user doc (DO NOT overwrite createdAt)
    const firestoreUpdate = {};
    if (email) firestoreUpdate.email = email;
    if (username) firestoreUpdate.username = username;

    if (Object.keys(firestoreUpdate).length > 0) {
      firestoreUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await userDocRef.set(firestoreUpdate, { merge: true });
    }

    // Update usernames mapping if username changed
    if (username && username !== currentUsername) {
      const batch = db.batch();

      batch.delete(db.collection("usernames").doc(currentUsername));
      batch.set(db.collection("usernames").doc(username), {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }

    return res.json({
      success: true,
      uid,
      message: "Account updated successfully",
    });
  } catch (error) {
    console.error("Error updating account:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "UPDATE_FAILED",
    });
  }
};

/**
 * Delete user account
 * DELETE /api/auth/delete-account
 * Protected by verifyToken middleware (Authorization header)
 */
export const deleteAccount = async (req, res) => {
  const uid = req.user?.uid;

  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const db = admin.firestore();

    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User data not found",
        code: "USER_NOT_FOUND",
      });
    }

    const { username } = userDoc.data();

    const batch = db.batch();
    batch.delete(userDocRef);

    if (username) {
      batch.delete(db.collection("usernames").doc(username));
    }

    await batch.commit();

    await admin.auth().deleteUser(uid);

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "DELETE_FAILED",
    });
  }
};

/**
 * Update user favorites
 * PUT /api/auth/update-favorites
 */
export const updateFavorites = async (req, res) => {
  const uid = req.user?.uid;
  const { favoriteIds } = req.body;

  if (!uid) {
    return res.status(401).json({
      error: "Error updating favorites",
      code: "Update_Failed",
    });
  }

  if (!Array.isArray(favoriteIds)) {
    return res.status(400).json({
      error: "Favorite IDs must be an array",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const userDocRef = db.collection("users").doc(uid);

    // Check if document exists first
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User document not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Update only the favoriteIds field (update() automatically merges)
    await userDocRef.update({
      favoriteIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: "Favorites updated successfully",
    });
  } catch (error) {
    console.error("Error updating favorites:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "UPDATE_FAILED",
    });
  }
};

/**
 * Get user favorites
 * PUT /api/auth/favorites
 */
export const getFavorites = async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const db = admin.firestore();
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.json({
        success: true,
        favoriteIds: [],
      });
    }

    const { favoriteIds } = userDoc.data();
    const list = Array.isArray(favoriteIds) ? favoriteIds : [];

    return res.json({
      success: true,
      favoriteIds: list,
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "FAVORITES_FETCH_FAILED",
    });
  }
};

/**
 * Get user preferences (subset or all)
 * GET /api/auth/get-preferences?fields=cookware,diets,budget
 * Omit fields or use fields=all to return every preference field.
 */
export const getPreferences = async (req, res) => {
  const uid = req.user?.uid;

  if (!uid) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const ALL_KEYS = [
    "cookware",
    "allergies",
    "diets",
    "budget",
    "nutrientDisplay",
    "locationEnabled",
    "appPreferences",
    "onboarded",
  ];

  const raw = req.query.fields ?? req.query.keys ?? "";
  // Turn string query into array
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const keysToReturn =
    parts.length === 0 || parts.includes("all")
      ? ALL_KEYS
      : parts.filter((k) => ALL_KEYS.includes(k));

  if (keysToReturn.length === 0) {
    return res.status(400).json({
      error: "No valid preference fields requested",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User document not found",
        code: "USER_NOT_FOUND",
      });
    }

    const d = userDoc.data() || {};
    const output = { success: true };

    for (const key of keysToReturn) {
      switch (key) {
        case "cookware":
          output.cookware = Array.isArray(d.cookware) ? d.cookware : [];
          break;
        case "allergies":
          output.allergies = Array.isArray(d.allergies) ? d.allergies : [];
          break;
        case "diets":
          output.diets = Array.isArray(d.diets) ? d.diets : [];
          break;
        case "budget":
          output.budget =
            typeof d.budget === "number" && !Number.isNaN(d.budget)
              ? d.budget
              : 0;
          break;
        case "nutrientDisplay":
          output.nutrientDisplay = Array.isArray(d.nutrientDisplay)
            ? d.nutrientDisplay
            : [];
          break;
        case "locationEnabled":
          output.locationEnabled =
            typeof d.locationEnabled === "boolean" ? d.locationEnabled : false;
          break;
        case "appPreferences":
          output.appPreferences =
            d.appPreferences && typeof d.appPreferences === "object"
              ? d.appPreferences
              : null;
          break;
        case "onboarded":
          output.onboarded =
            typeof d.onboarded === "boolean"
              ? d.onboarded
              : typeof d.onboarding === "boolean"
                ? d.onboarding
                : false;
          break;
        default:
          break;
      }
    }

    return res.status(200).json(output);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "PREFERENCES_FETCH_FAILED",
    });
  }
};

/**
 * Update multiple user preferences at once
 * PUT /api/auth/update-preferences
 */
export const updatePreferences = async (req, res) => {
  const uid = req.user?.uid;
  const {
    cookware,
    allergies,
    diets,
    budget,
    nutrientDisplay,
    locationEnabled,
    appPreferences,
    onboarded,
  } = req.body;

  if (!uid) {
    return res.status(401).json({
      error: "Error updating preferences",
      code: "UPDATE_FAILED",
    });
  }

  try {
    const db = admin.firestore();
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User document not found",
        code: "USER_NOT_FOUND",
      });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Validate and update each preference individually
    if (Array.isArray(cookware)) updateData.cookware = cookware;
    if (Array.isArray(allergies)) updateData.allergies = allergies;
    if (Array.isArray(diets)) updateData.diets = diets;
    if (typeof budget === "number" && !isNaN(budget))
      updateData.budget = budget;
    if (Array.isArray(nutrientDisplay))
      updateData.nutrientDisplay = nutrientDisplay;
    if (typeof locationEnabled === "boolean")
      updateData.locationEnabled = locationEnabled;
    if (appPreferences && typeof appPreferences === "object")
      updateData.appPreferences = appPreferences;

    // Should be requested once: Set onboarded to true after setting preferences during onboarding
    if (typeof onboarded === "boolean" && onboarded === true) {
      updateData.onboarded = true;
    }

    await userDocRef.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return res.status(400).json({
      error: error.message,
      code: error.code || "UPDATE_FAILED",
    });
  }
};

/* --- Recipe collections (Pinterest-style boards) --- */

function collectionsRef(db, uid) {
  return db.collection("users").doc(uid).collection("recipeCollections");
}

/**
 * GET /api/auth/collections
 */
export const listRecipeCollections = async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  try {
    const db = admin.firestore();
    let snap;
    try {
      snap = await collectionsRef(db, uid).orderBy("updatedAt", "desc").get();
    } catch (orderErr) {
      console.warn("Collections orderBy failed, falling back:", orderErr?.message);
      snap = await collectionsRef(db, uid).get();
    }
    const collections = snap.docs.map((doc) => {
      const d = doc.data() || {};
      const recipeIds = Array.isArray(d.recipeIds) ? d.recipeIds : [];
      return {
        id: doc.id,
        name: typeof d.name === "string" ? d.name : "Untitled",
        recipeIds,
        recipeCount: recipeIds.length,
      };
    });

    return res.json({ success: true, collections });
  } catch (error) {
    console.error("Error listing collections:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTIONS_LIST_FAILED",
    });
  }
};

/**
 * POST /api/auth/collections
 * body: { name: string, recipeId?: string } — optional recipe added on create
 */
export const createRecipeCollection = async (req, res) => {
  const uid = req.user?.uid;
  const rawName = req.body?.name;
  const recipeId = typeof req.body?.recipeId === "string" ? req.body.recipeId.trim() : "";

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  const name = String(rawName ?? "").trim();
  if (!name) {
    return res.status(400).json({
      error: "Collection name is required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User document not found",
        code: "USER_NOT_FOUND",
      });
    }

    const ref = collectionsRef(db, uid).doc();
    const recipeIds = recipeId ? [recipeId] : [];

    await ref.set({
      name,
      recipeIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      collection: {
        id: ref.id,
        name,
        recipeIds,
        recipeCount: recipeIds.length,
      },
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_CREATE_FAILED",
    });
  }
};

/**
 * GET /api/auth/collections/:collectionId
 */
export const getRecipeCollection = async (req, res) => {
  const uid = req.user?.uid;
  const { collectionId } = req.params;

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  if (!collectionId) {
    return res.status(400).json({
      error: "collectionId is required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const doc = await collectionsRef(db, uid).doc(collectionId).get();
    if (!doc.exists) {
      return res.status(404).json({
        error: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    const d = doc.data() || {};
    const recipeIds = Array.isArray(d.recipeIds) ? d.recipeIds : [];

    return res.json({
      success: true,
      collection: {
        id: doc.id,
        name: typeof d.name === "string" ? d.name : "Untitled",
        recipeIds,
        recipeCount: recipeIds.length,
      },
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_FETCH_FAILED",
    });
  }
};

/**
 * PATCH /api/auth/collections/:collectionId
 * body: { name: string }
 */
export const updateRecipeCollection = async (req, res) => {
  const uid = req.user?.uid;
  const { collectionId } = req.params;
  const name = String(req.body?.name ?? "").trim();

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  if (!collectionId) {
    return res.status(400).json({
      error: "collectionId is required",
      code: "INVALID_REQUEST",
    });
  }

  if (!name) {
    return res.status(400).json({
      error: "Collection name is required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const ref = collectionsRef(db, uid).doc(collectionId);
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(404).json({
        error: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    await ref.update({
      name,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "Collection updated" });
  } catch (error) {
    console.error("Error updating collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_UPDATE_FAILED",
    });
  }
};

/**
 * DELETE /api/auth/collections/:collectionId
 */
export const deleteRecipeCollection = async (req, res) => {
  const uid = req.user?.uid;
  const { collectionId } = req.params;

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  if (!collectionId) {
    return res.status(400).json({
      error: "collectionId is required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const ref = collectionsRef(db, uid).doc(collectionId);
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(404).json({
        error: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    await ref.delete();
    return res.json({ success: true, message: "Collection deleted" });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_DELETE_FAILED",
    });
  }
};

/**
 * POST /api/auth/collections/:collectionId/recipes
 * body: { recipeId: string }
 */
export const addRecipeToCollection = async (req, res) => {
  const uid = req.user?.uid;
  const { collectionId } = req.params;
  const recipeId = String(req.body?.recipeId ?? "").trim();

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  if (!collectionId || !recipeId) {
    return res.status(400).json({
      error: "collectionId and recipeId are required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const ref = collectionsRef(db, uid).doc(collectionId);
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(404).json({
        error: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    await ref.update({
      recipeIds: admin.firestore.FieldValue.arrayUnion(recipeId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "Recipe saved to collection" });
  } catch (error) {
    console.error("Error adding recipe to collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_ADD_RECIPE_FAILED",
    });
  }
};

/**
 * DELETE /api/auth/collections/:collectionId/recipes/:recipeId
 */
export const removeRecipeFromCollection = async (req, res) => {
  const uid = req.user?.uid;
  const { collectionId, recipeId } = req.params;

  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  if (!collectionId || !recipeId) {
    return res.status(400).json({
      error: "collectionId and recipeId are required",
      code: "INVALID_REQUEST",
    });
  }

  try {
    const db = admin.firestore();
    const ref = collectionsRef(db, uid).doc(collectionId);
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(404).json({
        error: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    await ref.update({
      recipeIds: admin.firestore.FieldValue.arrayRemove(recipeId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, message: "Recipe removed from collection" });
  } catch (error) {
    console.error("Error removing recipe from collection:", error);
    return res.status(400).json({
      error: error.message,
      code: "COLLECTION_REMOVE_RECIPE_FAILED",
    });
  }
};
