/**
 * Normalization Helpers
 */
const UNIT_MAP = {
  // ----- COUNT -----
  each: "each",
  ea: "each",
  ct: "each",
  count: "each",
  // ----- MASS -----
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
  // ----- VOLUME (US COOKING) -----
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
  // ----- METRIC VOLUME -----
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",

  l: "l",
  liter: "l",
  liters: "l",
  // ----- RECIPE COMMON UNITS -----
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
  const existing = list.find(
    (item) => item.name === newItem.name && item.unit === newItem.unit
  );

  if (!existing) {
    return [...list, newItem];
  }

  existing.amount += newItem.amount;

  return [...list];
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