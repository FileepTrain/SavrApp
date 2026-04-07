// models/externalRecipeModel.js
import admin from "firebase-admin";
import {
  galleryImagesForApiResponse,
  normalizeGalleryImagesArray,
} from "../utils/recipeGalleryNormalize.js";

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

  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const reviewCount = Number.isFinite(Number(data.reviewCount)) ? Number(data.reviewCount) : reviews.length;
  const totalStars = Number.isFinite(Number(data.totalStars)) ? Number(data.totalStars) : reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0);
  const viewCount = Number.isFinite(Number(data.viewCount)) ? Number(data.viewCount) : 0;

  const galleryNorm = normalizeGalleryImagesArray(
    data.galleryImages,
    data.userId || null,
  );
  const galleryImages = galleryImagesForApiResponse(galleryNorm);

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
    equipment: data.equipment ?? [],
    nutrition: data.nutrition ?? null,
    calories: data.calories ?? null,
    dishTypes: data.dishTypes ?? null,
    diets: data.diets ?? null,
    cuisines: data.cuisines ?? null,
    price: typeof data.price === "number" ? data.price : null,
    reviewCount,
    totalStars,
    viewCount,
    galleryImages,
    _docId: docId,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

async function incrementViewCount(externalSource, externalId) {
  if (!externalSource || !externalId) return;
  const db = getDb();
  const docId = makeDocId(externalSource, externalId);
  const docRef = db.collection(COLL).doc(docId);
  await docRef.set(
    { viewCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
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
      price: typeof data.price === "number" ? data.price : null,
      _cached: true,
      _docId: d.id,
    };
  });
}

function equipmentNames(equipment) {
  const arr = Array.isArray(equipment) ? equipment : [];
  return arr
    .map((e) => (typeof e === "string" ? e : (e && e.name) || ""))
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());
}

/**
 * Search cached external_recipes by query and return items in combined-feed shape.
 * Supports budget and cookware filters.
 */
async function searchCachedForFeed(
  externalSource,
  q,
  limit = 10,
  offset = 0,
  budgetMin = 0,
  budgetMax = 100,
  excludeCookware = [],
  userCookware = null,
) {
  const db = getDb();
  const query = (q ?? "").trim().toLowerCase();
  if (!query) return { results: [], totalResults: 0 };

  const tokens = query
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);
  const tokenQuery = tokens.length ? tokens : [query];

  const fetchSize = Math.min(offset + Math.max(limit, 20), 100);
  const snap = await db
    .collection(COLL)
    .where("externalSource", "==", externalSource)
    .where("titleTokens", "array-contains-any", tokenQuery)
    .limit(fetchSize)
    .get();

  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const userSet = userCookware && userCookware.length > 0
    ? new Set(userCookware.map((c) => String(c).toLowerCase().trim()))
    : null;
  // When My cookware is on, only exclude cookware the user HAS (so adding "bowl" when user doesn't have bowl does nothing extra)
  const effectiveExclude = userSet
    ? (excludeCookware || []).filter((c) => userSet.has(String(c).toLowerCase().trim()))
    : (excludeCookware || []);
  const excludeSet = new Set(effectiveExclude.map((c) => String(c).toLowerCase().trim()));

  const budgetFilter = (r) => {
    const price = r.price;
    if (price != null && typeof price === "number") {
      if (price < budgetMin || price > budgetMax) return false;
    }
    return true;
  };
  const cookwareFilter = (r) => {
    const names = equipmentNames(r.equipment);
    if (excludeSet.size > 0 && names.some((n) => excludeSet.has(n))) return false;
    if (userSet && names.length > 0 && names.some((n) => !userSet.has(n))) return false;
    return true;
  };
  const filtered = docs.filter((r) => budgetFilter(r) && cookwareFilter(r));
  filtered.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
  const sliced = filtered.slice(offset, offset + limit);

  const results = sliced.map((data) => {
    const reviewCount = Number.isFinite(Number(data.reviewCount)) ? Number(data.reviewCount) : (Array.isArray(data.reviews) ? data.reviews.length : 0);
    const totalStars = Number.isFinite(Number(data.totalStars)) ? Number(data.totalStars) : (Array.isArray(data.reviews) ? data.reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0) : 0);
    const rating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;
    // Use top-level calories, or fallback to nutrition.nutrients Calories (recipe details use this)
    let calories = data.calories != null ? data.calories : null;
    if (calories == null && Array.isArray(data.nutrition?.nutrients)) {
      const cal = data.nutrition.nutrients.find((n) => String(n?.name || "").toLowerCase() === "calories");
      if (cal?.amount != null) calories = Math.round(Number(cal.amount));
    }
    return {
      id: Number(data.externalId),
      title: data.title ?? null,
      image: data.image ?? null,
      calories: calories ?? null,
      price: typeof data.price === "number" ? data.price : null,
      rating,
      reviewsLength: reviewCount,
      viewCount: Number.isFinite(Number(data.viewCount)) ? Number(data.viewCount) : 0,
    };
  });

  return {
    results,
    totalResults: filtered.length,
    _meta: { cachedCount: results.length, offset },
  };
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
    equipment: simplified.equipment ?? [],
    nutrition: simplified.nutrition ?? null,
    calories: simplified.calories ?? null,
    dishTypes: simplified.dishTypes ?? null,
    diets: simplified.diets ?? null,
    cuisines: simplified.cuisines ?? null,
    price: simplified.price ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await docRef.set(
    {
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
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
    let calories = data.calories != null ? data.calories : null;
    if (calories == null && Array.isArray(data.nutrition?.nutrients)) {
      const cal = data.nutrition.nutrients.find((n) => String(n?.name || "").toLowerCase() === "calories");
      if (cal?.amount != null) calories = Math.round(Number(cal.amount));
    }
    return {
      id: Number(data.externalId),
      title: data.title ?? null,
      image: data.image ?? null,
      calories: calories ?? null,
      price: typeof data.price === "number" ? data.price : null,
      viewCount: Number.isFinite(Number(data.viewCount)) ? Number(data.viewCount) : 0,
      equipment: data.equipment ?? [],
      _cached: true,
      _docId: d.id,
    };
  });
}

/**
 * Search cached external recipes by dishTypes.
 * Uses Firestore array-contains-any to compare against normalized dish type values
 * Returns all recipe details needed to display a recipe card
 */
async function searchCachedByDishTypes(
  externalSource,
  dishTypes = [],
  limit = 20,
) {
  const db = getDb();
  const normalizedDishTypes = Array.isArray(dishTypes)
    ? dishTypes
      .map((s) => String(s).toLowerCase().trim())
      .filter(Boolean)
    : [];

  if (!externalSource || normalizedDishTypes.length === 0) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const snap = await db
    .collection(COLL)
    .where("externalSource", "==", externalSource)
    .where("dishTypes", "array-contains-any", normalizedDishTypes.slice(0, 10))
    .limit(safeLimit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    const reviewCount = Number.isFinite(Number(data.reviewCount))
      ? Number(data.reviewCount)
      : (Array.isArray(data.reviews) ? data.reviews.length : 0);
    const totalStars = Number.isFinite(Number(data.totalStars))
      ? Number(data.totalStars)
      : (Array.isArray(data.reviews)
        ? data.reviews.reduce((s, r) => s + (r && r.rating ? r.rating : 0), 0)
        : 0);
    const rating = reviewCount > 0
      ? Math.round((totalStars / reviewCount) * 10) / 10
      : 0;

    let calories = data.calories != null ? data.calories : null;
    if (calories == null && Array.isArray(data.nutrition?.nutrients)) {
      const cal = data.nutrition.nutrients.find(
        (n) => String(n?.name || "").toLowerCase() === "calories",
      );
      if (cal?.amount != null) calories = Math.round(Number(cal.amount));
    }

    return {
      id: Number(data.externalId),
      title: data.title ?? null,
      image: data.image ?? null,
      calories: calories ?? null,
      //price: typeof data.price === "number" ? data.price : null,
      rating,
      reviewsLength: reviewCount,
      viewCount: Number.isFinite(Number(data.viewCount))
        ? Number(data.viewCount)
        : 0,
      dishTypes: Array.isArray(data.dishTypes) ? data.dishTypes : [],
    };
  });
}

export default {
  findByExternal,
  searchCachedByTitle,
  searchCachedForFeed,
  searchCachedByDishTypes,
  upsertFromExternal,
  getLatestCached,
  incrementViewCount,
};
