import type { Href } from "expo-router";

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Some platforms parse `savr://login?redirectTo=...&mealPlanId=x` so `mealPlanId` becomes a sibling
 * query key on /login instead of part of redirectTo. Merge those back into /profile/... targets.
 */
export function mergeLoginLooseParamsIntoRedirect(
  redirectTo: string | string[] | undefined,
  loose: { tab?: string | string[]; mealPlanId?: string | string[] },
): string {
  const target = Array.isArray(redirectTo)
    ? redirectTo[0]
    : typeof redirectTo === "string"
      ? redirectTo
      : null;
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/home";
  }

  const tab = singleParam(loose.tab);
  const mealPlanId = singleParam(loose.mealPlanId);
  if (!target.startsWith("/profile/")) {
    return target;
  }

  const qIdx = target.indexOf("?");
  const pathOnly = qIdx >= 0 ? target.slice(0, qIdx) : target;
  const sp = new URLSearchParams(qIdx >= 0 ? target.slice(qIdx + 1) : "");
  if (tab && !sp.has("tab")) sp.set("tab", tab);
  if (mealPlanId && !sp.has("mealPlanId")) sp.set("mealPlanId", mealPlanId);
  const qs = sp.toString();
  return qs ? `${pathOnly}?${qs}` : pathOnly;
}

/**
 * Expo Router often drops search params when navigating with a single string href.
 * Parse internal redirect paths into { pathname, params } so query keys (e.g. mealPlanId) survive.
 */
export function hrefFromRedirectTo(target: string): Href {
  if (!target.startsWith("/") || target.startsWith("//")) {
    return "/home";
  }

  const qIdx = target.indexOf("?");
  const pathPart = qIdx >= 0 ? target.slice(0, qIdx) : target;
  const queryString = qIdx >= 0 ? target.slice(qIdx + 1) : "";
  const qp = new URLSearchParams(queryString);

  if (pathPart === "/home" || pathPart === "/onboarding") {
    return pathPart;
  }

  const profileMatch = /^\/profile\/([^/?#]+)$/.exec(pathPart);
  if (profileMatch) {
    const userId = decodeURIComponent(profileMatch[1]);
    const params: {
      userId: string;
      tab?: string;
      mealPlanId?: string;
    } = { userId };
    const tab = qp.get("tab");
    const mealPlanId = qp.get("mealPlanId");
    if (tab) params.tab = tab;
    if (mealPlanId) params.mealPlanId = mealPlanId;
    return { pathname: "/profile/[userId]", params };
  }

  const recipeMatch = /^\/recipe\/([^/?#]+)$/.exec(pathPart);
  if (recipeMatch) {
    const recipeId = decodeURIComponent(recipeMatch[1]);
    return { pathname: "/recipe/[recipeId]", params: { recipeId } };
  }

  return target as Href;
}
