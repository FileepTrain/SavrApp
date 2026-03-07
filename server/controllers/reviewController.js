// controllers/reviewController.js
import admin from "firebase-admin";

const REVIEWS_COLL = "reviews";
const RECIPES_COLL = "personal_recipes";
const EXTERNAL_RECIPES_COLL = "external_recipes";
const EXTERNAL_SOURCE = "spoonacular";

function externalRecipeDocId(recipeId) {
  return `${EXTERNAL_SOURCE}_${String(recipeId)}`;
}

function addReviewToDoc(transaction, docRef, userId, newReview, numRating) {
  return transaction.get(docRef).then((snap) => {
    const data = snap.exists ? snap.data() : {};
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const existing = reviews.some((r) => r && r.userId === userId);
    if (existing) {
      throw { status: 409, message: "You have already reviewed this recipe", code: "REVIEW_ALREADY_EXISTS" };
    }
    const currentCount = Number.isFinite(Number(data.reviewCount)) ? Number(data.reviewCount) : reviews.length;
    const currentTotalStars = Number.isFinite(Number(data.totalStars)) ? Number(data.totalStars) : reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0);

    const updatePayload = {
      reviews: admin.firestore.FieldValue.arrayUnion(newReview),
      reviewCount: currentCount + 1,
      totalStars: currentTotalStars + numRating,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (snap.exists) {
      transaction.update(docRef, updatePayload);
    } else {
      const externalId = docRef.id.startsWith(`${EXTERNAL_SOURCE}_`) ? docRef.id.slice(EXTERNAL_SOURCE.length + 1) : docRef.id;
      transaction.set(docRef, {
        externalSource: EXTERNAL_SOURCE,
        externalId,
        reviews: [newReview],
        reviewCount: 1,
        totalStars: numRating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

/**
 * POST /api/reviews - Create a review.
 * Store reviews in the recipe document: personal_recipes or external_recipes (by doc id spoonacular_<id>).
 */
export const createReview = async (req, res) => {
  const db = admin.firestore();
  const rawRecipeId = req.body?.recipeId;
  const userId = req.user?.uid;
  const { rating, review } = req.body || {};

  const recipeId = rawRecipeId == null ? "" : String(rawRecipeId).trim();

  if (!recipeId) {
    return res.status(400).json({
      error: "Recipe ID is required",
      code: "MISSING_RECIPE_ID",
    });
  }

  if (!userId) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({
      error: "Rating must be a number between 1 and 5",
      code: "INVALID_RATING",
    });
  }

  const reviewText = typeof review === "string" ? review.trim() : "";
  if (!reviewText) {
    return res.status(400).json({
      error: "Review text is required",
      code: "INVALID_REVIEW",
    });
  }

  const newReview = {
    userId,
    authorDisplayName: req.user?.username ?? req.user?.email ?? null,
    rating: numRating,
    review: reviewText,
    createdAt: new Date(),
  };

  const recipeRef = db.collection(RECIPES_COLL).doc(recipeId);
  const recipeSnap = await recipeRef.get();

  if (recipeSnap.exists) {
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(recipeRef);
        if (!snap.exists) {
          throw { status: 404, message: "Recipe not found", code: "RECIPE_NOT_FOUND" };
        }
        const data = snap.data();
        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        const existing = reviews.some((r) => r && r.userId === userId);
        if (existing) {
          throw { status: 409, message: "You have already reviewed this recipe", code: "REVIEW_ALREADY_EXISTS" };
        }
        const currentCount = Number.isFinite(Number(data.reviewCount)) ? Number(data.reviewCount) : reviews.length;
        const currentTotalStars = Number.isFinite(Number(data.totalStars)) ? Number(data.totalStars) : reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0);
        transaction.update(recipeRef, {
          reviews: admin.firestore.FieldValue.arrayUnion(newReview),
          reviewCount: currentCount + 1,
          totalStars: currentTotalStars + numRating,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      return res.status(201).json({ success: true, message: "Review added" });
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: err.message, code: err.code });
      if (err.status === 409) return res.status(409).json({ error: err.message, code: err.code });
      console.error("createReview (personal) error:", err);
      return res.status(500).json({ error: err.message || "Failed to create review", code: "REVIEW_CREATE_FAILED" });
    }
  }

  // External recipe: store in external_recipes document (same shape: reviews array, reviewCount, totalStars)
  const externalDocId = externalRecipeDocId(recipeId);
  const externalRef = db.collection(EXTERNAL_RECIPES_COLL).doc(externalDocId);

  try {
    await db.runTransaction(async (transaction) => {
      await addReviewToDoc(transaction, externalRef, userId, newReview, numRating);
    });
    return res.status(201).json({ success: true, message: "Review added" });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message, code: err.code });
    console.error("createReview (external) error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create review",
      code: "REVIEW_CREATE_FAILED",
    });
  }
};

function normalizeReviewsFromDoc(data) {
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const reviewCount = Number.isFinite(Number(data.reviewCount)) ? Number(data.reviewCount) : reviews.length;
  const totalStars = Number.isFinite(Number(data.totalStars)) ? Number(data.totalStars) : reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0);
  const averageRating = reviewCount > 0 ? totalStars / reviewCount : 0;
  const normalized = reviews.map((r) => {
    if (!r) return null;
    const createdAt = r.createdAt?.toDate?.() ? r.createdAt.toDate().toISOString() : (r.createdAt ?? null);
    return {
      id: r.userId,
      userId: r.userId,
      authorDisplayName: r.authorDisplayName ?? null,
      rating: r.rating,
      review: r.review,
      createdAt,
    };
  }).filter(Boolean);
  return { normalized, reviewCount, totalStars, averageRating };
}

/**
 * GET /api/reviews?recipeId=... - Get reviews for a recipe.
 * Read from recipe document: personal_recipes or external_recipes (reviews, reviewCount, totalStars).
 * Fallback: legacy reviews collection for old external data.
 */
export const getReview = async (req, res) => {
  const db = admin.firestore();
  const rawRecipeId = req.query.recipeId;
  const recipeId = rawRecipeId == null ? "" : String(rawRecipeId).trim();

  if (!recipeId) {
    return res.status(400).json({
      error: "Recipe ID is required",
      code: "MISSING_RECIPE_ID",
    });
  }

  try {
    const recipeSnap = await db.collection(RECIPES_COLL).doc(recipeId).get();

    if (recipeSnap.exists) {
      const data = recipeSnap.data();
      const { normalized, reviewCount, totalStars, averageRating } = normalizeReviewsFromDoc(data);
      return res.status(200).json({
        reviews: normalized,
        total: normalized.length,
        reviewCount,
        totalStars,
        averageRating: Math.round(averageRating * 10) / 10,
      });
    }

    const externalDocId = externalRecipeDocId(recipeId);
    const externalSnap = await db.collection(EXTERNAL_RECIPES_COLL).doc(externalDocId).get();

    if (externalSnap.exists) {
      const data = externalSnap.data();
      const { normalized, reviewCount, totalStars, averageRating } = normalizeReviewsFromDoc(data);
      return res.status(200).json({
        reviews: normalized,
        total: normalized.length,
        reviewCount,
        totalStars,
        averageRating: Math.round(averageRating * 10) / 10,
      });
    }

    // Legacy: read from reviews collection (old external reviews)
    const snapshot = await db
      .collection(REVIEWS_COLL)
      .where("recipeId", "==", recipeId)
      .get();

    const reviews = snapshot.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate?.() ? d.createdAt.toDate().toISOString() : d.createdAt;
      return {
        id: doc.id,
        recipeId: d.recipeId,
        userId: d.userId,
        authorDisplayName: d.authorDisplayName ?? null,
        rating: d.rating,
        review: d.review,
        createdAt,
      };
    });

    const total = reviews.length;
    const totalStars = reviews.reduce((s, r) => s + (r.rating ?? 0), 0);
    const averageRating = total > 0 ? totalStars / total : 0;

    return res.status(200).json({
      reviews,
      total,
      reviewCount: total,
      totalStars,
      averageRating: Math.round(averageRating * 10) / 10,
    });
  } catch (err) {
    console.error("getReview error:", err);
    return res.status(500).json({
      error: err.message || "Failed to fetch reviews",
      code: "REVIEW_FETCH_FAILED",
    });
  }
};
