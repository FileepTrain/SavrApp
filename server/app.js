import express from "express";
import admin from "firebase-admin";
import serviceAccount from "./firebaseAdminConfig.json" with { type: "json" };
import "dotenv/config";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
import ingredientRoutes from "./routes/ingredientRoutes.js";
import externalRecipeRoutes from "./routes/externalRecipeRoutes.js";
import krogerRoutes from "./routes/krogerRoutes.js";
import pantryRoutes from "./routes/pantryRoutes.js";
import spoonacularRoutes from "./routes/spoonacular.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import combinedRecipeRoutes from "./routes/combinedRecipeRoutes.js";
import groceryListRoutes from "./routes/groceryListRoutes.js";
import mealPlanRoutes from "./routes/mealPlanRoutes.js";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://savr-6ab25-default-rtdb.firebaseio.com",
  storageBucket: "savr-6ab25.firebasestorage.app",
});

const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/external-recipes", externalRecipeRoutes);
app.use("/api/kroger", krogerRoutes);
app.use("/api/pantry", pantryRoutes);
app.use("/api/spoonacular", spoonacularRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/combined-recipes", combinedRecipeRoutes);
app.use("/api/grocery-list", groceryListRoutes);
app.use("/api/meal-plans", mealPlanRoutes);

app.get("/recipe/:id", (req, res) => {
  const recipeId = String(req.params.id || "");
  const redirectTo = encodeURIComponent(`/recipe/${recipeId}`);
  const deepLink = `savr://login?redirectTo=${redirectTo}`;

  res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Open Recipe - Savr</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8f8f8; color: #1f1f1f; }
      .card { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
      h1 { margin-top: 0; font-size: 22px; }
      .btn { display: inline-block; margin-top: 12px; padding: 12px 16px; background: #e04d4d; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; }
      .muted { color: #666; margin-top: 14px; font-size: 14px; }
      code { background: #f1f1f1; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Opening recipe in Savr...</h1>
      <a class="btn" href="${deepLink}">Open in Savr</a>
      <p class="muted">If the app does not open automatically, tap the button above.</p>
      <p class="muted">Deep link: <code>${deepLink}</code></p>
    </div>
    <script>
      window.location.href = "${deepLink}";
    </script>
  </body>
</html>`);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
