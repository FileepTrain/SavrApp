// controllers/reviewController.js
import admin from "firebase-admin";

//Reviews have their own collection
const REVIEWS_COLL = "reviews";


/*  // POST /api/reviews - Creates review
*   stores -> rating, review, timestamp, author
*/
export const createReview = async (req, res) => {
    const db = admin.firestore();
    const recipeId = req.body?.recipeId;
    const userId = req.user?.uid;
    const { rating, review } = req.body || {};

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

    //Limiting to one review per account on each recipe
    const existing = await db
        .collection(REVIEWS_COLL)
        .where("recipeId", "==", recipeId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

    if (!existing.empty) {
        return res.status(409).json({
            error: "You have already reviewed this recipe",
            code: "REVIEW_ALREADY_EXISTS",
        });
    }

    try {
        const doc = {
            recipeId,
            userId,
            authorDisplayName: req.user?.username ?? req.user?.email ?? null,
            rating: numRating,
            review: reviewText,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };


        const ref = await db.collection(REVIEWS_COLL).add(doc);

        return res.status(201).json({
            id: ref.id,
            ...doc,
            createdAt: new Date().toISOString(), // client-friendly; real time is in Firestore
        });
    } catch (err) {
        console.error("createReview error:", err);
        return res.status(500).json({
            error: err.message || "Failed to create review",
            code: "REVIEW_CREATE_FAILED",
        });
    }
};

  

// GET /api/reviews/:id/reviews - Get and list reviews for a recipe
export const getReview = async (req, res) => {
    const db = admin.firestore();
    const recipeId = req.query.recipeId;

    if (!recipeId) {
        return res.status(400).json({
            error: "Recipe ID is required",
            code: "MISSING_RECIPE_ID",
        });
    }

    try {
        const snapshot = await db
            .collection(REVIEWS_COLL)
            .where("recipeId", "==", recipeId)
             .get();
    
        const reviews = snapshot.docs.map((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate?.()
                ? data.createdAt.toDate().toISOString()
                : data.createdAt;
            return {
                id: doc.id,
                recipeId: data.recipeId,
                userId: data.userId,
                authorDisplayName: data.authorDisplayName ?? null,
                rating: data.rating,
                review: data.review,
                createdAt,
            };
        });

        return res.status(200).json({
            reviews,
            total: reviews.length,
        });
    } catch (err) {
        console.error("getReview error:", err);
        return res.status(500).json({
            error: err.message || "Failed to fetch reviews",
            code: "REVIEW_FETCH_FAILED",
        });
    }

};