import { Platform } from "react-native";

/** Native iOS/Android: hide scroll thumb; web keeps default scrollbar behavior. */
export const verticalScrollIndicatorVisible = Platform.OS === "web";

/** Same as {@link verticalScrollIndicatorVisible} for horizontal lists (e.g. image carousels). */
export const horizontalScrollIndicatorVisible = Platform.OS === "web";
