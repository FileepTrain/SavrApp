import admin from "firebase-admin";
import {normalizeItem, mergeItemIntoList} from "../models/ingredientNormalizationModel.js"
import { fetchPriceForTerm } from "./krogerController.js";

const GROCERY_LIST_COLL = "grocery-lists";


/**
 * Get manual grocery list of current user; If none exists, create an empty one.
 */
export const getGroceryList = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      // Create empty list on first access
      const initialData = {
        userId: uid,
        items: [],
        totalCost: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await docRef.set(initialData);
      return res.json({ success: true, groceryList: initialData });
    }

    const data = snap.data();
    return res.json({success: true, groceryList: {...data, items: data.items.map(normalizeItem)}});

  } catch (err) {
    console.error("Error getting grocery list:", err);
    return res.status(500).json({
      error: "Failed to fetch grocery list",
      code: "FETCH_GROCERY_LIST_FAILED",
    });
  }
};


/**
 * Adds item to manual grocery list
 */
export const addItemToGroceryList = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  try {
    const { name, amount = 1, unit = "each" } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ 
        error: "Missing or invalid 'name' field" 
      });
    }
    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Grocery list not found" });
    }
    const list = snap.data();
    const items = Array.isArray(list.items) ? list.items : [];
    // Normalize
    const normalizedItem = normalizeItem({name, amount, unit});
    // Price Check
    const locationId = "70300165"
    let estimatedCost = null;
    try {
      const result = await fetchPriceForTerm(
        normalizedItem.name,
        locationId,
        5,
        "median",
        false
      );
      const price = result?.cost ?? null;
      if (price !== null) {
        estimatedCost = Number((price * normalizedItem.amount).toFixed(2));
      }
      else {price = 1.0}
    } catch (priceErr) {
      console.log("Price lookup failed:", priceErr)
    }
    normalizedItem.estimatedCost = estimatedCost;
    normalizedItem.lastPriceLookup = Date.now();
    // Merge into List
    const updatedItems = mergeItemIntoList(items, normalizedItem);
    // Total Cost Recalculation
    const totalCost = updatedItems.reduce((sum, item) => {
      return sum + (item.estimatedCost ?? 0);
    }, 0);
    // Firestore
    await docRef.update({
      items: updatedItems,
      totalCost: Number(totalCost.toFixed(2)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: "Item added to grocery list",
      item: normalizedItem
    });

  } catch (err) {
    console.error("Error adding grocery item:", err);
    return res.status(500).json({
      error: "Failed to add item",
      code: "ADD_ITEM_FAILED"
    });
  }
};


/**
 * Removes item from manual grocery list
 */
export const removeItemFromGroceryList = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { itemId } = req.params;

  try {
    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);
    const snap = await docRef.get();

    if (!itemId) {
      return res.status(400).json({ error: "Missing itemId", code: "INVALID_ITEM_ID"});
    }

    if (!snap.exists) {
      return res.status(404).json({ error: "Grocery list not found" });
    }

    const list = snap.data();
    const items = Array.isArray(list.items) ? list.items : [];

    const filtered = items.filter(item => item.id !== itemId);
    const totalCost = filtered.reduce((sum, item) => {
      return sum + (item.estimatedCost ?? 0);
    }, 0);

    await docRef.update({
      items: filtered,
      totalCost: Number(totalCost.toFixed(2)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: "Item removed from grocery list",
      removedId: itemId
    });

  } catch (err) {
    console.error("Error removing grocery item:", err);
    return res.status(500).json({
      error: "Failed to remove item",
      code: "REMOVE_ITEM_FAILED"
    });
  }
};


/**
 * Updates item from grocery list
 */
export const updateGroceryListItem = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  const { itemId } = req.params;

  try {

    const { name, amount, unit } = req.body;

    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Grocery list not found" });
    }

    const list = snap.data();
    const items = Array.isArray(list.items) ? list.items : [];

    const index = items.findIndex(item => item.id === itemId);

    if (index === -1) {
      return res.status(404).json({ error: "Item not found" });
    }

    const existing = items[index];

    // Update fields but keep previous values if not provided
    const updatedItem = normalizeItem({
      id: existing.id,
      name: name ?? existing.name,
      amount: amount ?? existing.amount,
      unit: unit ?? existing.unit
    });

    // Preserve pricing cache
    updatedItem.estimatedCost = existing.estimatedCost ?? null;
    updatedItem.lastPriceLookup = existing.lastPriceLookup ?? null;

    items[index] = updatedItem;

    await docRef.update({
      items,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: "Item updated",
      item: updatedItem
    });

  } catch (err) {

    console.error("Error updating grocery item:", err);

    return res.status(500).json({
      error: "Failed to update item",
      code: "UPDATE_ITEM_FAILED"
    });
  }
};


/**
 * Removes all items from grocery list
 */
export const clearGroceryList = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;

  try {
    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);

    await docRef.update({
      items: [],
      totalCost: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      message: "Grocery list cleared"
    });

  } catch (err) {
    console.error("Error clearing grocery list:", err);

    return res.status(500).json({
      error: "Failed to clear grocery list",
      code: "CLEAR_LIST_FAILED"
    });
  }
};

/**
 * Calculate estimated cost of all items grocery list
 */
export const calculateGroceryListPrice = async (req, res) => {
  const db = admin.firestore();
  const { uid } = req.user;
  try {
    const docRef = db.collection(GROCERY_LIST_COLL).doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Grocery list not found" });
    }

    const list = snap.data();
    const items = Array.isArray(list.items) ? list.items : [];

    if (items.length === 0) {
      return res.json({
        success: true,
        totalCost: 0,
        items: []
      });
    }

    const locationId = "70300165"; // temp

    let totalCost = 0;

    for (const item of items) {

      const result = await fetchPriceForTerm(
        item.name,
        locationId,
        5,
        "median",
        false
      );

      const price = result?.cost ?? null;

      if (price !== null) {
        item.estimatedCost = Number((price * item.amount).toFixed(2));
        item.lastPriceLookup = Date.now();

        totalCost += item.estimatedCost;
      }
    }

    totalCost = Number(totalCost.toFixed(2));

    await docRef.update({
      items,
      totalCost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      totalCost,
      items
    });

  } catch (err) {

    console.error("Error calculating grocery list price:", err);

    return res.status(500).json({
      error: "Failed to calculate grocery list price",
      code: "PRICE_CALCULATION_FAILED"
    });
  }
};