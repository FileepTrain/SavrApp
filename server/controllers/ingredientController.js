import admin from "firebase-admin";

/**
 * Get ingredients by their IDs
 * POST /api/ingredients/batch
 * Body: { ingredientIds: string[] }
 */
export const getIngredientsByIds = async (req, res) => {
  const db = admin.firestore();
  const { ingredientIds } = req.body;

  if (
    !ingredientIds ||
    !Array.isArray(ingredientIds) ||
    ingredientIds.length === 0
  ) {
    return res.status(400).json({
      error: "ingredientIds array is required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // Fetch all ingredients in parallel
    const ingredientPromises = ingredientIds.map((id) =>
      db.collection("ingredients").doc(id).get(),
    );
    const ingredientDocs = await Promise.all(ingredientPromises);

    const ingredients = ingredientDocs
      .map((doc) => {
        if (!doc.exists) {
          return null;
        }
        return {
          id: doc.id,
          ...doc.data(),
        };
      })
      .filter((ingredient) => ingredient !== null); // Remove any nulls (missing ingredients)

    res.json({
      success: true,
      ingredients,
    });
  } catch (error) {
    console.error("Error fetching ingredients:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "FETCH_INGREDIENTS_FAILED",
    });
  }
};
