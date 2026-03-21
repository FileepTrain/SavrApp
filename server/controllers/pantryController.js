import admin from "firebase-admin";

// Post items
export const addPantryItem = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;

    const { name, quantity, unit } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("pantryItems")
      .add({
        name: String(name).trim(),
        quantity: quantity ?? 1,
        unit: unit ?? "each",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(201).json({
      item: {
        id: docRef.id,
        name: String(name).trim(),
        quantity: quantity ?? 1,
        unit: unit ?? "each",
      },
    });
  } catch (err) {
    console.error("addPantryItem error:", err);
    return res.status(500).json({ error: "Failed to add pantry item" });
  }
};

// Get items
export const getUserPantry = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("pantryItems")
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ items });
  } catch (err) {
    console.error("getUserPantry error:", err);
    return res.status(500).json({ error: "Failed to fetch pantry" });
  }
};

// Update Items
export const updatePantryItem = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const { id } = req.params;
    const { name, quantity, unit } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("pantryItems")
      .doc(id);

    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    await ref.update({
      name: String(name).trim(),
      quantity: quantity ?? 1,
      unit: unit ?? "each",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      item: {
        id,
        name: String(name).trim(),
        quantity: quantity ?? 1,
        unit: unit ?? "each",
      },
    });
  } catch (err) {
    console.error("updatePantryItem error:", err);
    return res.status(500).json({ error: "Failed to update pantry item" });
  }
};

// Delete items
export const deletePantryItem = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const { id } = req.params;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("pantryItems")
      .doc(id);

    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    await ref.delete();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("deletePantryItem error:", err);
    return res.status(500).json({ error: "Failed to delete pantry item" });
  }
};