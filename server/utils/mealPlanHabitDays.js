/**
 * Builds per-day breakfast/lunch/dinner recipe ids for a meal plan range.
 * Each slot walks recipes in order; recipe i covers `targetServings` consecutive days,
 * then the next recipe. Remaining days repeat the last recipe in that slot.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Inclusive local calendar YYYY-MM-DD keys (matches react-native-calendars `date.dateString`).
 */
export function localDateKeysInclusive(startInput, endInput) {
  const s = startInput instanceof Date ? startInput : new Date(startInput);
  const e = endInput instanceof Date ? endInput : new Date(endInput);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const keys = [];
  while (cur <= end) {
    keys.push(
      `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function clampInt(n, fallback) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return v;
}

export function parseSlotEntriesForHabit(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    const first = raw[0];
    const isObjectSlot =
      first != null &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      (Object.prototype.hasOwnProperty.call(first, "id") ||
        Object.prototype.hasOwnProperty.call(first, "recipeId"));
    if (isObjectSlot) {
      return raw
        .map((row) => {
          if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
          const id = String(row.id ?? row.recipeId ?? "").trim();
          if (!id) return null;
          const targetServings = clampInt(
            Number(row.targetServings ?? row.target_servings ?? 1),
            1,
          );
          return { id, targetServings };
        })
        .filter(Boolean);
    }
    return raw
      .filter((x) => x != null && String(x).trim().length > 0)
      .map((x) => ({ id: String(x).trim(), targetServings: 1 }));
  }
  const str = String(raw).trim();
  if (!str) return [];
  if (str.startsWith("[")) {
    try {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => {
          if (row == null || typeof row !== "object") return null;
          const id = String(row.id ?? row.recipeId ?? "").trim();
          if (!id) return null;
          const targetServings = clampInt(
            Number(row.targetServings ?? row.target_servings ?? 1),
            1,
          );
          return { id, targetServings };
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id, targetServings: 1 }));
}

/**
 * @param {{ id: string, targetServings: number }[]} entries
 * @param {number} totalDays
 * @returns {(string|null)[]}
 */
export function assignRecipeIdsForSlot(entries, totalDays) {
  const out = Array.from({ length: totalDays }, () => null);
  if (!entries.length || totalDays <= 0) return out;

  let lastAssignedId = null;
  let dayIdx = 0;

  for (const entry of entries) {
    const id = String(entry.id ?? "").trim();
    if (!id) continue;
    const span = clampInt(entry.targetServings, 1);
    for (let i = 0; i < span && dayIdx < totalDays; i++) {
      out[dayIdx++] = id;
      lastAssignedId = id;
    }
    if (dayIdx >= totalDays) break;
  }

  const fillId =
    lastAssignedId ||
    (entries.length ? String(entries[entries.length - 1].id ?? "").trim() || null : null);
  while (dayIdx < totalDays && fillId) {
    out[dayIdx++] = fillId;
  }

  return out;
}

/**
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {*} breakfastRaw
 * @param {*} lunchRaw
 * @param {*} dinnerRaw
 */
export function buildHabitDaysArray(startDate, endDate, breakfastRaw, lunchRaw, dinnerRaw) {
  const dateKeys = localDateKeysInclusive(startDate, endDate);
  const n = dateKeys.length;
  const bIds = assignRecipeIdsForSlot(parseSlotEntriesForHabit(breakfastRaw), n);
  const lIds = assignRecipeIdsForSlot(parseSlotEntriesForHabit(lunchRaw), n);
  const dIds = assignRecipeIdsForSlot(parseSlotEntriesForHabit(dinnerRaw), n);

  return dateKeys.map((date, i) => ({
    date,
    breakfast: bIds[i] ? { id: bIds[i] } : null,
    lunch: lIds[i] ? { id: lIds[i] } : null,
    dinner: dIds[i] ? { id: dIds[i] } : null,
    followedPlan: false,
  }));
}
