import { Platform, Share } from "react-native";

/**
 * Public HTTP base for share landing pages (same host as API in dev).
 * Server routes like GET /recipe/:id and GET /profile/:userId redirect into the app.
 */
const SHARE_WEB_BASE_URL =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ??
  process.env.EXPO_PUBLIC_SERVER_URL ??
  "http://10.0.2.2:3000";

function shareBase(): string {
  return SHARE_WEB_BASE_URL.replace(/\/$/, "");
}

/** HTTPS link that opens the app via the server bridge (same pattern as recipes). */
export function buildProfileShareWebUrl(
  profileUserId: string,
  options?: { tab?: "plans"; mealPlanId?: string },
): string {
  const params = new URLSearchParams();
  if (options?.tab) params.set("tab", options.tab);
  if (options?.mealPlanId) params.set("mealPlanId", options.mealPlanId);
  const q = params.toString();
  return `${shareBase()}/profile/${encodeURIComponent(profileUserId)}${q ? `?${q}` : ""}`;
}

export function buildRecipeShareWebUrl(recipeId: string): string {
  return `${shareBase()}/recipe/${encodeURIComponent(recipeId)}`;
}

export async function openNativeShare(url: string, dialogTitle?: string): Promise<void> {
  try {
    await Share.share({
      title: dialogTitle,
      message: url,
      ...(Platform.OS === "ios" ? { url } : {}),
    });
  } catch {
    // user dismissed sheet
  }
}
