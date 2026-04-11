/**
 * Normalize Units
 */
const UNIT_MAP = {
  // COUNT
  each: "each",
  ea: "each",
  ct: "each",
  count: "each",
  // MASS
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",

  oz: "oz",
  ounce: "oz",
  ounces: "oz",

  g: "g",
  gram: "g",
  grams: "g",

  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",

  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  // VOLUME (US COOKING)
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",

  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",

  cup: "cup",
  cups: "cup",

  pt: "pt",
  pint: "pt",
  pints: "pt",

  qt: "qt",
  quart: "qt",
  quarts: "qt",

  gal: "gal",
  gallon: "gal",
  gallons: "gal",

  fl_oz: "fl_oz",
  floz: "fl_oz",
  "fluid ounce": "fl_oz",
  "fluid ounces": "fl_oz",
  "fluidounce": "fl_oz",
  "fluidounces": "fl_oz",
  // METRIC VOLUME
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",

  l: "l",
  liter: "l",
  liters: "l",
  // RECIPE COMMON UNITS
  pinch: "pinch",
  pinches: "pinch",

  dash: "dash",
  dashes: "dash",

  clove: "clove",
  cloves: "clove",

  bunch: "bunch",
  bunches: "bunch",

  slice: "slice",
  slices: "slice",

  piece: "piece",
  pieces: "piece",

  stick: "stick",
  sticks: "stick",

  can: "can",
  cans: "can",

  package: "package",
  packages: "package",

};
/**
 * Normalize Unit Categories (For Conversion)
 */
const UNIT_CATEGORIES = {
  // MASS
  g: "mass",
  kg: "mass",
  oz: "mass",
  lb: "mass",
  mg: "mass",

  // VOLUME
  ml: "volume",
  l: "volume",
  tsp: "volume",
  tbsp: "volume",
  cup: "volume",
  pt: "volume",
  qt: "volume",
  gal: "volume",
  fl_oz: "volume",

  // COUNT / NON-CONVERTIBLE
  each: "count",
  clove: "count",
  slice: "count",
  piece: "count",
  stick: "count",
  can: "count",
  package: "count",
  bunch: "count",

  pinch: "other",
  dash: "other",
};

const MASS_TO_GRAMS = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_ML = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  pt: 473.176,
  qt: 946.353,
  gal: 3785.41,
  fl_oz: 29.5735,
};

const PUNCTUATION_REGEX = /[.,()]/g;

/**
 * Normalize ingredient/product name
 */
export function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(PUNCTUATION_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize measurement units
 */
export function normalizeUnit(unit) {
  if (!unit) return "each";

  const key = unit.toLowerCase().trim();
  return UNIT_MAP[key] || key;
}

/**
 * Normalize numeric quantity
 */
export function normalizeAmount(amount) {
  const num = Number(amount);

  if (!Number.isFinite(num) || num <= 0) {
    return 1;
  }

  return num;
}

/**
 * Normalize a raw ingredient/product object
 */
export function normalizeItem(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    name: normalizeName(raw.name),
    amount: normalizeAmount(raw.amount),
    unit: normalizeUnit(raw.unit),
  };
}

/**
 * Generates a canonical key used for comparisons
 */
export function getIngredientKey(name) {
  return normalizeName(name);
}

/**
 * Merge duplicate items in a list
 */
export function mergeItemIntoList(list, newItem) {
  const normalizedNewUnit = normalizeUnit(newItem.unit);
  for (const item of list) {
    if (item.ingredient !== newItem.name) continue;
    const normalizedExistingUnit = normalizeUnit(item.unit);
    const converted = convertUnit(
      newItem.amount,
      normalizedNewUnit,
      normalizedExistingUnit
    );
    if (converted !== null) {
      item.amount += converted;
      item.amount = Number(item.amount.toFixed(2));
      return [...list];
    }
    const reverseConverted = convertUnit(
      item.amount,
      normalizedExistingUnit,
      normalizedNewUnit
    );
    if (reverseConverted !== null) {
      item.amount = reverseConverted + newItem.amount;
      item.unit = normalizedNewUnit;
      item.amount = Number(item.amount.toFixed(2));
      return [...list];
    }
  }
  return [...list, newItem];
}

/**
 * Normalize a full ingredient list
 */
export function normalizeItemList(items) {
  if (!Array.isArray(items)) return [];

  let result = [];

  for (const item of items) {
    const normalized = normalizeItem(item);
    result = mergeItemIntoList(result, normalized);
  }

  return result;
}

/**
 * Convert # of One Unit to another Unit
 */
export function convertUnit(amount, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from == to) return amount;
  const fromCategory = UNIT_CATEGORIES[from];
  const toCategory = UNIT_CATEGORIES[to];
  if (!fromCategory || fromCategory !== toCategory) return null;
  // MASS
  if (fromCategory === "mass") {
    const grams = amount * MASS_TO_GRAMS[from];
    return grams / MASS_TO_GRAMS[to];
  }
  // VOLUME
  if (fromCategory === "volume") {
    const ml = amount * VOLUME_TO_ML[from];
    return ml / VOLUME_TO_ML[to];
  }
  return null;
}