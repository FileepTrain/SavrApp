import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";

import { showAppAlert } from "@/utils/app-alert";
import { SERVER_URL } from "@/utils/server-url";

/**
 * Public base for shared links.
 * - **Web:** same origin as the Expo web app so `/profile/…` and `/recipe/…` open in the SPA
 *   instead of the API host (which only serves the mobile `savr://` bridge page).
 * - **Native:** `EXPO_PUBLIC_SHARE_BASE_URL` or API host (bridge opens the installed app).
 */
const SHARE_WEB_BASE_URL =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ??
  process.env.EXPO_PUBLIC_SERVER_URL ??
  SERVER_URL;

function shareBase(): string {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.location?.origin === "string" &&
    window.location.origin.length > 0
  ) {
    return window.location.origin.replace(/\/$/, "");
  }
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

/**
 * Web: native `navigator.share` often has no “Copy” target (especially on desktop).
 * Show a small sheet with explicit Copy + optional Share + Cancel.
 */
function presentWebShareSheet(url: string, dialogTitle?: string): void {
  if (typeof document === "undefined") return;

  const root = document.createElement("div");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", dialogTitle ?? "Share");
  root.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(0,0,0,.45);font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box";

  const card = document.createElement("div");
  card.style.cssText =
    "width:100%;max-width:400px;background:#fff;color:#111;border-radius:16px;padding:16px 16px 12px;box-shadow:0 8px 32px rgba(0,0,0,.2);box-sizing:border-box";

  const titleEl = document.createElement("p");
  titleEl.textContent = dialogTitle ?? "Share";
  titleEl.style.cssText = "margin:0 0 4px;font-size:17px;font-weight:600";

  const hint = document.createElement("p");
  hint.textContent = "Copy the link or use your browser’s share menu.";
  hint.style.cssText = "margin:0 0 12px;font-size:13px;color:#555;line-height:1.35";

  const btn = (
    label: string,
    variant: "primary" | "secondary",
    action: () => void | Promise<void>,
  ) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    const isPrimary = variant === "primary";
    b.style.cssText = [
      "display:block",
      "width:100%",
      "padding:14px 16px",
      "margin-top:8px",
      "border-radius:12px",
      "font-size:16px",
      "font-weight:600",
      "cursor:pointer",
      "box-sizing:border-box",
      isPrimary
        ? "border:none;background:#c42d2d;color:#fff"
        : "border:1px solid #ccc;background:#fff;color:#111",
    ].join(";");
    b.onmouseenter = () => {
      b.style.opacity = "0.92";
    };
    b.onmouseleave = () => {
      b.style.opacity = "1";
    };
    b.onclick = async () => {
      try {
        await action();
      } finally {
        cleanup();
      }
    };
    return b;
  };

  const cleanup = () => {
    document.removeEventListener("keydown", onKeyDown);
    root.remove();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") cleanup();
  };
  document.addEventListener("keydown", onKeyDown);

  root.addEventListener("click", (ev) => {
    if (ev.target === root) cleanup();
  });

  card.appendChild(titleEl);
  card.appendChild(hint);
  card.appendChild(
    btn("Copy link", "secondary", async () => {
      try {
        await Clipboard.setStringAsync(url);
        showAppAlert("Copied", "Link copied to your clipboard.");
      } catch {
        showAppAlert("Copy failed", url);
      }
    }),
  );

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (typeof nav?.share === "function") {
    card.appendChild(
      btn("Share…", "primary", async () => {
        try {
          await nav.share({ title: dialogTitle ?? "Savr", url });
        } catch (e) {
          const name = e instanceof Error ? e.name : "";
          if (name !== "AbortError") {
            showAppAlert("Share failed", "Try “Copy link” instead.");
          }
        }
      }),
    );
  }

  card.appendChild(
    btn("Cancel", "secondary", () => {
      /* no-op; cleanup runs in btn wrapper */
    }),
  );

  root.appendChild(card);
  document.body.appendChild(root);
  requestAnimationFrame(() => {
    const first = card.querySelector("button");
    first?.focus();
  });
}

export async function openNativeShare(url: string, dialogTitle?: string): Promise<void> {
  if (Platform.OS === "web") {
    presentWebShareSheet(url, dialogTitle);
    return;
  }

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
