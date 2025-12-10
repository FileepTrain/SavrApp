import express from "express";
import admin from "firebase-admin";
import serviceAccount from "./firebaseAdminConfig.json" with { type: "json" };

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
  const { email, password } = req.body;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    res.status(201).json({
      success: true,
      uid: userRecord.uid,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(400).json({
      error: error.message,
      code: error.code,
    });
  }
});

// Update user account
app.put("/users/:uid", async (req, res) => {
  const { uid } = req.params;
  const { email, password } = req.body;

  try {
    const updatedUser = await admin.auth().updateUser(uid, {
      email,
      password,
    });

    res.json({
      success: true,
      uid: updatedUser.uid,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(400).json({
      error: error.message,
      code: error.code,
    });
  }
});

// Delete user account
app.delete("/users/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    await admin.auth().deleteUser(uid);
    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(400).json({
      error: error.message,
      code: error.code,
    });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});