import admin from "firebase-admin";

const DEFAULT_PRIVACY = {
  showFavorites: true,
  showCollections: true,
  showMealPlans: true,
};

function baseUsernameFromAuth(email, displayName) {
  const emailStr = typeof email === "string" ? email : "";
  if (displayName && String(displayName).trim()) {
    return String(displayName).trim();
  }
  const local = emailStr.split("@")[0];
  return local && local.trim() ? local.trim() : `user_${Date.now().toString(36)}`;
}

/**
 * Ensures usernames/{username} maps to uid. If the name is taken by another uid,
 * picks an alternate username and updates users/{uid}.
 */
async function ensureUsernameMapping(db, uid, preferredUsername) {
  let username =
    typeof preferredUsername === "string" && preferredUsername.trim()
      ? preferredUsername.trim()
      : `user_${uid.slice(0, 8)}`;

  for (let attempt = 0; attempt < 12; attempt++) {
    const ref = db.collection("usernames").doc(username);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("users").doc(uid).set({ username }, { merge: true });
      return username;
    }
    const mapped = snap.data()?.uid;
    if (mapped === uid) {
      await db.collection("users").doc(uid).set({ username }, { merge: true });
      return username;
    }
    username =
      attempt === 0
        ? `${preferredUsername.trim()}_${uid.slice(0, 6)}`
        : `${preferredUsername.trim()}_${uid.slice(0, 6)}_${attempt}`;
  }
  throw new Error("Could not allocate a unique username mapping");
}

function buildRepairs(d, { email, displayName, forceFullRepair }) {
  const emailStr = typeof email === "string" ? email : "";
  const repairs = {};
  const existing = d && typeof d === "object" ? d : {};

  if (emailStr && (!existing.email || forceFullRepair)) {
    repairs.email = emailStr;
  }

  const hasValidUsername =
    typeof existing.username === "string" && existing.username.trim();
  if (!hasValidUsername) {
    repairs.username = baseUsernameFromAuth(emailStr, displayName);
  }

  if (!Array.isArray(existing.favoriteIds) || forceFullRepair) {
    repairs.favoriteIds = Array.isArray(existing.favoriteIds)
      ? existing.favoriteIds
      : [];
  }

  if (!Array.isArray(existing.cookware) || forceFullRepair) {
    repairs.cookware = Array.isArray(existing.cookware) ? existing.cookware : [];
  }
  if (!Array.isArray(existing.allergies) || forceFullRepair) {
    repairs.allergies = Array.isArray(existing.allergies)
      ? existing.allergies
      : [];
  }
  if (!Array.isArray(existing.diets) || forceFullRepair) {
    repairs.diets = Array.isArray(existing.diets) ? existing.diets : [];
  }
  if (
    typeof existing.budget !== "number" ||
    Number.isNaN(existing.budget) ||
    forceFullRepair
  ) {
    repairs.budget =
      typeof existing.budget === "number" && !Number.isNaN(existing.budget)
        ? existing.budget
        : 0;
  }
  if (!Array.isArray(existing.nutrientDisplay) || forceFullRepair) {
    repairs.nutrientDisplay = Array.isArray(existing.nutrientDisplay)
      ? existing.nutrientDisplay
      : [];
  }
  if (typeof existing.locationEnabled !== "boolean" || forceFullRepair) {
    repairs.locationEnabled =
      typeof existing.locationEnabled === "boolean"
        ? existing.locationEnabled
        : false;
  }

  const pp = existing.profilePrivacy;
  if (!pp || typeof pp !== "object") {
    repairs.profilePrivacy = { ...DEFAULT_PRIVACY };
  } else if (forceFullRepair) {
    repairs.profilePrivacy = {
      showFavorites: pp.showFavorites !== false,
      showCollections: pp.showCollections !== false,
      showMealPlans: pp.showMealPlans !== false,
    };
  }

  return repairs;
}

/**
 * Creates or merges a users/{uid} document from Firebase Auth context.
 * Use on login (self-heal) or from admin scripts after partial data loss.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ uid: string, email?: string, displayName?: string, treatMissingDocAsReturningUser?: boolean, forceFullRepair?: boolean }} opts
 */
export async function ensureUserFirestoreFromAuth(db, opts) {
  const {
    uid,
    email,
    displayName,
    treatMissingDocAsReturningUser = true,
    forceFullRepair = false,
  } = opts;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const emailStr = typeof email === "string" ? email : "";

  if (!userSnap.exists) {
    const usernameBase = baseUsernameFromAuth(emailStr, displayName);
    const patch = {
      email: emailStr,
      username: usernameBase,
      onboarding: false,
      onboarded: treatMissingDocAsReturningUser,
      favoriteIds: [],
      cookware: [],
      allergies: [],
      diets: [],
      budget: 0,
      nutrientDisplay: [],
      locationEnabled: false,
      profilePrivacy: { ...DEFAULT_PRIVACY },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(patch, { merge: true });
    await ensureUsernameMapping(db, uid, usernameBase);
    const fresh = await userRef.get();
    return fresh.data() || {};
  }

  const d = userSnap.data() || {};
  const repairs = buildRepairs(d, { email, displayName, forceFullRepair });

  if (typeof d.onboarded !== "boolean" && typeof d.onboarding !== "boolean") {
    repairs.onboarded = treatMissingDocAsReturningUser;
    repairs.onboarding = false;
  }

  let finalUsername =
    typeof repairs.username === "string" && repairs.username.trim()
      ? repairs.username.trim()
      : typeof d.username === "string" && d.username.trim()
        ? d.username.trim()
        : baseUsernameFromAuth(emailStr, displayName);

  if (Object.keys(repairs).length > 0) {
    repairs.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(repairs, { merge: true });
    if (repairs.username) finalUsername = repairs.username.trim();
  }

  await ensureUsernameMapping(db, uid, finalUsername);

  const afterSnap = await userRef.get();
  return afterSnap.data() || {};
}
