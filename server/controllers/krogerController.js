import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

// TEMP HARDCODED - REMOVE LATER
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

  // e.g. "12 ct"
  let m = s.match(/^(\d+(?:\.\d+)?)\s*ct\b/);
  if (m) return { unitType: "ct", unitCount: Number(m[1]) };

  // e.g. "3 each", "1 ea"
  m = s.match(/^(\d+(?:\.\d+)?)\s*(each|ea)\b/);
  if (m) return { unitType: "each", unitCount: Number(m[1]) };

  // e.g. "16 oz"
  m = s.match(/^(\d+(?:\.\d+)?)\s*oz\b/);
  if (m) return { unitType: "oz", unitCount: Number(m[1]) };

  // e.g. "1 lb"
  m = s.match(/^(\d+(?:\.\d+)?)\s*lb\b/);
  if (m) return { unitType: "lb", unitCount: Number(m[1]) };

  return null;
}

// Helper: Median calculation
function median(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

// Helper: Fetch price for specific term
async function fetchPriceForTerm(term, locationId, limit = 5, method = "median", includeCandidates = false) {
  const token = await getAccessToken();

  const productResp = await axios.get(`${KROGER_API_BASE}/products`, {
    params: {
      "filter.term": term,
      "filter.locationId": locationId,
      "filter.limit": Math.min(Math.max(limit, 1), 20),
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
      candidates: includeCandidates ? [] : undefined
    };
  }

  // Build candidates
  const candidates = products.map((p) => {
    const item = p.items?.[0] || null;
    const regular = item?.price?.regular ?? null;
    const size = item?.size || null;

    const unitInfo = parseUnitFromSize(size);
    const unitCost =
      unitInfo && regular && unitInfo.unitCount > 0
        ? Number((regular / unitInfo.unitCount).toFixed(2))
        : null;

    return {
      productId: p.productId,
      description: p.description,
      brand: p.brand || null,
      size,
      price: regular,
      unit: unitInfo
        ? { unitType: unitInfo.unitType, unitCount: unitInfo.unitCount, unitCost }
        : null
    };
  });

  // Selection logic
  let selected;

  if (method === "cheapest") {
    selected = candidates
      .filter(c => typeof c.price === "number")
      .sort((a, b) => a.price - b.price)[0] || null;

  } else if (method === "cheapest_unit") {
    selected = candidates
      .filter(c => typeof c.unit?.unitCost === "number")
      .sort((a, b) => a.unit.unitCost - b.unit.unitCost)[0] || null;

  } else {
    // Median
    const unitCosts = candidates
      .filter(c => typeof c.unit?.unitCost === "number")
      .map(c => c.unit.unitCost);

    if (unitCosts.length >= 3) {
      const med = median(unitCosts);
      selected = candidates.reduce((best, c) => {
        if (typeof c.unit?.unitCost !== "number") return best;
        const diff = Math.abs(c.unit.unitCost - med);
        if (!best || diff < best.diff) return { c, diff };
        return best;
      }, null)?.c;

    } else {
      const regulars = candidates
        .map(c => c.price)
        .filter(v => typeof v === "number");

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
    cost: selected?.price ?? null,
    candidates: includeCandidates ? candidates : undefined
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

// GET /api/kroger/quick-location?zip=#####
export const getQuickLocation = async (req, res) => {
  const zip = req.query.zip;
  if (!zip) return res.status(400).json({ error: "Missing ?zip= parameter" });

  try {
    //console.log("CLIENT_ID present?", !!process.env.KROGER_CLIENT_ID);
    //console.log("CLIENT_SECRET present?", !!process.env.KROGER_CLIENT_SECRET);
    //console.log("API_BASE:", process.env.KROGER_API_BASE);
    // 1) Get token
    const token = await getAccessToken();

    // 2) Get locations from ZIP
    const locResp = await axios.get(
      `${KROGER_API_BASE}/locations`, // add process.env. before kroger when fixing
      {
        params: {
          "filter.zipCode.near": zip,
          "filter.limit": 1
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const stores = locResp.data?.data || [];
    if (stores.length === 0) {
      return res.json({ error: "No stores found" });
    }

    // 3) Return the first locationId
    res.json({
      locationId: stores[0].locationId,
      name: stores[0].name,
      address: stores[0].address,
      raw: stores[0]
    });

  } catch (err) {
    console.error("Quick-location error:", err.response?.data || err.message);
    res.status(500).json({error: "Failed to fetch store", details: err.response?.data || err.message,});
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