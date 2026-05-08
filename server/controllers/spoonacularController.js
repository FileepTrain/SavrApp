// controllers/spoonacularController.js
import axios from "axios";
import {
  convertUnit,
  normalizeUnit,
} from "../models/ingredientNormalizationModel.js";

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

    console.log("[Spoonacular] GET /food/ingredients/search", { query: q, number });

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

    console.log("[Spoonacular] GET /food/ingredients/:id/information", { id });

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

// ---------------------------------------------------------------------------
// Helpers for getIngredientSubstitutes
// ---------------------------------------------------------------------------

/** Parse a fraction string ("7/8", "1/2") or decimal/integer into a number. */
function parseFraction(str) {
  if (!str) return NaN;
  const s = String(str).trim();
  if (s.includes("/")) {
    const [num, den] = s.split("/").map(Number);
    return Number.isFinite(num) && Number.isFinite(den) && den !== 0
      ? num / den
      : NaN;
  }
  return Number(s);
}

/**
 * Round to at most 4 significant decimal places, stripping trailing zeros.
 * e.g. 1.75000 → 1.75, 0.3333333 → 0.3333
 */
function roundAmount(n) {
  return parseFloat(n.toFixed(4));
}

/**
 * Parse one substitution string of the form:
 *   "{refAmount} {refUnit} = {part1} and {part2} + ..."
 *
 * Returns { refAmount, refUnit, parts: [{ name, amount, unit }] } or null on failure.
 */
function parseSubstituteString(raw) {
  const eqIdx = raw.indexOf("=");
  if (eqIdx === -1) return null;

  const refSide = raw.slice(0, eqIdx).trim();
  const subSide = raw.slice(eqIdx + 1).trim();

  // Parse reference side: "{amount} {unit}"
  const refMatch = refSide.match(/^([\d\/\.]+)\s+(.+)$/);
  if (!refMatch) return null;
  const refAmount = parseFraction(refMatch[1]);
  const refUnit = refMatch[2].trim();
  if (!Number.isFinite(refAmount)) return null;

  // Split substitute side on " and {digit}" or " + {digit}" (lookahead for digit to avoid splitting ingredient names)
  const rawParts = subSide.split(/\s+and\s+(?=[\d])|(?:\s+\+\s+)(?=[\d])/);

  const parts = [];
  for (const part of rawParts) {
    const m = part.trim().match(/^([\d\/\.]+)\s+(\S+)\s+(.+)$/);
    if (!m) continue;
    const amount = parseFraction(m[1]);
    if (!Number.isFinite(amount)) continue;
    parts.push({ amount, unit: m[2].trim(), name: m[3].trim() });
  }

  if (parts.length === 0) return null;
  return { refAmount, refUnit, parts };
}

/**
 * Scale parsed substitute parts to match the recipe ingredient's amount+unit.
 * Returns { parts, scalingApplied }.
 */
function scaleSubstitute(parsed, ingAmount, ingUnit) {
  const normRef = normalizeUnit(parsed.refUnit);
  const normIng = normalizeUnit(ingUnit);

  // Convert the reference amount into the ingredient's units
  const refInIngUnits = convertUnit(parsed.refAmount, normRef, normIng);

  if (refInIngUnits === null || refInIngUnits === 0) {
    // Incompatible unit categories or zero ref — return unscaled
    return {
      scalingApplied: false,
      parts: parsed.parts.map((p) => ({
        name: p.name,
        amount: roundAmount(p.amount),
        unit: normalizeUnit(p.unit),
      })),
    };
  }

  const scaleFactor = ingAmount / refInIngUnits;
  return {
    scalingApplied: true,
    parts: parsed.parts.map((p) => ({
      name: p.name,
      amount: roundAmount(p.amount * scaleFactor),
      unit: normalizeUnit(p.unit),
    })),
  };
}

// ---------------------------------------------------------------------------

/**
 * GET /api/spoonacular/ingredient-substitutes
 * Query params:
 *   ingredientId   – optional Spoonacular numeric ID
 *   ingredientName – required fallback name string
 *   amount         – recipe ingredient amount (number)
 *   unit           – recipe ingredient unit string
 *
 * Returns: { success: true, options: [{ rawText, scalingApplied, parts }] }
 */
export const getIngredientSubstitutes = async (req, res) => {
  try {
    const { ingredientId, ingredientName, amount, unit } = req.query;

    const ingAmount = parseFloat(amount);
    const ingUnit = typeof unit === "string" ? unit.trim() : "";

    if (!ingredientName || !String(ingredientName).trim()) {
      return res.status(400).json({ error: "ingredientName is required" });
    }
    if (!Number.isFinite(ingAmount) || ingAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!ingUnit) {
      return res.status(400).json({ error: "unit is required" });
    }

    const useById =
      ingredientId &&
      /^\d+$/.test(String(ingredientId).trim()) &&
      Number(ingredientId) > 0;

    let spoonUrl;
    let spoonParams;
    if (useById) {
      spoonUrl = `${API_BASE}/food/ingredients/${encodeURIComponent(ingredientId)}/substitutes`;
      spoonParams = {};
    } else {
      spoonUrl = `${API_BASE}/food/ingredients/substitutes`;
      spoonParams = { ingredientName: String(ingredientName).trim() };
    }

    console.log("[Spoonacular] GET ingredient substitutes", { useById, ingredientId, ingredientName });

    const resp = await axios.get(spoonUrl, {
      params: spoonParams,
      headers: { "x-api-key": process.env.SPOONACULAR_API_KEY },
    });

    const rawSubstitutes = Array.isArray(resp.data?.substitutes)
      ? resp.data.substitutes
      : [];

    const options = rawSubstitutes
      .map((rawText) => {
        const parsed = parseSubstituteString(String(rawText));
        if (!parsed) return null;
        const { scalingApplied, parts } = scaleSubstitute(parsed, ingAmount, ingUnit);
        return { rawText, scalingApplied, parts };
      })
      .filter(Boolean);

    return res.json({ success: true, options });
  } catch (error) {
    const status = error?.response?.status || 500;
    const spoonMsg = error?.response?.data?.message;

    console.error(
      "getIngredientSubstitutes error:",
      error?.response?.data || error?.message || error,
    );

    return res.status(status).json({
      error: spoonMsg || error.message || "Spoonacular request failed",
      code: "INGREDIENT_SUBSTITUTES_FAILED",
    });
  }
};
