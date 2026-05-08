import admin from "firebase-admin";

/**
 * GET /api/auth/recipe-notes/:recipeId
 * Returns the saved notes and substitutions for a recipe.
 */
export const getRecipeNotes = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const { recipeId } = req.params;

    if (!recipeId || !String(recipeId).trim()) {
      return res.status(400).json({ error: "recipeId is required" });
    }

    const docRef = db
      .collection("users")
      .doc(uid)
      .collection("recipeNotes")
      .doc(recipeId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(200).json({ text: "", substitutions: [] });
    }

    const data = doc.data();
    return res.status(200).json({
      text: typeof data.text === "string" ? data.text : "",
      substitutions: Array.isArray(data.substitutions) ? data.substitutions : [],
    });
  } catch (err) {
    console.error("getRecipeNotes error:", err);
    return res.status(500).json({ error: "Failed to fetch recipe notes" });
  }
};

/**
 * PUT /api/auth/recipe-notes/:recipeId
 * Creates or replaces notes and substitutions for a recipe.
 */
export const upsertRecipeNotes = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const { recipeId } = req.params;

    if (!recipeId || !String(recipeId).trim()) {
      return res.status(400).json({ error: "recipeId is required" });
    }

    const { text, substitutions } = req.body;

    const docRef = db
      .collection("users")
      .doc(uid)
      .collection("recipeNotes")
      .doc(recipeId);

    await docRef.set({
      text: typeof text === "string" ? text : "",
      substitutions: Array.isArray(substitutions) ? substitutions : [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("upsertRecipeNotes error:", err);
    return res.status(500).json({ error: "Failed to save recipe notes" });
  }
};
