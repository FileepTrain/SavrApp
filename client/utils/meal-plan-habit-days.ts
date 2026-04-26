import type { MealPlanSlotEntry } from "@/utils/meal-plan-slot";
import { mealSlotEntriesFromPlanField } from "@/utils/meal-plan-slot";

export type MealPlanHabitDay = {
  date: string;
  breakfast: { id: string } | null;
  lunch: { id: string } | null;
  dinner: { id: string } | null;
  followedPlan: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Same local calendar keys as server + react-native-calendars `date.dateString`. */
export function localDateKeysInclusive(startIso: string, endIso: string): string[] {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const keys: string[] = [];
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export function planCoversCalendarDateLocal(
  startIso: string | null,
  endIso: string | null,
  dateKey: string,
): boolean {
  if (!startIso || !endIso) return false;
  return localDateKeysInclusive(startIso, endIso).includes(dateKey);
}

function clampInt(n: number, fallback: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return v;
}

function assignRecipeIdsForSlot(entries: MealPlanSlotEntry[], totalDays: number): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: totalDays }, () => null);
  if (!entries.length || totalDays <= 0) return out;

  let lastAssignedId: string | null = null;
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
    lastAssignedId ??
    (entries.length ? String(entries[entries.length - 1]?.id ?? "").trim() || null : null);
  while (dayIdx < totalDays && fillId) {
    out[dayIdx++] = fillId;
  }

  return out;
}

/** Client-side mirror of server habit day builder (offline / optimistic UI). */
export function buildMealPlanHabitDaysFromPlanFields(
  startIso: string,
  endIso: string,
  breakfastField: unknown,
  lunchField: unknown,
  dinnerField: unknown,
): MealPlanHabitDay[] {
  const dateKeys = localDateKeysInclusive(startIso, endIso);
  const n = dateKeys.length;
  const b = mealSlotEntriesFromPlanField(breakfastField);
  const l = mealSlotEntriesFromPlanField(lunchField);
  const d = mealSlotEntriesFromPlanField(dinnerField);
  const bIds = assignRecipeIdsForSlot(b, n);
  const lIds = assignRecipeIdsForSlot(l, n);
  const dIds = assignRecipeIdsForSlot(d, n);

  return dateKeys.map((date, i) => ({
    date,
    breakfast: bIds[i] ? { id: bIds[i]! } : null,
    lunch: lIds[i] ? { id: lIds[i]! } : null,
    dinner: dIds[i] ? { id: dIds[i]! } : null,
    followedPlan: false,
  }));
}

export function normalizeHabitDaysFromApi(raw: unknown): MealPlanHabitDay[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: MealPlanHabitDay[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = o.date != null ? String(o.date).trim() : "";
    if (!date) continue;
    const br = o.breakfast;
    const lu = o.lunch;
    const di = o.dinner;
    out.push({
      date,
      breakfast:
        br && typeof br === "object" && (br as { id?: string }).id
          ? { id: String((br as { id: string }).id) }
          : null,
      lunch:
        lu && typeof lu === "object" && (lu as { id?: string }).id
          ? { id: String((lu as { id: string }).id) }
          : null,
      dinner:
        di && typeof di === "object" && (di as { id?: string }).id
          ? { id: String((di as { id: string }).id) }
          : null,
      followedPlan: Boolean(o.followedPlan),
    });
  }
  return out.length ? out : undefined;
}
