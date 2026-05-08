import dotenv from "dotenv";
import axios from "axios";
import { convertUnit, normalizeUnit } from "../models/ingredientNormalizationModel.js";
dotenv.config();

const KROGER_CLIENT_ID = process.env.KROGER_CLIENT_ID;
const KROGER_CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;
const KROGER_API_BASE = process.env.KROGER_API_BASE;

let cachedToken = null;
let cachedTokenExpiresAt = 0;
const ingredientCache = new Map();

async function getAccessToken() {
  const now = Date.now();

  // If token exists and isn't expired, reuse it
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }
  const tokenResp = await axios.post(
    `${KROGER_API_BASE}/connect/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      scope: "product.compact",
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`).toString("base64"),
      },
    }
  );
  cachedToken = tokenResp.data.access_token;
  // Kroger tokens last 30 minutes -> set expiry 29 minutes to be safe
  cachedTokenExpiresAt = now + 29 * 60 * 1000;
  return cachedToken;
}

// Helper: Parse units from Product Size (12ct, 16oz, etc)
function parseUnitFromSize(sizeRaw) {
  if (!sizeRaw || typeof sizeRaw !== "string") return null;

  const s = sizeRaw.trim().toLowerCase();

  // Normalize fractions like "1/2"
  const fractionMatch = s.match(/^(\d+)\s*\/\s*(\d+)/);
  let normalized = s;

  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const denom = Number(fractionMatch[2]);
    const value = num / denom;

    normalized = s.replace(fractionMatch[0], value.toString());
  }

  // General pattern: "number unit"
  const m = normalized.match(/^(\d+(?:\.\d+)?)\s*(\w+)/);

  if (!m) return null;

  const value = Number(m[1]);
  let unit = m[2];

  // Normalize unit names
  const unitMap = {
    gallon: "gal",
    gallons: "gal",
    gal: "gal",

    ounce: "oz",
    ounces: "oz",
    oz: "oz",

    pound: "lb",
    pounds: "lb",
    lb: "lb",

    ml: "ml",
    l: "l",

    ct: "each",
    each: "each",
    ea: "each"
  };

  unit = unitMap[unit] || unit;

  return {
    unitType: unit,
    unitCount: value
  };
}

// Helper: Median calculation
function median(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

// Helper: Assign points to products to determine if they match term
function scoreProductMatch(term, description) {
  if (!term || !description) return 0;
  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[.,()]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const termTokens = normalize(term);
  const descTokens = normalize(description);
  let score = 0;
  // Exact phrase match (VERY strong signal)
  if (description.toLowerCase().includes(term.toLowerCase())) {
    score += 15;
  }
  // Token overlap
  for (const token of termTokens) {
    if (descTokens.includes(token)) {
      score += 5;
    }
  }
  // Penalize extra unrelated words (light penalty)
  const unmatchedTokens = descTokens.filter(
    (t) => !termTokens.includes(t)
  );
  score -= unmatchedTokens.length * 1.5;
  return score;
}


// Helper: Fetch price for specific term
async function fetchPriceForTerm(
  term,
  locationId,
  limit = 5,
  method = "median",
  includeCandidates = false,
  targetAmount = null,
  targetUnit = null
) {
  const token = await getAccessToken();

  const productResp = await axios.get(`${KROGER_API_BASE}/products`, {
    params: {
      "filter.term": term,
      "filter.locationId": locationId,
      "filter.limit": 15,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  const products = productResp.data?.data || [];

  if (products.length === 0) {
    return {
      found: false,
      term,
      product: null,
      cost: null,
      candidates: includeCandidates ? [] : undefined,
    };
  }

  // ----- BUILD CANDIDATES -----
  const originalCandidates = products.map((p) => {
    const item = p.items?.[0] || null;
    const regular = item?.price?.regular ?? item?.price?.promo ?? item?.price?.sale ?? null;
    const size = item?.size || null;

    const unitInfo = parseUnitFromSize(size);

    let effectiveUnitCost = null;

    if (unitInfo && regular && unitInfo.unitCount > 0) {
      const normalizedUnit = normalizeUnit(unitInfo.unitType);

      if (targetAmount != null && targetUnit) {
        const converted = convertUnit(
          unitInfo.unitCount,
          normalizedUnit,
          targetUnit
        );

        if (converted !== null && converted > 0) {
          effectiveUnitCost = regular / converted;
        }
      } else {
        effectiveUnitCost = regular / unitInfo.unitCount;
      }
    }
    const matchScore = scoreProductMatch(term, p.description)

    return {
      productId: p.productId,
      description: p.description,
      brand: p.brand || null,
      size,
      price: regular,
      effectiveUnitCost,
      matchScore,
      unit: unitInfo
        ? { unitType: unitInfo.unitType, unitCount: unitInfo.unitCount }
        : null,
    };
  });
  // STEP 1: Remove items with no usable prices
  const pricedCandidates = originalCandidates.filter(
    (c) =>
      typeof c.price === "number" ||
      typeof c.effectiveUnitCost === "number"
  );
  // 1a. fallback if everything is null
  const baseCandidates =
    pricedCandidates.length > 0 ? pricedCandidates : originalCandidates;
  // Step 2. Determine Top 5 Candidates by Term Accuracy (Score)
  const topCandidates = [...baseCandidates].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  // Score Gap Filter
  const bestScore = Math.max(...topCandidates.map(c => c.matchScore));
  const SCORE_GAP_THRESHOLD = 8;
  const relevantCandidates = topCandidates.filter((c) => bestScore - c.matchScore <= SCORE_GAP_THRESHOLD);
  // Step 3. Filter by required unit amount (If # of units is not greater than what is needed, ignore)
  const filteredCandidates = relevantCandidates.filter((c) => {
    if (!targetAmount || !targetUnit) return true;

    if (!c.unit) return false;

    const converted = convertUnit(
      c.unit.unitCount,
      normalizeUnit(c.unit.unitType),
      targetUnit
    );

    return converted !== null && converted >= targetAmount;
  });

  const candidates =
    filteredCandidates.length > 0 
      ? filteredCandidates
      : relevantCandidates.length > 0
      ? relevantCandidates
      : topCandidates;

  // ----- SELECTION LOGIC -----
  let selected;

  if (method === "cheapest") {
    selected =
      candidates
        .filter((c) => typeof c.price === "number")
        .sort((a, b) => a.price - b.price)[0] || null;

  } else if (method === "cheapest_unit") {
    selected =
      candidates
        .filter((c) => typeof c.effectiveUnitCost === "number")
        .sort((a, b) => a.effectiveUnitCost - b.effectiveUnitCost)[0] || null;

  } else {
    const unitCosts = candidates
      .filter((c) => typeof c.effectiveUnitCost === "number")
      .map((c) => c.effectiveUnitCost);

    if (unitCosts.length >= 3) {
      const med = median(unitCosts);

      selected = candidates.reduce((best, c) => {
        if (typeof c.effectiveUnitCost !== "number") return best;

        const diff = Math.abs(c.effectiveUnitCost - med);

        if (!best || diff < best.diff) return { c, diff };

        return best;
      }, null)?.c;

    } else {
      const regulars = candidates
        .map((c) => c.price)
        .filter((v) => typeof v === "number");

      const med = median(regulars);

      selected = candidates.reduce((best, c) => {
        if (typeof c.price !== "number") return best;

        const diff = Math.abs(c.price - med);

        if (!best || diff < best.diff) return { c, diff };

        return best;
      }, null)?.c;
    }
  }

  return {
    found: true,
    term,
    product: selected,
    cost:
      typeof selected?.effectiveUnitCost === "number"
        ? selected.effectiveUnitCost
        : selected?.price ?? null,
    rawPrice: selected?.price ?? null,
    unitCost: selected?.effectiveUnitCost ?? null,
    candidates: includeCandidates ? candidates : undefined,
  };
}

// Helper: Get Stores by Zip Code
async function getStoresByZip(zip, limit = 3) {
  const token = await getAccessToken();

  const resp = await axios.get(`${KROGER_API_BASE}/locations`, {
    params: {
      "filter.zipCode.near": zip,
      "filter.limit": limit,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  return resp.data?.data?.map(store => store.locationId) || [];
}
// Helper: Get Stores by Latitude / Longitude
async function getStoresByLocation(lat, lng, limit = 3) {
  const token = await getAccessToken();

  const resp = await axios.get(`${KROGER_API_BASE}/locations`, {
    params: {
      "filter.lat.near": lat,
      "filter.lon.near": lng,
      "filter.limit": limit,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  return resp.data?.data?.map(store => store.locationId) || [];
}

// GET /api/kroger/quick-location?zip=#####
export const getQuickLocation = async (req, res) => {
  const { zip, lat, lng } = req.query;

  if (!zip && (!lat || !lng)) {
    return res.status(400).json({
      error: "Provide either zip OR lat & lng",
    });
  }

  try {
    const token = await getAccessToken();

    let params = {
      "filter.limit": 1
    };

    // Prefer lat/lng if provided
    if (lat && lng) {
      params["filter.lat.near"] = lat;
      params["filter.lon.near"] = lng;
    } else {
      params["filter.zipCode.near"] = zip;
    }

    const resp = await axios.get(`${KROGER_API_BASE}/locations`, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const stores = resp.data?.data || [];

    if (stores.length === 0) {
      return res.json({ error: "No stores found" });
    }

    res.json({
      locationId: stores[0].locationId,
      name: stores[0].name,
      address: stores[0].address,
    });

  } catch (err) {
    console.error("Quick-location error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Failed to fetch store",
      details: err.response?.data || err.message,
    });
  }
};

// GET /api/kroger/price?term=[insert]&locationId=[insert]&limit=[insert def=5] */
export const getPrice = async (req, res) => {
  const term = req.query.term;
  const locationId = req.query.locationId;
  const limit = Number(req.query.limit || 5);
  const method = req.query.method || "median";
  const includeCandidates = req.query.includeCandidates === "true";

  if (!term || !locationId) {
    return res.status(400).json({
      error: "Missing required query params",
      required: ["term", "locationId"],
      example: "/kroger/price?term=milk&locationId=01800520",
    });
  }

  // Ingredient Cache Check
  const cacheKey = `${term}|${locationId}|${method}|${limit}|${includeCandidates}`;
  const cached = ingredientCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.response);
  }

  try {
    const result = await fetchPriceForTerm(
      term,
      locationId,
      limit,
      method,
      includeCandidates
    );

    const response = {
      term,
      locationId,
      method,
      product: result.product,
      ...(includeCandidates ? { candidates: result.candidates } : {})
    };

    // Save Ingredient Cache
    ingredientCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      response
    });

    return res.json(response);

  } catch (err) {
    console.error("Price lookup error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Failed to fetch product price",
      details: err.response?.data || err.message,
    });
  }
};

// GET /api/kroger/price/batch
// JSON Example:
/*{
  "terms": ["Happy Egg Co. Large Eggs", "Milk", "Sharp Cheddar Cheese"],
  "locationId": "70300165",
  "method": "cheapest",
  "limit": 5,
  "includeCandidates": false
}*/
export const getPriceBatch = async (req, res) => {
  const { terms, locationId, method = "median", limit = 5 } = req.body;

  if (!Array.isArray(terms) || terms.length === 0) {
    return res.status(400).json({
      error: "Body must contain { terms: [] }"
    });
  }

  if (!locationId) {
    return res.status(400).json({
      error: "locationId is required"
    });
  }

  try {
    // Run all ingredient lookups in parallel
    const results = await Promise.all(
      terms.map((term) =>
        fetchPriceForTerm(term, locationId, limit, method, false)
      )
    );

    // Compute total cost
    let totalCost = 0;
    for (const r of results) {
      if (r.cost !== null) totalCost += r.cost;
    }

    return res.json({
      success: true,
      locationId,
      method,
      totalCost: Number(totalCost.toFixed(2)),
      items: results   // full per-ingredient breakdown
    });

  } catch (err) {
    console.error("Batch price error:", err);
    return res.status(500).json({
      error: "Failed to fetch batch prices",
      details: err.message
    });
  }
};

export const getMultiStorePrice = async (req, res) => {
  const { term, zip } = req.query;
  const limit = Number(req.query.limit || 5);
  const storesToCheck = Number(req.query.stores || 3);
  const method = req.query.method || "median";

  if (!term || !zip) {
    return res.status(400).json({
      error: "Missing required query params: term, zip",
    });
  }

  try {
    // STEP 1: Automatically get stores from ZIP
    const locationIds = await getStoresByZip(zip, storesToCheck);

    if (locationIds.length === 0) {
      return res.json({ error: "No stores found near ZIP" });
    }

    // STEP 2: For each store, fetch price
    const results = await Promise.all(
      locationIds.map(loc =>
        fetchPriceForTerm(term, loc, limit, method, false)
      )
    );

    // STEP 3: Pick the best store
    const best = results
      .filter(r => r.cost !== null)
      .sort((a, b) => a.cost - b.cost)[0] || null;

    return res.json({
      term,
      zip,
      method,
      bestStore: best,
      allStores: results
    });

  } catch (err) {
    console.error("Multi-store price error:", err);
    return res.status(500).json({
      error: "Failed to fetch multi-store prices",
      details: err.message
    });
  }
};

export { fetchPriceForTerm, getAccessToken };