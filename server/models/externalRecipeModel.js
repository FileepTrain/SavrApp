// models/externalRecipeModel.js
import admin from "firebase-admin";

const COLL = "external_recipes";

function getDb() {
  return admin.firestore();
}

function makeDocId(externalSource, externalId) {
  return `${externalSource}_${String(externalId)}`;
}

function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 50);
}

async function findByExternal(externalSource, externalId) {
  if (!externalSource || !externalId) return null;

  const db = getDb();
  const docId = makeDocId(externalSource, externalId);
  const snap = await db.collection(COLL).doc(docId).get();

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

async function searchCachedByTitle(externalSource, q, limit = 10) {
  const db = getDb();
  const query = (q ?? "").trim().toLowerCase();
  if (!query) return [];

  const tokens = query
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);

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
      id: Number(data.externalId),
      title: data.title ?? null,
      image: data.image ?? null,
      summary: data.summary ?? null,
      _cached: true,
      _docId: d.id,
    };
  });
}

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
      simplified.readyInMinutes !== undefined && simplified.readyInMinutes !== null
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

// Home feed get latest cached recipes
async function getLatestCached(limit = 20) {
  const db = getDb();

  const snap = await db
    .collection(COLL)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: Number(data.externalId),
      title: data.title ?? null,
      image: data.image ?? null,
      summary: data.summary ?? null,
      _cached: true,
      _docId: d.id,
    };
  });
}

export default {
  findByExternal,
  searchCachedByTitle,
  upsertFromExternal,
  getLatestCached,
};