import admin from "firebase-admin";
import { buildHabitDaysArray } from "../utils/mealPlanHabitDays.js";

function mealSlotToStored(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const first = value[0];
    const isObjectSlot =
      first != null &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      (Object.prototype.hasOwnProperty.call(first, "id") ||
        Object.prototype.hasOwnProperty.call(first, "recipeId"));
    if (isObjectSlot) {
      const normalized = value
        .map((raw) => {
          if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
          const id = String(raw.id ?? raw.recipeId ?? "").trim();
          if (!id) return null;
          const baseRaw = Number(raw.baseServings ?? raw.base_servings ?? 1);
          const targetRaw = Number(raw.targetServings ?? raw.target_servings ?? 1);
          const batchRaw = Number(raw.batchMultiplier ?? raw.batch_multiplier ?? raw.batches ?? 1);
          const baseServings =
            Number.isFinite(baseRaw) && Math.floor(baseRaw) >= 1 ? Math.floor(baseRaw) : 1;
          const targetServings =
            Number.isFinite(targetRaw) && Math.floor(targetRaw) >= 1 ? Math.floor(targetRaw) : 1;
          const batchMultiplier =
            Number.isFinite(batchRaw) && Math.floor(batchRaw) >= 1 ? Math.floor(batchRaw) : 1;
          return { id, baseServings, targetServings, batchMultiplier, title: raw.title ?? null, };
        })
        .filter(Boolean);
      return normalized.length ? JSON.stringify(normalized) : null;
    }
    const joined = value.map((x) => String(x).trim()).filter(Boolean).join(",");
    return joined.length ? joined : null;
  }
  const s = String(value).trim();
  return s.length ? s : null;
}

function resolveHabitDaysForResponse(data, startDateObj, endDateObj) {
  if (Array.isArray(data.habitDays) && data.habitDays.length > 0) {
    return data.habitDays;
  }
  return buildHabitDaysArray(
    startDateObj,
    endDateObj,
    data.breakfast ?? null,
    data.lunch ?? null,
    data.dinner ?? null,
  );
}

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

    const habitDays = buildHabitDaysArray(startDate, endDate, breakfast, lunch, dinner);

    const doc = {
      userID,
      breakfast: mealSlotToStored(breakfast),
      lunch: mealSlotToStored(lunch),
      dinner: mealSlotToStored(dinner),
      start_date: admin.firestore.Timestamp.fromDate(startDate),
      end_date: admin.firestore.Timestamp.fromDate(endDate),
      habitDays,
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
        habitDays,
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
 * (calendar history)
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
      const startD = start ? new Date(start) : null;
      const endD = end ? new Date(end) : null;
      const habitDays =
        startD && endD && !Number.isNaN(startD.getTime()) && !Number.isNaN(endD.getTime())
          ? resolveHabitDaysForResponse(data, startD, endD)
          : [];
      return {
        id: doc.id,
        userID: data.userID,
        breakfast: data.breakfast ?? null,
        lunch: data.lunch ?? null,
        dinner: data.dinner ?? null,
        start_date: startD ? startD.toISOString() : null,
        end_date: endD ? endD.toISOString() : null,
        habitDays,
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
 * GET /api/meal-plans/:planId
 * Returns one meal plan if it belongs to the authenticated user.
 * (edit meal plan)
 */
export const getMealPlanById = async (req, res) => {
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

    const data = snap.data();
    if (data?.userID !== userID) {
      return res.status(403).json({ error: "You can only view your own meal plans" });
    }

    const start = data.start_date?.toDate?.() ?? data.start_date;
    const end = data.end_date?.toDate?.() ?? data.end_date;
    const startD = start ? new Date(start) : null;
    const endD = end ? new Date(end) : null;
    const habitDays =
      startD && endD && !Number.isNaN(startD.getTime()) && !Number.isNaN(endD.getTime())
        ? resolveHabitDaysForResponse(data, startD, endD)
        : [];

    return res.status(200).json({
      mealPlan: {
        id: snap.id,
        userID: data.userID,
        breakfast: data.breakfast ?? null,
        lunch: data.lunch ?? null,
        dinner: data.dinner ?? null,
        start_date: startD ? startD.toISOString() : null,
        end_date: endD ? endD.toISOString() : null,
        habitDays,
      },
    });
  } catch (err) {
    console.error("getMealPlanById error:", err);
    return res.status(500).json({ error: "Failed to fetch meal plan" });
  }
};

/**
 * PUT /api/meal-plans/:planId
 * Body: { breakfast?, lunch?, dinner?, start_date, end_date }
 * Replaces slot strings and date range for the authenticated owner's plan.
 */
export const updateMealPlan = async (req, res) => {
  try {
    const db = admin.firestore();
    const userID = req.user.uid;
    const planId = String(req.params.planId ?? "").trim();

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }

    const { breakfast, lunch, dinner, start_date, end_date } = req.body;

    if (start_date == null || end_date == null) {
      return res.status(400).json({ error: "start_date and end_date are required" });
    }

    const startDate = start_date instanceof Date ? start_date : new Date(start_date);
    const endDate = end_date instanceof Date ? end_date : new Date(end_date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid start_date or end_date" });
    }

    const ref = db.collection("meal_plans").doc(planId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    if (snap.data()?.userID !== userID) {
      return res.status(403).json({ error: "You can only update your own meal plans" });
    }

    const old = snap.data() ?? {};
    const prevFollow = new Map();
    if (Array.isArray(old.habitDays)) {
      for (const row of old.habitDays) {
        if (row && row.date) prevFollow.set(String(row.date), !!row.followedPlan);
      }
    }

    const habitDays = buildHabitDaysArray(
      startDate,
      endDate,
      breakfast,
      lunch,
      dinner,
    ).map((row) => ({
      ...row,
      followedPlan: prevFollow.has(row.date) ? prevFollow.get(row.date) : false,
    }));

    await ref.update({
      breakfast: mealSlotToStored(breakfast),
      lunch: mealSlotToStored(lunch),
      dinner: mealSlotToStored(dinner),
      start_date: admin.firestore.Timestamp.fromDate(startDate),
      end_date: admin.firestore.Timestamp.fromDate(endDate),
      habitDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      mealPlan: {
        id: planId,
        userID,
        breakfast: mealSlotToStored(breakfast),
        lunch: mealSlotToStored(lunch),
        dinner: mealSlotToStored(dinner),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        habitDays,
      },
    });
  } catch (err) {
    console.error("updateMealPlan error:", err);
    return res.status(500).json({ error: "Failed to update meal plan" });
  }
};

/**
 * DELETE /api/meal-plans/:planId
 * Deletes a meal plan owned by the authenticated user.
 */
/**
 * PATCH /api/meal-plans/:planId/habit-day
 * Body: { date: "YYYY-MM-DD", followedPlan?: boolean }
 * If followedPlan is omitted, toggles the stored flag for that calendar day.
 */
export const patchMealPlanHabitDay = async (req, res) => {
  try {
    const db = admin.firestore();
    const userID = req.user.uid;
    const planId = String(req.params.planId ?? "").trim();
    const dateKey = String(req.body?.date ?? "").trim();
    const { followedPlan } = req.body ?? {};

    if (!planId) {
      return res.status(400).json({ error: "planId is required" });
    }
    if (!dateKey) {
      return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    }

    const ref = db.collection("meal_plans").doc(planId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Meal plan not found" });
    }

    const data = snap.data();
    if (data?.userID !== userID) {
      return res.status(403).json({ error: "You can only update your own meal plans" });
    }

    const start = data.start_date?.toDate?.() ?? data.start_date;
    const end = data.end_date?.toDate?.() ?? data.end_date;
    const startD = start ? new Date(start) : null;
    const endD = end ? new Date(end) : null;

    let habitDays =
      Array.isArray(data.habitDays) && data.habitDays.length > 0
        ? data.habitDays.map((row) => ({ ...row }))
        : startD && endD
          ? buildHabitDaysArray(startD, endD, data.breakfast, data.lunch, data.dinner)
          : [];

    const idx = habitDays.findIndex((h) => h && String(h.date) === dateKey);
    if (idx === -1) {
      return res.status(400).json({ error: "Date is not part of this meal plan" });
    }

    const nextFollowed =
      followedPlan === undefined || followedPlan === null
        ? !habitDays[idx].followedPlan
        : Boolean(followedPlan);

    habitDays[idx] = { ...habitDays[idx], followedPlan: nextFollowed };

    await ref.update({
      habitDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      day: habitDays[idx],
      habitDays,
    });
  } catch (err) {
    console.error("patchMealPlanHabitDay error:", err);
    return res.status(500).json({ error: "Failed to update habit day" });
  }
};

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
