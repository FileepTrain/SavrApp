import { fetchRecipeForList } from "@/utils/fetch-recipe-for-list";
import { useEffect, useMemo, useState } from "react";

export type CollectionCoverTriple = {
  main: string | null;
  smallTop: string | null;
  smallBottom: string | null;
};

type RowInput = { coverId: string; recipeIds: string[] };

function stableKey(rows: RowInput[]) {
  return rows.map((r) => `${r.coverId}:${r.recipeIds.slice(0, 3).join(",")}`).join("|");
}

/**
 * Loads up to three recipe images per collection for Pinterest-style previews.
 * Use a unique `coverId` (e.g. `${ownerUid}_${collectionId}` on followed lists).
 */
export function useCollectionCoverImages(rows: RowInput[]) {
  const key = useMemo(() => stableKey(rows), [rows]);
  const [covers, setCovers] = useState<Record<string, CollectionCoverTriple>>({});

  useEffect(() => {
    let cancelled = false;
    const snapshot = rows;
    (async () => {
      const next: Record<string, CollectionCoverTriple> = {};
      await Promise.all(
        snapshot.map(async (c) => {
          const ids = c.recipeIds.slice(0, 3);
          const urls: (string | null)[] = [null, null, null];
          for (let i = 0; i < ids.length; i++) {
            const r = await fetchRecipeForList(ids[i]);
            const img =
              r && typeof (r as { image?: string }).image === "string"
                ? (r as { image: string }).image
                : null;
            urls[i] = img;
          }
          next[c.coverId] = {
            main: urls[0],
            smallTop: urls[1],
            smallBottom: urls[2],
          };
        }),
      );
      if (!cancelled) setCovers(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, rows]);

  return covers;
}
