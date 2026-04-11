/**
 * One-off repair for a Firestore users/{uid} document after partial data loss.
 * Uses Firebase Auth for email / displayName and merges safe defaults.
 *
 * From the server directory (with firebaseAdminConfig.json present):
 *   node scripts/repair-user-document.js <firebaseUid>
 *
 * Example:
 *   node scripts/repair-user-document.js UoeUY5wtZmg6rocAySwGsvdUTIm2
 */

import admin from "firebase-admin";
import serviceAccount from "../firebaseAdminConfig.json" with { type: "json" };
import { ensureUserFirestoreFromAuth } from "../utils/ensureUserFirestoreRecord.js";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://savr-6ab25-default-rtdb.firebaseio.com",
  storageBucket: "savr-6ab25.firebasestorage.app",
});

const uid = process.argv[2]?.trim();
if (!uid) {
  console.error("Usage: node scripts/repair-user-document.js <firebaseUid>");
  process.exit(1);
}

try {
  const user = await admin.auth().getUser(uid);
  const db = admin.firestore();
  const data = await ensureUserFirestoreFromAuth(db, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    treatMissingDocAsReturningUser: true,
    forceFullRepair: true,
  });
  console.log("OK — user document repaired:", {
    uid: user.uid,
    email: data.email,
    username: data.username,
    onboarded: data.onboarded,
  });
  process.exit(0);
} catch (e) {
  console.error("Repair failed:", e.message || e);
  process.exit(1);
}
