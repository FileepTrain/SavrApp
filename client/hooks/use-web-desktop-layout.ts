import { Platform, useWindowDimensions } from "react-native";

/** Viewport width at which web uses sidebar + wider grids (matches toolbar layout). */
export const WEB_DESKTOP_MIN_WIDTH = 900;

/** Width of the left nav in web desktop layout (keep in sync with toolbar-web-sidebar). */
export const WEB_TOOLBAR_SIDEBAR_WIDTH = 216;

export function useWebDesktopLayout() {
  const { width } = useWindowDimensions();
  const isWebDesktop =
    Platform.OS === "web" && width >= WEB_DESKTOP_MIN_WIDTH;
  /** Content area excluding sidebar (window width is full viewport). */
  const contentWidth = isWebDesktop
    ? width - WEB_TOOLBAR_SIDEBAR_WIDTH
    : width;
  return { isWebDesktop, width, contentWidth };
}
