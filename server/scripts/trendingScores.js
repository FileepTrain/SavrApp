/* Updates the trending score for all recipes if modifications happen to the trending algorithm */
import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("../firebaseAdminConfig.json", import.meta.url))
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const COLL = "external_recipes";

function calculateTrendingScore(totalStars, reviewCount, viewCount) {
  const averageRating = reviewCount > 0 ? totalStars / reviewCount : 0;

  const trendingScore =
    averageRating * 0.5 +
    Math.log10(viewCount + 1) * 0.3 +
    Math.log10(reviewCount + 1) * 0.2;

  return {
    averageRating: Number(averageRating.toFixed(1)),
    trendingScore: Number(trendingScore.toFixed(4)),
  };
}

async function backfillTrendingScores() {
  try {
    const snap = await db.collection(COLL).get();

    console.log(`Found ${snap.size} recipes`);

    let updatedCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();

      const reviews = Array.isArray(data.reviews) ? data.reviews : [];

      const reviewCount = Number.isFinite(Number(data.reviewCount))
        ? Number(data.reviewCount)
        : reviews.length;

      const totalStars = Number.isFinite(Number(data.totalStars))
        ? Number(data.totalStars)
        : reviews.reduce((sum, review) => sum + (review?.rating || 0), 0);

      const viewCount = Number.isFinite(Number(data.viewCount))
        ? Number(data.viewCount)
        : 0;

      const { averageRating, trendingScore } = calculateTrendingScore(
        totalStars,
        reviewCount,
        viewCount
      );

      await doc.ref.set(
        {
          reviewCount,
          totalStars,
          viewCount,
          averageRating,
          trendingScore,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      updatedCount++;
      console.log(`Updated ${doc.id}`);
    }

    console.log(`Done. Updated ${updatedCount} recipes.`);
    process.exit(0);
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  }
}

backfillTrendingScores();