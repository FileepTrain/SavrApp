import express from "express";
import admin from "firebase-admin";
import axios from "axios";
import dotenv from "dotenv";
import serviceAccount from "./firebaseAdminConfig.json" with { type: "json" };

dotenv.config();

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://savr-6ab25-default-rtdb.firebaseio.com"
});

const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/users", async (req, res) => {
  const db = admin.firestore();

  try {
    const snapshot = await db.collection("testCollection").get();
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

app.post("/check-username", async (req, res) => {
  const { username } = req.body;
  const db = admin.firestore();

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const usernameDoc = await db.collection("usernames").doc(username).get();

    if (usernameDoc.exists) {
      return res.json({ available: false });
    } else {
      return res.json({ available: true });
    }
  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});


app.post("/users", async (req, res) => {
  const db = admin.firestore();

  try {
    const data = req.body;

    const docRef = await db.collection("testCollection").add(data);

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Document added successfully",
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Register user account
app.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  const db = admin.firestore();

  if (!email || !password || !username) {
    return res.status(400).json({
      error: "Email, password, and username are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // 1) Check if username is already taken
    const usernameDocRef = db.collection("usernames").doc(username);
    const usernameDoc = await usernameDocRef.get();

    if (usernameDoc.exists) {
      return res.status(400).json({
        error: "Username is already taken",
        code: "USERNAME_TAKEN",
      });
    }

    // 2) Create auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username, // store username here too
    });

    const uid = userRecord.uid;

    const batch = db.batch();

    // 3) Store in users → holds all info
    batch.set(db.collection("users").doc(uid), {
      email,
      username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4) Store username → uid mapping (minimal Firestore)
    batch.set(usernameDocRef, {
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Thomas put the code to your 
    // User document creation stuff here
    // 
    //
    //

    res.status(201).json({
      success: true,
      uid: userRecord.uid,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(400).json({
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Login user
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    const firebaseResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );

    const { idToken, refreshToken, localId, displayName } = firebaseResponse.data;

    res.json({
      success: true,
      uid: localId,
      idToken,
      refreshToken,
      email,
      username: displayName, // now matches your displayName=username
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error logging in:", error.response?.data || error.message);
    const fbError = error.response?.data?.error?.message || "LOGIN_FAILED";

    res.status(400).json({
      error: fbError,
      code: fbError,
    });
  }
});



// Update user account
app.put("/update-account", async (req, res) => {
  const { idToken, email, password, username } = req.body;

  if (!idToken) {
    return res.status(400).json({
      error: "idToken is required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // 1. Verify token → get UID of the user making the request
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Update only allowed fields    (ONLY UPDATES FIREBASE AUTH)
    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (username) updateData.displayName = username;

    // 3. Update the Firebase Auth user
    const updatedUser = await admin.auth().updateUser(uid, updateData);

    // 4. Update Firestore DB
    const firestoreUpdate = {};
    if (email) firestoreUpdate.email = email;
    if (username) firestoreUpdate.username = username;

    if (Object.keys(firestoreUpdate).length > 0){ //only updates if anything changed, brought by the great GPT
      await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .set(
        {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          email,
          username,
        },
        {merge:true}
      );
    }

    res.json({
      success: true,
      uid: updatedUser.uid,
      message: "Account updated successfully",
    });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(400).json({
      error: error.message,
      code: error.code || "UPDATE_FAILED",
    });
  }
});

// Delete user account
app.delete("/delete-account", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      error: "idToken is required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // 1. Verify token to identify the user
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Delete firestore db data
    await admin.firestore().collection("users").doc(uid).delete();

    // 3. Delete the authenticated user
    await admin.auth().deleteUser(uid);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(400).json({
      error: error.message,
      code: error.code || "DELETE_FAILED",
    });
  }
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});