import express from "express";
import admin from "firebase-admin";
import serviceAccount from "./firebaseAdminConfig.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
