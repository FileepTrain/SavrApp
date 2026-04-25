import { useMemo } from "react";

import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";

/** Same max column as recipe detail (`[recipeId].tsx`) on desktop web. */
export const RECIPE_WEB_COLUMN_MAX = 768;

/**
 * Readable column width for recipe stack screens on desktop web (not used on native).
 * Uses `contentWidth` (viewport minus web toolbar sidebar) so headers and body align in the main pane.
 */
export function useRecipeWebColumnWidth() {
  const { isWebDesktop, contentWidth } = useWebDesktopLayout();
  return useMemo(() => {
    if (!isWebDesktop) return undefined;
    return Math.min(
      RECIPE_WEB_COLUMN_MAX,
      Math.max(280, contentWidth - 48),
    );
  }, [isWebDesktop, contentWidth]);
}
