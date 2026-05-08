import admin from "firebase-admin";

// Post items
export const addPantryItem = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;

    const { name, quantity, unit, expirationDate } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const cleanItem = {
      name: String(name).trim(),
      quantity: quantity ?? 1,
      unit: unit ?? "each",
      expirationDate: expirationDate || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db
      .collection("users")
      .doc(uid)
      .collection("pantryItems")
      .add(cleanItem);

    return res.status(201).json({
      item: {
        id: docRef.id,
        name: cleanItem.name,
        quantity: cleanItem.quantity,
        unit: cleanItem.unit,
        expirationDate: cleanItem.expirationDate,
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

// Update items
export const updatePantryItem = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const { id } = req.params;
    const { name, quantity, unit, expirationDate } = req.body;

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

    const updatedItem = {
      name: String(name).trim(),
      quantity: quantity ?? 1,
      unit: unit ?? "each",
      expirationDate: expirationDate || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await ref.update(updatedItem);

    return res.status(200).json({
      item: {
        id,
        name: updatedItem.name,
        quantity: updatedItem.quantity,
        unit: updatedItem.unit,
        expirationDate: updatedItem.expirationDate,
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

// Barcode lookup and save scan history
export const lookupPantryItemByBarcode = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;
    const upc = String(req.params.upc ?? "").trim();

    if (!upc) {
      return res.status(400).json({ error: "UPC is required" });
    }

    const url = `https://api.spoonacular.com/food/products/upc/${encodeURIComponent(
      upc
    )}`;

    const resp = await fetch(url, {
      headers: {
        "x-api-key": process.env.SPOONACULAR_API_KEY,
      },
    });

    const raw = await resp.text();

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error("Spoonacular returned non-JSON:", raw.slice(0, 300));
      return res.status(502).json({
        error: "Barcode API returned an invalid response",
      });
    }

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || "Failed to look up barcode",
      });
    }

    const product = {
      barcode: upc,
      spoonacularProductId: data?.id ?? null,
      itemName: data?.title ?? "",
      suggestedQuantity: 1,
      suggestedUnit: "each",
      packageSize: data?.servings?.size ?? null,
      packageUnit: data?.servings?.unit ?? null,
      servingsCount: data?.servings?.number ?? null,
      category: Array.isArray(data?.breadcrumbs)
        ? data.breadcrumbs[0] ?? null
        : null,
      ingredientList: data?.ingredientList ?? null,
      source: "spoonacular_upc",
    };

    await db.collection("scan_history").add({
      userId: uid,
      barcode: product.barcode,
      spoonacularProductId: product.spoonacularProductId,
      itemName: product.itemName,
      category: product.category,
      ingredientList: product.ingredientList,
      source: product.source,
      packageSize: product.packageSize,
      packageUnit: product.packageUnit,
      servingsCount: product.servingsCount,
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json(product);
  } catch (err) {
    console.error("lookupPantryItemByBarcode error:", err);
    return res.status(500).json({ error: "Failed to look up barcode" });
  }
};

// Get barcode scan history
export const getBarcodeScanHistory = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;

    const snapshot = await db
      .collection("scan_history")
      .where("userId", "==", uid)
      .limit(25)
      .get();

    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          scannedAtRaw: data.scannedAt?.toMillis
            ? data.scannedAt.toMillis()
            : 0,
          scannedAt: data.scannedAt?.toDate
            ? data.scannedAt.toDate().toLocaleString()
            : null,
        };
      })
      .sort((a, b) => b.scannedAtRaw - a.scannedAtRaw)
      .map(({ scannedAtRaw, ...item }) => item);

    return res.status(200).json({ items });
  } catch (err) {
    console.error("getBarcodeScanHistory error:", err);
    return res.status(500).json({ error: "Failed to fetch barcode history" });
  }
};

// Clear barcode scan history
export const clearBarcodeScanHistory = async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user.uid;

    const snapshot = await db
      .collection("scan_history")
      .where("userId", "==", uid)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ success: true, deletedCount: 0 });
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      deletedCount: snapshot.size,
    });
  } catch (err) {
    console.error("clearBarcodeScanHistory error:", err);
    return res.status(500).json({ error: "Failed to clear barcode history" });
  }
};