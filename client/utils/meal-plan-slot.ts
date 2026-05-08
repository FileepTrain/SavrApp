/**
 * meal plan slots are stored as:
 * - old: comma-separated recipe ids ("123,456")
 * - new: JSON array of { id, baseServings, targetServings, batchMultiplier }
 * supporting old meal plans cause im too lazy to delete them all
 */
export type MealPlanSlotEntry = {
  id: string;
  baseServings: number;
  targetServings: number;
  /** Cook this many recipe batches (ingredients scale × this). */
  batchMultiplier: number;
  title?: string; // needed for export only
};

function clampPositiveInt(n: number, fallback: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return v;
}

function rowToEntry(row: unknown): MealPlanSlotEntry | null {
  if (row == null || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const idRaw = o.id ?? o.recipeId;
  const id = idRaw != null ? String(idRaw).trim() : "";
  if (!id) return null;
  const baseServings = clampPositiveInt(
    Number(o.baseServings ?? o.base_servings ?? 1),
    1,
  );
  const targetServings = clampPositiveInt(
    Number(o.targetServings ?? o.target_servings ?? 1),
    1,
  );
  const batchMultiplier = clampPositiveInt(
    Number(o.batchMultiplier ?? o.batch_multiplier ?? o.batches ?? 1),
    1,
  );
  return { id, baseServings, targetServings, batchMultiplier };
}

/** Parses a stored slot string (legacy CSV or JSON array). */
export function parseMealSlotStored(input?: string | null): MealPlanSlotEntry[] {
  if (input == null) return [];
  const trimmed = String(input).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map(rowToEntry).filter((x): x is MealPlanSlotEntry => x != null);
    } catch {
      return [];
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((id) => ({ id, baseServings: 1, targetServings: 1, batchMultiplier: 1 }));
}

/**
 * Normalizes a breakfast/lunch/dinner field from the API (string, old id array, or entry array).
 */
export function mealSlotEntriesFromPlanField(value: unknown): MealPlanSlotEntry[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const first = value[0];
    if (typeof first === "object" && first != null && "id" in first) {
      return value.map(rowToEntry).filter((x): x is MealPlanSlotEntry => x != null);
    }
    return value
      .filter((x) => x != null && String(x).trim().length > 0)
      .map((x) => ({
        id: String(x).trim(),
        baseServings: 1,
        targetServings: 1,
        batchMultiplier: 1,
      }));
  }
  if (typeof value === "string") return parseMealSlotStored(value);
  return [];
}

export function slotEntriesToStoredString(entries: MealPlanSlotEntry[]): string | null {
  if (!entries.length) return null;
  const normalized = entries.map((e) => ({
    id: String(e.id).trim(),
    baseServings: clampPositiveInt(e.baseServings, 1),
    targetServings: clampPositiveInt(e.targetServings, 1),
    batchMultiplier: clampPositiveInt(e.batchMultiplier, 1),
  }));
  const filtered = normalized.filter((e) => e.id.length > 0);
  return filtered.length ? JSON.stringify(filtered) : null;
}
