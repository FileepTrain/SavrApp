import { Alert, Platform } from "react-native";

/** `Alert.alert` is a no-op on web in React Native; use this for user-visible messages everywhere. */
export function showAppAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(text);
    } else {
      console.error("[showAppAlert]", title, message);
    }
    return;
  }
  Alert.alert(title, message);
}
