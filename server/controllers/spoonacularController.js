// controllers/spoonacularController.js
import axios from "axios";

const API_BASE = "https://api.spoonacular.com";

/**
 * GET /api/spoonacular/ingredients/autocomplete?q=...&number=...
 * Returns: { success: true, results: [{ id, name, image }] }
 *
 * NOTE:
 * We use /food/ingredients/search because it reliably returns IDs.
 * (Your current response is missing ids and is stringified.)
 */
export const autocompleteIngredients = async (req, res) => {
  try {
    const q = (req.query.q ?? "").trim();
    const number = Math.min(parseInt(req.query.number ?? "10", 10) || 10, 25);

    if (!q) return res.status(400).json({ error: "Missing query parameter: q" });

    const url = `${API_BASE}/food/ingredients/search`;

    const resp = await axios.get(url, {
      params: { query: q, number },
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    // Spoonacular returns: { results: [...], offset, number, totalResults }
    const raw = resp.data?.results;
    const results = Array.isArray(raw)
      ? raw
          .filter((x) => x && (typeof x.id === "number" || typeof x.id === "string") && x.name)
          .map((x) => ({
            id: Number(x.id),
            name: String(x.name),
            image: x.image ? String(x.image) : null,
          }))
      : [];

    return res.json({ success: true, results });
  } catch (error) {
    const status = error?.response?.status || 500;
    const spoonMsg = error?.response?.data?.message;

    console.error("autocompleteIngredients error:", error?.response?.data || error?.message || error);

    return res.status(status).json({
      error: spoonMsg || error.message || "Spoonacular request failed",
      code: "AUTOCOMPLETE_FAILED",
    });
  }
};

/**
 * GET /api/spoonacular/ingredients/:id
 * Returns: { success: true, ingredient: { id, possibleUnits: [...] } }
 */
export const getIngredientInfo = async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();

    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid ingredient id" });
    }

    const url = `${API_BASE}/food/ingredients/${encodeURIComponent(id)}/information`;

    const resp = await axios.get(url, {
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const data = resp.data;

    return res.json({
      success: true,
      ingredient: {
        id: data.id,
        name: data.name ?? null,
        image: data.image ?? null,
        possibleUnits: Array.isArray(data.possibleUnits) ? data.possibleUnits : [],
      },
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const spoonMsg = error?.response?.data?.message;

    console.error("getIngredientInfo error:", error?.response?.data || error?.message || error);

    return res.status(status).json({
      error: spoonMsg || error.message || "Spoonacular request failed",
      code: "INGREDIENT_INFO_FAILED",
    });
  }
};
