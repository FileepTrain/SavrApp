import admin from "firebase-admin";
import ExternalRecipeModel from "../models/externalRecipeModel.js";

const RECIPES_COLL = "personal_recipes";

function isValidFirestoreUid(id) {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9]+$/.test(id)
  );
}

function collectionsRef(db, uid) {
  return db.collection("users").doc(uid).collection("recipeCollections");
}

async function uploadImageBuffer(buffer, path, contentType) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, { metadata: { contentType: contentType || "image/jpeg" } });
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return signedUrl;
}

async function signedUrlForStoredPath(path) {
  if (!path || typeof path !== "string") return null;
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return url;
  } catch (e) {
    console.warn("signedUrlForStoredPath failed:", e?.message);
    return null;
  }
}

async function deleteStoragePath(path) {
  if (!path || typeof path !== "string") return;
  try {
    const bucket = admin.storage().bucket();
    await bucket.file(path).delete({ ignoreNotFound: true });
  } catch (e) {
    console.warn("deleteStoragePath failed:", e?.message);
  }
}

function normalizePrivacy(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    showFavorites: p.showFavorites !== false,
    showCollections: p.showCollections !== false,
    showMealPlans: p.showMealPlans !== false,
  };
}

function personalRecipeSummaryFromDoc(id, d) {
  if (!d) return null;
  const reviews = Array.isArray(d.reviews) ? d.reviews : [];
  const reviewCount =
    typeof d.reviewCount === "number" ? d.reviewCount : reviews.length;
  const totalStars =
    typeof d.totalStars === "number"
      ? d.totalStars
      : reviews.reduce((s, rev) => s + (rev?.rating ?? 0), 0);
  const rating =
    reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;
  return {
    id,
    title: d.title ?? "Recipe",
    image: d.image ?? null,
    calories: typeof d.calories === "number" ? d.calories : 0,
    rating,
    reviewsLength: reviewCount,
  };
}

async function hydrateFavoriteSummaries(db, favoriteIds, max = 40) {
  const ids = Array.isArray(favoriteIds) ? favoriteIds.slice(0, max) : [];
  const rows = await Promise.all(
    ids.map(async (id) => {
      if (!id || typeof id !== "string") return null;
      if (/^\d+$/.test(id)) {
        const r = await ExternalRecipeModel.findByExternal("spoonacular", id);
        if (!r) return null;
        const rc = r.reviewCount || 0;
        const ts = r.totalStars || 0;
        const rating = rc > 0 ? Math.round((ts / rc) * 10) / 10 : 0;
        return {
          id: String(r.id),
          title: r.title ?? "Recipe",
          image: r.image ?? null,
          calories: typeof r.calories === "number" ? r.calories : 0,
          rating,
          reviewsLength: rc,
        };
      }
      const snap = await db.collection(RECIPES_COLL).doc(id).get();
      if (!snap.exists) return null;
      return personalRecipeSummaryFromDoc(snap.id, snap.data());
    }),
  );
  return rows.filter(Boolean);
}

async function fetchPersonalRecipesForUser(db, userId) {
  let snap;
  try {
    snap = await db
      .collection(RECIPES_COLL)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
  } catch (error) {
    const msg = String(error?.message || "");
    const needsIndex =
      error?.code === 9 || msg.toLowerCase().includes("requires an index");
    if (!needsIndex) throw error;
    const snap2 = await db
      .collection(RECIPES_COLL)
      .where("userId", "==", userId)
      .get();
    return snap2.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a?.createdAt?.toMillis?.() ?? 0;
        const tb = b?.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * GET /api/auth/users/:userId/profile
 */
export const getUserProfile = async (req, res) => {
  const viewerUid = req.user?.uid;
  const { userId } = req.params;

  if (!viewerUid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }
  if (!isValidFirestoreUid(userId)) {
    return res.status(400).json({ error: "Invalid user id", code: "INVALID_REQUEST" });
  }

  const db = admin.firestore();

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const userData = userSnap.data() || {};
    const username = typeof userData.username === "string" ? userData.username : "User";
    const privacy = normalizePrivacy(userData.profilePrivacy);
    const isOwnProfile = viewerUid === userId;

    const photoPath =
      typeof userData.profilePhotoStoragePath === "string"
        ? userData.profilePhotoStoragePath
        : null;
    const profilePhotoUrl = await signedUrlForStoredPath(photoPath);

    const recipesRaw = await fetchPersonalRecipesForUser(db, userId);
    const recipes = recipesRaw.map((r) => {
      const id = r.id;
      const reviews = Array.isArray(r.reviews) ? r.reviews : [];
      const reviewCount =
        typeof r.reviewCount === "number" ? r.reviewCount : reviews.length;
      const totalStars =
        typeof r.totalStars === "number"
          ? r.totalStars
          : reviews.reduce((s, rev) => s + (rev?.rating ?? 0), 0);
      const rating =
        reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;
      return {
        id,
        title: r.title ?? "Recipe",
        image: r.image ?? null,
        calories: typeof r.calories === "number" ? r.calories : 0,
        rating,
        reviewsLength: reviewCount,
        reviews,
      };
    });

    const favAllowed = isOwnProfile || privacy.showFavorites;
    const colAllowed = isOwnProfile || privacy.showCollections;
    const planAllowed = isOwnProfile || privacy.showMealPlans;

    let favorites = null;
    if (favAllowed) {
      const favIds = Array.isArray(userData.favoriteIds) ? userData.favoriteIds : [];
      favorites = await hydrateFavoriteSummaries(db, favIds);
    }

    let collections = null;
    if (colAllowed) {
      let snap;
      try {
        snap = await collectionsRef(db, userId).orderBy("updatedAt", "desc").get();
      } catch {
        snap = await collectionsRef(db, userId).get();
      }
      collections = snap.docs.map((doc) => {
        const d = doc.data() || {};
        const recipeIds = Array.isArray(d.recipeIds) ? d.recipeIds : [];
        return {
          id: doc.id,
          name: typeof d.name === "string" ? d.name : "Untitled",
          recipeIds,
          recipeCount: recipeIds.length,
        };
      });
    }

    let mealPlans = null;
    if (planAllowed) {
      const planSnap = await db
        .collection("meal_plans")
        .where("userID", "==", userId)
        .get();
      mealPlans = planSnap.docs
        .map((doc) => {
          const data = doc.data();
          const start = data.start_date?.toDate?.() ?? data.start_date;
          const end = data.end_date?.toDate?.() ?? data.end_date;
          return {
            id: doc.id,
            breakfast: data.breakfast ?? null,
            lunch: data.lunch ?? null,
            dinner: data.dinner ?? null,
            start_date: start ? new Date(start).toISOString() : null,
            end_date: end ? new Date(end).toISOString() : null,
          };
        })
        .sort((a, b) => {
          const ta = a.start_date ? new Date(a.start_date).getTime() : 0;
          const tb = b.start_date ? new Date(b.start_date).getTime() : 0;
          return tb - ta;
        });
    }

    return res.json({
      success: true,
      userId,
      username,
      profilePhotoUrl,
      isOwnProfile,
      profilePrivacy: isOwnProfile ? privacy : undefined,
      sectionVisibility: {
        favorites: favAllowed,
        collections: colAllowed,
        mealPlans: planAllowed,
      },
      recipes,
      favorites,
      collections,
      mealPlans,
    });
  } catch (error) {
    console.error("getUserProfile error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "PROFILE_FETCH_FAILED",
    });
  }
};

/**
 * PUT /api/auth/profile-privacy
 */
export const updateProfilePrivacy = async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  const { showFavorites, showCollections, showMealPlans } = req.body || {};

  try {
    const db = admin.firestore();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const prev = normalizePrivacy(snap.data()?.profilePrivacy);
    const next = {
      showFavorites:
        typeof showFavorites === "boolean" ? showFavorites : prev.showFavorites,
      showCollections:
        typeof showCollections === "boolean" ? showCollections : prev.showCollections,
      showMealPlans:
        typeof showMealPlans === "boolean" ? showMealPlans : prev.showMealPlans,
    };

    await ref.update({
      profilePrivacy: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, profilePrivacy: next });
  } catch (error) {
    console.error("updateProfilePrivacy error:", error);
    return res.status(400).json({
      error: error.message || "Update failed",
      code: "PRIVACY_UPDATE_FAILED",
    });
  }
};

/**
 * POST /api/auth/profile-photo (multipart field: image)
 */
export const uploadProfilePhoto = async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }

  const file = req.file;
  if (!file?.buffer || !file.buffer.length) {
    return res.status(400).json({ error: "Image file is required", code: "INVALID_REQUEST" });
  }

  const db = admin.firestore();

  try {
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const oldPath = snap.data()?.profilePhotoStoragePath;
    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/webp"
          ? "webp"
          : file.mimetype === "image/heic" || file.mimetype === "image/heif"
            ? "heic"
            : "jpg";
    const contentType =
      file.mimetype && file.mimetype.startsWith("image/")
        ? file.mimetype
        : "image/jpeg";

    const newPath = `users/${uid}/profile/avatar_${Date.now()}.${ext}`;
    const profilePhotoUrl = await uploadImageBuffer(file.buffer, newPath, contentType);

    await ref.update({
      profilePhotoStoragePath: newPath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (oldPath && oldPath !== newPath) {
      await deleteStoragePath(oldPath);
    }

    return res.json({ success: true, profilePhotoUrl, profilePhotoStoragePath: newPath });
  } catch (error) {
    console.error("uploadProfilePhoto error:", error);
    return res.status(500).json({
      error: error.message || "Upload failed",
      code: "PROFILE_PHOTO_FAILED",
    });
  }
};

/**
 * GET /api/auth/users/:ownerUid/collections/:collectionId/public
 */
export const getPublicCollection = async (req, res) => {
  const viewerUid = req.user?.uid;
  const { ownerUid, collectionId } = req.params;

  if (!viewerUid) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }
  if (!isValidFirestoreUid(ownerUid) || !collectionId) {
    return res.status(400).json({ error: "Invalid request", code: "INVALID_REQUEST" });
  }

  const db = admin.firestore();

  try {
    const ownerSnap = await db.collection("users").doc(ownerUid).get();
    if (!ownerSnap.exists) {
      return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    const privacy = normalizePrivacy(ownerSnap.data()?.profilePrivacy);
    const allowed = viewerUid === ownerUid || privacy.showCollections;
    if (!allowed) {
      return res.status(403).json({
        error: "This board is private",
        code: "COLLECTION_PRIVATE",
      });
    }

    const colRef = collectionsRef(db, ownerUid).doc(collectionId);
    const colSnap = await colRef.get();
    if (!colSnap.exists) {
      return res.status(404).json({ error: "Collection not found", code: "NOT_FOUND" });
    }

    const d = colSnap.data() || {};
    const recipeIds = Array.isArray(d.recipeIds) ? d.recipeIds : [];

    return res.json({
      success: true,
      collection: {
        id: colSnap.id,
        name: typeof d.name === "string" ? d.name : "Untitled",
        recipeIds,
      },
    });
  } catch (error) {
    console.error("getPublicCollection error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "COLLECTION_FETCH_FAILED",
    });
  }
};
