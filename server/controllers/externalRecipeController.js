export const searchExternalRecipes = async (req, res) => {
  try {
    const q = (req.query.q ?? "").trim();
    const number = Math.min(parseInt(req.query.number ?? "10", 10), 20);
    const offset = Math.max(parseInt(req.query.offset ?? "0", 10), 0);

    if (!q) {
      return res.status(400).json({
        error: "Missing query parameter: q",
        code: "MISSING_QUERY",
      });
    }

    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    url.searchParams.set("query", q);
    url.searchParams.set("number", String(number));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("addRecipeInformation", "false");
    url.searchParams.set("instructionsRequired", "true");

    const resp = await fetch(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = await resp.json();

    // Forward quota headers if present (helps you debug 50 points)
    const quotaLeft = resp.headers.get("x-api-quota-left");
    if (quotaLeft) res.set("x-api-quota-left", quotaLeft);

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || "Spoonacular request failed",
        code: "SPOONACULAR_ERROR",
        details: data,
      });
    }

    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("Error searching Spoonacular:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      code: "EXTERNAL_SEARCH_FAILED",
    });
  }
};
