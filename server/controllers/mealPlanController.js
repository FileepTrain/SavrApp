import admin from "firebase-admin";

/**
 * POST /api/meal-plans
 * Body: { breakfast?, lunch?, dinner?, start_date, end_date }
 * breakfast, lunch, dinner are optional (ex. only breakfast planned)
 * start_date, end_date are required
 */
export const createMealPlan = async (req, res) => {
  try {
    const db = admin.firestore();
    const userID = req.user.uid;

    const { breakfast, lunch, dinner, start_date, end_date } = req.body;

    if (start_date == null || end_date == null) {
      return res.status(400).json({ error: "start_date and end_date are required" });
    }

    const startDate = start_date instanceof Date ? start_date : new Date(start_date);
    const endDate = end_date instanceof Date ? end_date : new Date(end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid start_date or end_date" });
    }

    const doc = {
      userID,
      breakfast: breakfast != null ? String(breakfast) : null,
      lunch: lunch != null ? String(lunch) : null,
      dinner: dinner != null ? String(dinner) : null,
      start_date: admin.firestore.Timestamp.fromDate(startDate),
      end_date: admin.firestore.Timestamp.fromDate(endDate),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("meal_plans").add(doc);

    return res.status(201).json({
      mealPlan: {
        id: docRef.id,
        userID: doc.userID,
        breakfast: doc.breakfast,
        lunch: doc.lunch,
        dinner: doc.dinner,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    });
  } catch (err) {
    console.error("createMealPlan error:", err);
    return res.status(500).json({ error: "Failed to create meal plan" });
  }
};

/**
 * GET /api/meal-plans
 * Returns all meal plans for the authenticated user.
 */
export const getMealPlan = async (req, res) => {
  try {
    const db = admin.firestore();
    const userID = req.user.uid;

    const snapshot = await db
      .collection("meal_plans")
      .where("userID", "==", userID)
      .get();

    const mealPlans = snapshot.docs
      .map((doc) => {
      const data = doc.data();
      const start = data.start_date?.toDate?.() ?? data.start_date;
      const end = data.end_date?.toDate?.() ?? data.end_date;
      return {
        id: doc.id,
        userID: data.userID,
        breakfast: data.breakfast ?? null,
        lunch: data.lunch ?? null,
        dinner: data.dinner ?? null,
        start_date: start ? new Date(start).toISOString() : null,
        end_date: end ? new Date(end).toISOString() : null,
      };
      })
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    return res.status(200).json({ mealPlans });
  } catch (err) {
    console.error("getMealPlan error:", err);
    return res.status(500).json({ error: "Failed to fetch meal plans" });
  }
};

/**
 * DELETE /api/meal-plans/:planId
 * Deletes a meal plan owned by the authenticated user.
 */
export const deleteMealPlan = async (req, res) => {
  try {
    const db = admin.firestore();
    const userID = req.user.uid;
    const planId = String(req.params.planId ?? "").trim();

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    const ref = db.collection("meal_plans").doc(planId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    const owner = snap.data()?.userID;
    if (owner !== userID) {
      return res.status(403).json({ error: "You can only delete your own meal plans" });
    }

    await ref.delete();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("deleteMealPlan error:", err);
    return res.status(500).json({ error: "Failed to delete meal plan" });
  }
};
