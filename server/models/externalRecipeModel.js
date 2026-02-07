// models/externalRecipeModel.js
import admin from "firebase-admin";

const COLL = "external_recipes";

/**
 * IMPORTANT:
 * We intentionally DO NOT call admin.firestore() at the top level.
 * This avoids Firebase "no-app" errors caused by ESM import order.
 */
function getDb() {
  return admin.firestore();
}

/**
 * Deterministic document id for an external recipe:
 *   `${externalSource}_${externalId}`
 * e.g. "spoonacular_716429"
 */
function makeDocId(externalSource, externalId) {
  return `${externalSource}_${String(externalId)}`;
}

/**
 * Create a stable set of search tokens from a string.
 * Firestore can't do substring full-text search, so we store tokens to query with
 * array-contains-any.
 */
function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 50); // keep bounded
}

/**
 * Find an external recipe by source + external id.
 * Returns the simplified Spoonacular-shaped object or null.
 */
async function findByExternal(externalSource, externalId) {
  if (!externalSource || !externalId) return null;

  const db = getDb();
  const docId = makeDocId(externalSource, externalId);
  const docRef = db.collection(COLL).doc(docId);
  const snap = await docRef.get();

  if (!snap.exists) return null;

  const data = snap.data();

  return {
    id: String(data.externalId ?? externalId),
    title: data.title ?? null,
    image: data.image ?? null,
    sourceUrl: data.sourceUrl ?? null,
    readyInMinutes: data.readyInMinutes ?? null,
    servings: data.servings ?? null,
    summary: data.summary ?? null,
    instructions: data.instructions ?? null,
    extendedIngredients: data.extendedIngredients ?? [],
    nutrition: data.nutrition ?? null,
    dishTypes: data.dishTypes ?? null,
    diets: data.diets ?? null,
    cuisines: data.cuisines ?? null,
    _docId: docId,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Search cached external recipes (stored from Spoonacular) before calling Spoonacular.
 * Uses titleTokens (array) generated at save-time.
 *
 * NOTE:
 * - array-contains-any supports max 10 values
 * - this is OR-matching (not ranked relevance)
 */
async function searchCachedByTitle(externalSource, q, limit = 10) {
  const db = getDb();
  const query = (q ?? "").trim().toLowerCase();
  if (!query) return [];

  const tokens = query
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);

  // If user typed something like "bbq", tokens may be ["bbq"] (fine).
  // If somehow empty after cleaning, fall back to the raw query.
  const tokenQuery = tokens.length ? tokens : [query];

  const snap = await db
    .collection(COLL)
    .where("externalSource", "==", externalSource)
    .where("titleTokens", "array-contains-any", tokenQuery)
    .limit(limit)
    .get();


  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: Number(data.externalId), // keep numeric for your existing frontend routes
      title: data.title ?? null,
      image: data.image ?? null,
      _cached: true,
      _docId: d.id,
    };
  });
}

/**
 * Create or update (UPSERT) an external recipe.
 * Stores Spoonacular data exactly as simplified by the controller.
 * Also stores titleLower + titleTokens for search.
 */
async function upsertFromExternal(externalSource, externalId, simplified) {
  if (!externalSource || !externalId || !simplified) {
    throw new Error("Missing args for upsertFromExternal");
  }

  const db = getDb();
  const docId = makeDocId(externalSource, externalId);
  const docRef = db.collection(COLL).doc(docId);

  const title = simplified.title ?? null;
  const titleLower = (title ?? "").toLowerCase();
  const titleTokens = tokenize(title ?? "");

  const payload = {
    externalSource,
    externalId: String(externalId),

    title,
    titleLower,
    titleTokens,

    image: simplified.image ?? null,
    sourceUrl: simplified.sourceUrl ?? null,
    readyInMinutes:
      simplified.readyInMinutes !== undefined &&
      simplified.readyInMinutes !== null
        ? Number(simplified.readyInMinutes)
        : null,
    servings:
      simplified.servings !== undefined && simplified.servings !== null
        ? Number(simplified.servings)
        : null,
    summary: simplified.summary ?? null,
    instructions: simplified.instructions ?? null,
    extendedIngredients: simplified.extendedIngredients ?? [],
    nutrition: simplified.nutrition ?? null,
    dishTypes: simplified.dishTypes ?? null,
    diets: simplified.diets ?? null,
    cuisines: simplified.cuisines ?? null,
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
 * Create-only helper (throws if already exists).
 * Optional — not required for your current flow.
 */
async function createFromExternal(externalSource, externalId, simplified) {
  const db = getDb();
  const docId = makeDocId(externalSource, externalId);
  const docRef = db.collection(COLL).doc(docId);

  const snap = await docRef.get();
  if (snap.exists) {
    throw new Error("External recipe already exists");
  }

  const title = simplified.title ?? null;
  const titleLower = (title ?? "").toLowerCase();
  const titleTokens = tokenize(title ?? "");

  const payload = {
    externalSource,
    externalId: String(externalId),

    title,
    titleLower,
    titleTokens,

    image: simplified.image ?? null,
    sourceUrl: simplified.sourceUrl ?? null,
    readyInMinutes: simplified.readyInMinutes ?? null,
    servings: simplified.servings ?? null,
    summary: simplified.summary ?? null,
    instructions: simplified.instructions ?? null,
    extendedIngredients: simplified.extendedIngredients ?? [],
    nutrition: simplified.nutrition ?? null,
    dishTypes: simplified.dishTypes ?? null,
    diets: simplified.diets ?? null,
    cuisines: simplified.cuisines ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(payload, { merge: false });
  return { docId };
}

export default {
  findByExternal,
  searchCachedByTitle,
  upsertFromExternal,
  createFromExternal,
};
