import type { Router } from "expo-router";

/** Which primary toolbar tab “owns” this recipe open (stack + tab chrome). */
export type RecipeToolbarContextTab = "home" | "account" | "calendar" | "grocery-list";

/**
 * Href for recipe detail. Always use this shape (pathname + params) instead of a
 * string like `/recipe/123` so global search/query state is not merged onto the route
 * (stale `recipeId`, `collectionId`, etc.).
 *
 * `toolbarCtx` tells toolbar history which tab’s stack should record `/recipe/…` (otherwise
 * `lastBaseTabRef` can still be `home` after visiting Home, and recipes opened from Account
 * get pushed onto the Home stack).
 */
export function recipeDetailHref(
  recipeId: string,
  options?: { returnTo?: string; toolbarCtx?: RecipeToolbarContextTab },
): { pathname: "/recipe/[recipeId]"; params: Record<string, string> } {
  const recipeIdStr = String(recipeId);
  const params: Record<string, string> = { recipeId: recipeIdStr };
  if (options?.returnTo) params.returnTo = options.returnTo;
  if (options?.toolbarCtx) params.toolbarCtx = options.toolbarCtx;
  return { pathname: "/recipe/[recipeId]", params };
}

export function navigateToRecipeDetail(
  router: Pick<Router, "push" | "replace">,
  recipeId: string,
  options?: {
    returnTo?: string;
    toolbarCtx?: RecipeToolbarContextTab;
    /** Swap the current recipe screen instead of stacking another `/recipe/…` (e.g. similar recipes). */
    replace?: boolean;
  },
): void {
  const href = recipeDetailHref(recipeId, options);
  if (options?.replace) {
    router.replace(href as never);
    return;
  }
  router.push(href as never);
}
