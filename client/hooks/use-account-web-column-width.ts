import { useMemo } from "react";

import { RECIPE_WEB_COLUMN_MAX } from "@/hooks/use-recipe-web-column-width";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";

/**
 * Max readable width for account tab screens on desktop web (toolbar area minus sidebar).
 * Native and narrow web: `undefined` so layouts stay full width.
 */
export function useAccountWebColumnWidth() {
  const { isWebDesktop, contentWidth } = useWebDesktopLayout();
  return useMemo(() => {
    if (!isWebDesktop) return undefined;
    return Math.min(
      RECIPE_WEB_COLUMN_MAX,
      Math.max(280, contentWidth - 48),
    );
  }, [isWebDesktop, contentWidth]);
}
