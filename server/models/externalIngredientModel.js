// models/externalIngredientModel.js
import admin from "firebase-admin";

const COLL = "external_ingredients";

/**
 * IMPORTANT:
 * We intentionally DO NOT call admin.firestore() at the top level.
 * This avoids Firebase "no-app" errors caused by ESM import order.
 */
function getDb() {
  return admin.firestore();
}

/**
 * Deterministic document id:
 *   `${externalSource}_${ingredientId}`
 * e.g. "spoonacular_1123"
 */
function makeDocId(externalSource, ingredientId) {
  return `${externalSource}_${String(ingredientId)}`;
}

/**
 * Upsert one ingredient master doc.
 * Accepts a Spoonacular extendedIngredient (or partial) object.
 */
async function upsertFromExternal(externalSource, ingredient) {
  if (!externalSource || !ingredient?.id) {
    throw new Error("Missing args for upsertFromExternal (ingredient)");
  }

  const db = getDb();
  const docId = makeDocId(externalSource, ingredient.id);
  const docRef = db.collection(COLL).doc(docId);

  const payload = {
    externalSource,
    externalId: String(ingredient.id),

    // useful master fields (some may be missing in extendedIngredients)
    name: ingredient.name ?? ingredient.originalName ?? null,
    image: ingredient.image ?? null,
    aisle: ingredient.aisle ?? null,
    consistency: ingredient.consistency ?? null,
    possibleUnits: Array.isArray(ingredient.possibleUnits)
      ? ingredient.possibleUnits
      : [],

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(
    {
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { docId };
}

/**
 * Batch upsert many ingredients.
 * De-dupes by ingredient id.
 */
async function upsertManyFromExternal(externalSource, ingredients = []) {
  const db = getDb();

  // De-dupe by id
  const map = new Map();
  for (const ing of ingredients) {
    if (!ing?.id) continue;
    map.set(String(ing.id), ing);
  }
  const unique = Array.from(map.values());

  if (unique.length === 0) return { upserted: 0 };

  // Firestore batch limit: 500 ops/batch
  const CHUNK_SIZE = 400;
  let upserted = 0;

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const ing of chunk) {
      const docId = makeDocId(externalSource, ing.id);
      const ref = db.collection(COLL).doc(docId);

      batch.set(
        ref,
        {
          externalSource,
          externalId: String(ing.id),
          name: ing.name ?? ing.originalName ?? null,
          image: ing.image ?? null,
          aisle: ing.aisle ?? null,
          consistency: ing.consistency ?? null,
          possibleUnits: Array.isArray(ing.possibleUnits) ? ing.possibleUnits : [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      upserted += 1;
    }

    await batch.commit();
  }

  return { upserted };
}

/**
 * Find ingredient by external source + ingredient id.
 */
async function findByExternal(externalSource, ingredientId) {
  if (!externalSource || !ingredientId) return null;

  const db = getDb();
  const docId = makeDocId(externalSource, ingredientId);
  const snap = await db.collection(COLL).doc(docId).get();

  if (!snap.exists) return null;

  const data = snap.data();
  return {
    id: Number(data.externalId ?? ingredientId),
    name: data.name ?? null,
    image: data.image ?? null,
    aisle: data.aisle ?? null,
    consistency: data.consistency ?? null,
    possibleUnits: data.possibleUnits ?? [],
    _docId: snap.id,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export default {
  upsertFromExternal,
  upsertManyFromExternal,
  findByExternal,
};
