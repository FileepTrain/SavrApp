import admin from "firebase-admin";
import axios from "axios";
import { success } from "zod";

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
    const firebaseResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );

    const { idToken, refreshToken, localId, displayName } = firebaseResponse.data;

    return res.json({
      success: true,
      uid: localId,
      idToken,
      refreshToken,
      email,
      username: displayName,
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

    await db.collection("users").doc(uid).update({
      favoriteIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

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

    const {favoriteIds} = userDoc.data();
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
