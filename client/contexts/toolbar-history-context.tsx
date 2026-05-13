import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

export type ToolbarTab = "home" | "calendar" | "grocery-list" | "account";
type ToolbarStacks = Record<ToolbarTab, string[]>;

/** Canonical root path per bottom tab (matches `stripRouteGroups` / stack entries). */
export const TOOLBAR_TAB_ROOT_HREF: Record<ToolbarTab, string> = {
  home: "/home",
  calendar: "/calendar",
  "grocery-list": "/grocery-list",
  account: "/account",
};

const BASE_TABS = new Set<ToolbarTab>(["home", "calendar", "grocery-list", "account"]);
const DETAIL_SEGMENTS = new Set(["recipe", "profile"]);

function firstPathSegment(pathname: string): string {
  const segs = String(pathname ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const firstNonGroup = segs.find((s) => !(s.startsWith("(") && s.endsWith(")")));
  return firstNonGroup ?? "home";
}

/** Expo route groups like /(toolbar)/ are internal and should not be pushed/replaced directly. */
function stripRouteGroups(pathname: string): string {
  const segs = String(pathname ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return `/${segs.join("/")}`;
}

function queryStringFromParams(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (x != null) qs.append(k, String(x));
      }
      continue;
    }
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** True when pathname is a collection detail route (used to avoid double stack/history entries). */
function isAccountCollectionPath(safePath: string): boolean {
  return /^\/account\/collection(\/|$)/.test(safePath);
}

function isAccountCollectionDetailPath(safePath: string): boolean {
  return /^\/account\/collection\/[^/?#]+/.test(safePath);
}

/** Stored stack entry is a collection **detail** (`/account/collection/:id`), not `/account/collections`. */
function isAccountCollectionDetailStackEntry(href: string): boolean {
  const { path } = splitToolbarHref(href);
  return isAccountCollectionDetailPath(stripRouteGroups(path));
}

/**
 * Resolve collection id for toolbar/history matching. Expo can update pathname before
 * `collectionId` appears in global search params, or only put the id in the path segment.
 */
function resolvedCollectionIdForToolbar(
  safePath: string,
  params: Record<string, unknown>,
): string | null {
  const raw = params.collectionId;
  const fromParam = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromParam === "string" && fromParam.trim()) return fromParam.trim();
  if (typeof fromParam === "number" && Number.isFinite(fromParam)) return String(fromParam);

  const m = safePath.match(/^\/account\/collection\/([^/?#]+)/);
  const seg = m?.[1] ? decodeURIComponent(m[1]) : "";
  if (!seg || seg === "[collectionId]") return null;
  return seg;
}

function splitToolbarHref(href: string): { path: string; query: string } {
  const q = href.indexOf("?");
  if (q === -1) return { path: href, query: "" };
  return { path: href.slice(0, q), query: href.slice(q + 1) };
}

function paramsFromQueryString(query: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!query.trim()) return out;
  const sp = new URLSearchParams(query);
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

/** True if a stored href cannot load a real collection (ghost / half-pushed entry). */
function isIncompleteStoredCollectionHref(href: string): boolean {
  const { path, query } = splitToolbarHref(href);
  if (!isAccountCollectionPath(path)) return false;
  return !resolvedCollectionIdForToolbar(path, paramsFromQueryString(query));
}

/**
 * For collection detail, do NOT merge all global search params into history — that pulls in
 * unrelated keys (e.g. recipeId) and can drop ownerUid on some ticks, so `router.replace`
 * lands on the wrong API mode and shows an empty collection.
 */
function buildAccountCollectionToolbarHref(
  safePath: string,
  params: Record<string, unknown>,
): string {
  const qs = new URLSearchParams();
  const ou = params.ownerUid;
  const owner = Array.isArray(ou) ? ou[0] : ou;
  if (typeof owner === "string" && owner.trim()) {
    qs.set("ownerUid", owner.trim());
  }
  const fp = params.fromProfile;
  const fromP = Array.isArray(fp) ? fp[0] : fp;
  if (fromP === "1" || fromP === 1 || fromP === true) {
    qs.set("fromProfile", "1");
  }
  const q = qs.toString();
  return q ? `${safePath}?${q}` : safePath;
}

function isRecipeDetailPath(safePath: string): boolean {
  return /^\/recipe\/[^/?#]+/.test(safePath);
}

/** `/recipe/[id]` main detail only — not `/recipe/nutrition`, `/recipe/reviews`, etc. */
const RECIPE_NAMED_CHILD_SEGMENTS = new Set(["nutrition", "reviews", "share"]);

function isPrimaryRecipeDetailPath(safePath: string): boolean {
  const m = safePath.match(/^\/recipe\/([^/?#]+)$/);
  if (!m?.[1]) return false;
  const seg = decodeURIComponent(m[1]);
  if (!seg || seg === "[recipeId]") return false;
  if (RECIPE_NAMED_CHILD_SEGMENTS.has(seg)) return false;
  return true;
}

function isPrimaryRecipeDetailStackEntry(href: string): boolean {
  const { path } = splitToolbarHref(href);
  return isPrimaryRecipeDetailPath(stripRouteGroups(path));
}

/** First path segment recipe id, including `/recipe/id/child` (reviews, nutrition, …). */
function recipeToolbarIdentityFromHref(href: string): string | null {
  const { path } = splitToolbarHref(href);
  const m = path.match(/^\/recipe\/([^/?#]+)/);
  if (!m?.[1]) return null;
  const id = decodeURIComponent(m[1]);
  if (!id || id === "[recipeId]") return null;
  return id;
}

/** `/profile/[userId]` — not the static `collection-preview` route on the profile stack. */
function isProfileUserDetailPath(safePath: string): boolean {
  const m = safePath.match(/^\/profile\/([^/?#]+)$/);
  if (!m?.[1]) return false;
  return decodeURIComponent(m[1]) !== "collection-preview";
}

function isAccountCollectionDetailReady(
  safePath: string,
  params: Record<string, unknown>,
): boolean {
  return (
    isAccountCollectionDetailPath(safePath) &&
    !!resolvedCollectionIdForToolbar(safePath, params)
  );
}

function isAccountEditRecipeDetailPath(safePath: string): boolean {
  return /^\/account\/edit-recipe\/[^/?#]+/.test(safePath);
}

/**
 * Account index, lists, settings, etc. — not `/account/collection/[id]` detail.
 * Global search params must not be merged into these hrefs (stale `collectionId`, `recipeId`, …).
 */
function isAccountToolbarChromePath(safePath: string): boolean {
  if (!/^\/account(\/|$)/.test(safePath)) return false;
  if (isAccountCollectionDetailPath(safePath)) return false;
  return true;
}

/**
 * Hidden / sibling tabs (recipe, profile, account collection) can briefly restore the previous
 * URL when switching tabs. Defer stack + web history commit until the route settles.
 */
function shouldDeferTabDetailStackCommit(
  safeNext: string,
  safePrev: string,
  params: Record<string, unknown>,
): boolean {
  if (isRecipeDetailPath(safeNext) && !isRecipeDetailPath(safePrev)) return true;
  if (isProfileUserDetailPath(safeNext) && !isProfileUserDetailPath(safePrev)) return true;
  if (
    isAccountCollectionDetailReady(safeNext, params) &&
    !isAccountCollectionDetailPath(safePrev)
  ) {
    return true;
  }
  if (isAccountEditRecipeDetailPath(safeNext) && !isAccountEditRecipeDetailPath(safePrev)) {
    return true;
  }
  return false;
}

/**
 * Recipe identity lives in the URL segment. Do not append `queryStringFromParams(global)` here —
 * that duplicates `?recipeId=…` and pulls stale keys from other routes, which makes the stack
 * look like "633624 is still loaded" when it is only the prior Back frame.
 * Optional `toolbarCtx` / `returnTo` are copied explicitly so the owning tab stack stays correct.
 */
function buildRecipeToolbarHref(safePath: string, params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  const rt = params.returnTo;
  const returnTo = Array.isArray(rt) ? rt[0] : rt;
  if (typeof returnTo === "string" && returnTo.trim().startsWith("/")) {
    qs.set("returnTo", returnTo.trim());
  }
  const tc = params.toolbarCtx;
  const tctx = Array.isArray(tc) ? tc[0] : tc;
  if (
    typeof tctx === "string" &&
    (tctx === "home" ||
      tctx === "account" ||
      tctx === "calendar" ||
      tctx === "grocery-list")
  ) {
    qs.set("toolbarCtx", tctx);
  }
  const q = qs.toString();
  return q ? `${safePath}?${q}` : safePath;
}

/** Home feed index — never merge global search params onto `/home` (they belong on `/home/search`). */
function isHomeIndexPath(safePath: string): boolean {
  return stripRouteGroups(safePath) === "/home";
}

function isHomeSearchPath(safePath: string): boolean {
  const s = stripRouteGroups(safePath);
  return s === "/home/search" || s.startsWith("/home/search/");
}

/** Query keys that belong on the Home search stack entry (see `home/index` → `home/search`). */
const HOME_SEARCH_STACK_PARAM_KEYS = [
  "q",
  "budgetMin",
  "budgetMax",
  "allergies",
  "foodTypes",
  "cookware",
  "sortBy",
  "useMyCookwareOnly",
  "mode",
  "mealPlanId",
  "mealPlanDate",
] as const;

function buildHomeSearchToolbarHref(safePath: string, params: Record<string, unknown>): string {
  const path = stripRouteGroups(safePath).split("?")[0] ?? "/home/search";
  const qs = new URLSearchParams();
  for (const key of HOME_SEARCH_STACK_PARAM_KEYS) {
    const v = params[key];
    if (v == null) continue;
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw === undefined || raw === null) continue;
    const str = String(raw).trim();
    if (!str) continue;
    qs.set(key, str);
  }
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

/** Href string stored in toolbar stacks and mirrored to web `history.pushState`. */
function buildToolbarHistoryHref(safePath: string, params: Record<string, unknown>): string {
  if (isRecipeDetailPath(safePath)) {
    return buildRecipeToolbarHref(safePath, params);
  }
  if (isAccountCollectionPath(safePath) && resolvedCollectionIdForToolbar(safePath, params)) {
    return buildAccountCollectionToolbarHref(safePath, params);
  }
  if (isAccountToolbarChromePath(safePath)) {
    return safePath;
  }
  if (isHomeIndexPath(safePath)) {
    return "/home";
  }
  if (isHomeSearchPath(safePath)) {
    return buildHomeSearchToolbarHref(safePath, params);
  }
  return `${safePath}${queryStringFromParams(params)}`;
}

/** Drop `toolbarCtx` when it disagrees with the resolved tab (stale merged global params). */
function sanitizeRecipeToolbarParamsForTab(
  tab: ToolbarTab,
  safePath: string,
  paramsVal: Record<string, unknown>,
): Record<string, unknown> {
  if (!isRecipeDetailPath(safePath)) return paramsVal;
  const raw = paramsVal.toolbarCtx;
  const c = Array.isArray(raw) ? raw[0] : raw;
  const ts = typeof c === "string" ? c.trim() : "";
  if (ts && ts !== tab) {
    const out = { ...paramsVal };
    delete out.toolbarCtx;
    return out;
  }
  return paramsVal;
}

/** Href used only to compare the current screen to the stack top for primary-tab navigation. */
function toolbarCurrentHrefForStackCompare(
  safePath: string,
  tab: ToolbarTab,
  params: Record<string, unknown>,
): string {
  const root = TOOLBAR_TAB_ROOT_HREF[tab];
  // Tab index URLs must not merge global search params — stale `recipeId` etc. makes `/home`
  // normalize like `/recipe/…`, so we skip `replace` and the tab bar `onPress` leaves you on `/home`.
  if (safePath === root) return root;
  return buildToolbarHistoryHref(safePath, sanitizeRecipeToolbarParamsForTab(tab, safePath, params));
}

/**
 * Expo `useGlobalSearchParams()` merges params from the whole tree, so recipe/profile/account
 * href strings gain and lose stale keys (`recipeId`, `collectionId`, …) across renders. Exact
 * string equality then fails → we push duplicate frames for the same screen; Back cycles through
 * them and collection variants without `ownerUid` render as blank empty collections.
 */
function normalizedStackKey(href: string): string {
  const { path, query } = splitToolbarHref(href);
  const qs = paramsFromQueryString(query);
  const pathNorm = stripRouteGroups(path);

  if (pathNorm === "/home") {
    return "/home";
  }
  if (pathNorm === "/home/search" || pathNorm.startsWith("/home/search/")) {
    return buildHomeSearchToolbarHref(pathNorm, qs);
  }

  if (isAccountCollectionPath(path)) {
    const id = resolvedCollectionIdForToolbar(path, qs);
    if (!id) return href;
    // Same screen until path id changes; ownerUid/fromProfile may arrive on a later render.
    return `/account/collection/${id}`;
  }

  const rec = path.match(/^\/recipe\/([^/?#]+)$/);
  if (rec?.[1]) {
    return `/recipe/${decodeURIComponent(rec[1])}`;
  }

  const prof = path.match(/^\/profile\/([^/?#]+)$/);
  if (prof?.[1]) {
    return `/profile/${decodeURIComponent(prof[1])}`;
  }

  // Account chrome (lists, settings, …): path only — never merge unrelated global query keys.
  if (isAccountToolbarChromePath(path)) {
    return path;
  }

  return href;
}

function toolbarTabRootNormalizedKey(tab: ToolbarTab): string {
  return normalizedStackKey(TOOLBAR_TAB_ROOT_HREF[tab]);
}

/** True when this href is that tab's primary bottom-tab root (e.g. `/home`, `/account`). */
function isCommitHrefToolbarTabRoot(href: string, tab: ToolbarTab): boolean {
  return normalizedStackKey(href) === toolbarTabRootNormalizedKey(tab);
}

/**
 * `router.replace(string)` often drops or mishandles query strings on native Expo Router.
 * Use pathname + params so `[collectionId]` and `ownerUid` survive navigation.replace.
 */
function storedHrefToNavigationTarget(
  href: string,
): string | { pathname: string; params: Record<string, string> } {
  const { path, query } = splitToolbarHref(href);
  const qs = new URLSearchParams(query);

  const coll = path.match(/^\/account\/collection\/([^/?#]+)$/);
  if (coll?.[1]) {
    const collectionId = decodeURIComponent(coll[1]);
    if (!collectionId || collectionId === "[collectionId]") return href;
    const params: Record<string, string> = { collectionId };
    const ou = qs.get("ownerUid");
    if (ou) params.ownerUid = ou;
    const fp = qs.get("fromProfile");
    if (fp) params.fromProfile = fp;
    return {
      pathname: "/account/collection/[collectionId]",
      params,
    };
  }

  const prof = path.match(/^\/profile\/([^/?#]+)$/);
  if (prof?.[1]) {
    const userId = decodeURIComponent(prof[1]);
    if (!userId) return href;
    const params: Record<string, string> = { userId };
    qs.forEach((v, k) => {
      if (k !== "userId") params[k] = v;
    });
    return {
      pathname: "/profile/[userId]",
      params,
    };
  }

  const rec = path.match(/^\/recipe\/([^/?#]+)$/);
  if (rec?.[1]) {
    const recipeId = decodeURIComponent(rec[1]);
    if (!recipeId || recipeId === "[recipeId]") return href;
    const params: Record<string, string> = { recipeId };
    qs.forEach((v, k) => {
      if (k !== "recipeId") params[k] = v;
    });
    return {
      pathname: "/recipe/[recipeId]",
      params,
    };
  }

  return href;
}

/** Whether {@link popBackHref} would return a target for this tab (without mutating). */
function canPopToolbarStackForTab(stacks: ToolbarStacks, tab: ToolbarTab): boolean {
  const cur = stacks[tab] ?? [];
  if (cur.length <= 1) return false;
  let nextTabStack = cur.slice(0, -1);
  while (
    nextTabStack.length > 0 &&
    isIncompleteStoredCollectionHref(nextTabStack[nextTabStack.length - 1]!)
  ) {
    nextTabStack = nextTabStack.slice(0, -1);
  }
  return nextTabStack.length >= 1;
}

type ToolbarHistoryContextValue = {
  getContextTabForPath: (pathname: string, searchParams?: Record<string, unknown>) => ToolbarTab;
  popBackHref: (tab: ToolbarTab) => string | null;
  /** True when the toolbar stack has a prior frame for the current tab (custom Back will work). */
  canToolbarHistoryBack: boolean;
  /** Reset in-app history for one tab to its root only (e.g. double-tap tab). */
  resetTabStackToRoot: (tab: ToolbarTab) => void;
  /**
   * Bottom tab (Home, Calendar, Groceries, Account): **read that tab’s `stacksRef[tab]`**, take
   * the **last entry** (stack top), and if you are not already on that screen, `router.replace`
   * there. Return `true` so the tab bar skips its default `onPress` (which would jump to the tab
   * root like `/home` and ignore history).
   *
   * Flow when user taps **Home** (same for other primary tabs):
   * 1. `cur = stacksRef.current["home"]` (e.g. `["/home", "/recipe/631745"]`).
   * 2. `top = cur[cur.length - 1]` — the href history says should be visible.
   * 3. Compare `top` to the current route (`hrefNow`); if different → `replace(storedHrefToNavigationTarget(top))`.
   */
  navigatePrimaryTabIfStackAhead: (
    tab: ToolbarTab,
    opts?: { switchToThisTab?: boolean },
  ) => boolean;
};

const ToolbarHistoryContext = createContext<ToolbarHistoryContextValue | null>(null);

/** Set to `false` to silence Metro logs while debugging something else. */
export const DEBUG_LOG_TOOLBAR_STACKS = __DEV__;

/** Trace tab press → stack read → `router.replace` / `defaultOnPress`. Filter Metro by `[ToolbarHistory nav-flow]`. */
export function logToolbarNavFlow(payload: Record<string, unknown>): void {
  if (!DEBUG_LOG_TOOLBAR_STACKS) return;
  // Single string so Android / Metro never collapses a multi-arg log line.
  console.log(`[ToolbarHistory nav-flow] ${JSON.stringify(payload)}`);
}

export function ToolbarHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const router = useRouter();

  const [stacks, setStacks] = useState<ToolbarStacks>({
    home: [],
    calendar: [],
    "grocery-list": [],
    account: [],
  });
  const stacksRef = useRef<ToolbarStacks>(stacks);
  useEffect(() => {
    stacksRef.current = stacks;
  }, [stacks]);

  useEffect(() => {
    if (!DEBUG_LOG_TOOLBAR_STACKS) return;
    console.log(
      "[ToolbarHistory stacks]",
      JSON.stringify(
        {
          pathname,
          stacks: {
            home: [...stacks.home],
            calendar: [...stacks.calendar],
            "grocery-list": [...stacks["grocery-list"]],
            account: [...stacks.account],
          },
        },
        null,
        2,
      ),
    );
  }, [stacks, pathname]);

  const lastBaseTabRef = useRef<ToolbarTab>("home");
  const skipNextBrowserPushRef = useRef(false);
  const lastBrowserPushedHrefRef = useRef<string | null>(null);

  /** Latest route (refs avoid stale closures in deferred commits). */
  const pathnameRef = useRef(pathname);
  const paramsRef = useRef(params);
  pathnameRef.current = pathname;
  paramsRef.current = params;

  /**
   * Pathname after the last toolbar stack + web history commit. Used with deferred commits so
   * we do not record a stale URL when a hidden tab briefly restores its previous route.
   */
  const prevStackCommitPathnameRef = useRef(pathname);
  const tabDetailNavDeferTokenRef = useRef(0);

  const getContextTabForPath = useCallback((path: string, searchParams?: Record<string, unknown>): ToolbarTab => {
    const safe = stripRouteGroups(path);
    const seg = firstPathSegment(path);
    if (BASE_TABS.has(seg as ToolbarTab)) {
      const tab = seg as ToolbarTab;
      lastBaseTabRef.current = tab;
      return tab;
    }

    if (seg === "recipe" && isRecipeDetailPath(safe)) {
      const raw = searchParams?.toolbarCtx;
      const ctx = Array.isArray(raw) ? raw[0] : raw;
      const s = typeof ctx === "string" ? ctx.trim() : "";
      if (s === "home" || s === "account" || s === "calendar" || s === "grocery-list") {
        const tab = s as ToolbarTab;
        if (tab === "account" && lastBaseTabRef.current === "home") {
          // Stale merged global `toolbarCtx=account` while the user is still in the Home tab flow
          // (e.g. opened `/recipe/…` from Home search without explicit `toolbarCtx`).
        } else {
          lastBaseTabRef.current = tab;
          return tab;
        }
      }
    }

    if (seg === "profile" && isProfileUserDetailPath(safe)) {
      lastBaseTabRef.current = "account";
      return "account";
    }

    if (DETAIL_SEGMENTS.has(seg)) {
      return lastBaseTabRef.current;
    }
    return lastBaseTabRef.current;
  }, []);

  /**
   * One stack per toolbar tab: push the current URL when it changes for that tab's context.
   * `stacksRef` is updated in the same tick as pushes/pops so back + pathname never race.
   *
   * Recipe, profile user, account collection detail, and account edit-recipe can briefly show a
   * stale tab URL when switching from another tab. Defer commit until after paint; cleanup
   * flushes the latest URL.
   */
  useEffect(() => {
    const safeNext = stripRouteGroups(pathname);
    const p = params as Record<string, unknown>;
    const safePrev = stripRouteGroups(prevStackCommitPathnameRef.current);
    const shouldDefer = shouldDeferTabDetailStackCommit(safeNext, safePrev, p);

    const commitToolbarHistoryForLocation = (
      pathVal: string,
      paramsVal: Record<string, unknown>,
    ) => {
      const tab = getContextTabForPath(pathVal, paramsVal);
      const safePath = stripRouteGroups(pathVal);
      const paramsForHref = sanitizeRecipeToolbarParamsForTab(tab, safePath, paramsVal);
      const href = buildToolbarHistoryHref(safePath, paramsForHref);

      if (isAccountCollectionPath(safePath) && !resolvedCollectionIdForToolbar(safePath, paramsVal)) {
        return;
      }

      setStacks((prev) => {
        let cur = stacksRef.current[tab] ?? prev[tab] ?? [];

        // Only one collection-detail frame: opening another collection (or the same one with
        // ownerUid/fromProfile) must not leave an older `/account/collection/…` under recipe/profile.
        if (
          isAccountCollectionDetailPath(safePath) &&
          resolvedCollectionIdForToolbar(safePath, paramsVal)
        ) {
          cur = cur.filter((e) => !isAccountCollectionDetailStackEntry(e));
        }

        // Committing a tab root (`/home`, `/account`, …): never shrink the stack or push root on
        // top of details. Expo often reports the tab root pathname briefly when switching tabs;
        // the real destination is the stack top (`navigatePrimaryTabIfStackAhead` → recipe).
        // Popping details here removed `/recipe/…` and broke primary-tab navigation.
        if (isCommitHrefToolbarTabRoot(href, tab)) {
          const lastForRoot = cur.length > 0 ? cur[cur.length - 1] : null;
          if (lastForRoot !== null && !isCommitHrefToolbarTabRoot(lastForRoot, tab)) {
            return prev;
          }
        }

        const last = cur.length > 0 ? cur[cur.length - 1] : null;
        if (last !== null && normalizedStackKey(last) === normalizedStackKey(href)) {
          if (last === href) return prev;
          const nextTabStack = [...cur.slice(0, -1), href];
          const nextStacks: ToolbarStacks = { ...prev, [tab]: nextTabStack };
          stacksRef.current = nextStacks;
          return nextStacks;
        }
        if (
          last !== null &&
          isPrimaryRecipeDetailStackEntry(last) &&
          isPrimaryRecipeDetailPath(safePath) &&
          normalizedStackKey(last) !== normalizedStackKey(href)
        ) {
          const nextTabStack = [...cur.slice(0, -1), href];
          const nextStacks: ToolbarStacks = { ...prev, [tab]: nextTabStack };
          stacksRef.current = nextStacks;
          return nextStacks;
        }
        if (cur.length > 0 && cur[cur.length - 1] === href) {
          return prev;
        }
        const nextTabStack = [...cur, href];
        const nextStacks: ToolbarStacks = { ...prev, [tab]: nextTabStack };
        stacksRef.current = nextStacks;
        return nextStacks;
      });

      prevStackCommitPathnameRef.current = pathVal;

      if (Platform.OS !== "web") return;
      if (typeof window === "undefined" || typeof window.history?.pushState !== "function") {
        return;
      }
      if (skipNextBrowserPushRef.current) {
        skipNextBrowserPushRef.current = false;
        lastBrowserPushedHrefRef.current = href;
        return;
      }
      if (lastBrowserPushedHrefRef.current === href) return;
      try {
        window.history.pushState({ savr: true }, "", href);
        lastBrowserPushedHrefRef.current = href;
      } catch {
        // ignore browser history API failures
      }
    };

    if (shouldDefer) {
      const token = ++tabDetailNavDeferTokenRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token !== tabDetailNavDeferTokenRef.current) return;
          commitToolbarHistoryForLocation(
            pathnameRef.current,
            paramsRef.current as Record<string, unknown>,
          );
        });
      });
      return () => {
        tabDetailNavDeferTokenRef.current += 1;
        commitToolbarHistoryForLocation(
          pathnameRef.current,
          paramsRef.current as Record<string, unknown>,
        );
      };
    }

    commitToolbarHistoryForLocation(pathname, p);
  }, [getContextTabForPath, params, pathname]);

  // On web, mirror in-app route transitions into browser history entries so desktop Back/History
  // behaves like a browser tab stack. We skip the next push after popstate to avoid re-adding.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const onPopState = () => {
      skipNextBrowserPushRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const popBackHref = useCallback((tab: ToolbarTab): string | null => {
    const cur = stacksRef.current[tab];
    if (!cur || cur.length <= 1) return null;
    let nextTabStack = cur.slice(0, -1);
    while (
      nextTabStack.length > 0 &&
      isIncompleteStoredCollectionHref(nextTabStack[nextTabStack.length - 1]!)
    ) {
      nextTabStack = nextTabStack.slice(0, -1);
    }
    if (nextTabStack.length < 1) return null;
    const target = nextTabStack[nextTabStack.length - 1] ?? null;
    if (!target) return null;
    const nextStacks: ToolbarStacks = { ...stacksRef.current, [tab]: nextTabStack };
    stacksRef.current = nextStacks;
    setStacks(nextStacks);
    return target;
  }, []);

  const resetTabStackToRoot = useCallback((tab: ToolbarTab) => {
    const root = TOOLBAR_TAB_ROOT_HREF[tab];
    const nextStacks: ToolbarStacks = { ...stacksRef.current, [tab]: [root] };
    stacksRef.current = nextStacks;
    setStacks(nextStacks);
  }, []);

  const navigatePrimaryTabIfStackAhead = useCallback(
    (tab: ToolbarTab, opts?: { switchToThisTab?: boolean }): boolean => {
      // --- 1. Read this tab’s toolbar stack from history (`stacksRef` is updated on every route commit)
      const cur = stacksRef.current[tab] ?? [];
      logToolbarNavFlow({
        kind: "stack_check",
        phase: "read_stack",
        tab,
        switchToThisTab: opts?.switchToThisTab ?? false,
        stackForTab: [...cur],
        pathname: pathnameRef.current,
      });
      if (cur.length === 0) {
        logToolbarNavFlow({ kind: "stack_check", phase: "skip", reason: "empty_stack", tab });
        return false;
      }
      const top = cur[cur.length - 1];
      if (!top) {
        logToolbarNavFlow({ kind: "stack_check", phase: "skip", reason: "no_stack_top", tab });
        return false;
      }

      // --- 2. Where is the app right now? (used only to skip redundant `replace`)
      const safePath = stripRouteGroups(pathnameRef.current);
      const hrefNow = toolbarCurrentHrefForStackCompare(
        safePath,
        tab,
        paramsRef.current as Record<string, unknown>,
      );
      const sameNormalized = normalizedStackKey(top) === normalizedStackKey(hrefNow);
      const idTop = recipeToolbarIdentityFromHref(top);
      const idNow = recipeToolbarIdentityFromHref(hrefNow);
      const sameRecipe =
        idTop != null && idTop === idNow && isRecipeDetailPath(stripRouteGroups(safePath));
      const sameTop = sameNormalized || sameRecipe;
      if (sameTop && !opts?.switchToThisTab) {
        logToolbarNavFlow({
          kind: "stack_check",
          phase: "skip",
          reason: "already_on_stack_top",
          tab,
          top,
          hrefNow,
          sameNormalized,
          sameRecipe,
        });
        return false;
      }

      // --- 3. Open whatever history put on top of this tab’s stack (e.g. `/recipe/…` after Home)
      const target = storedHrefToNavigationTarget(top);
      logToolbarNavFlow({
        kind: "stack_check",
        phase: "replace",
        tab,
        stackTop: top,
        hrefNow,
        sameTop,
        switchToThisTab: opts?.switchToThisTab ?? false,
        target:
          typeof target === "string" ? target : { pathname: target.pathname, params: target.params },
      });
      lastBaseTabRef.current = tab;
      router.replace(target as never);
      return true;
    },
    [router],
  );

  const canToolbarHistoryBack = useMemo(() => {
    const tab = getContextTabForPath(pathname, params as Record<string, unknown>);
    return canPopToolbarStackForTab(stacks, tab);
  }, [stacks, pathname, params, getContextTabForPath]);

  const value = useMemo<ToolbarHistoryContextValue>(
    () => ({
      getContextTabForPath,
      popBackHref,
      canToolbarHistoryBack,
      resetTabStackToRoot,
      navigatePrimaryTabIfStackAhead,
    }),
    [
      getContextTabForPath,
      popBackHref,
      canToolbarHistoryBack,
      resetTabStackToRoot,
      navigatePrimaryTabIfStackAhead,
    ],
  );

  return <ToolbarHistoryContext.Provider value={value}>{children}</ToolbarHistoryContext.Provider>;
}

export function useToolbarHistoryBack() {
  const ctx = useContext(ToolbarHistoryContext);
  if (!ctx) throw new Error("useToolbarHistoryBack must be used inside ToolbarHistoryProvider");
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return useCallback(() => {
    const tab = ctx.getContextTabForPath(pathname, params as Record<string, unknown>);
    const targetHref = ctx.popBackHref(tab);
    if (!targetHref) return false;
    const target = storedHrefToNavigationTarget(targetHref);
    router.replace(target as never);
    return true;
  }, [ctx, pathname, params, router]);
}

/** For UI: whether custom toolbar back is available on the current route. */
export function useToolbarHistoryHasBack(): boolean {
  const ctx = useContext(ToolbarHistoryContext);
  return ctx?.canToolbarHistoryBack ?? false;
}

/** Double-tap a primary bottom tab (while it is already selected) to reset its toolbar stack and go to the tab root. */
export function useToolbarPrimaryTabDoublePress() {
  const ctx = useContext(ToolbarHistoryContext);
  const router = useRouter();
  const lastRef = useRef<{ tab: ToolbarTab; t: number } | null>(null);

  const handlePrimaryTabDoublePress = useCallback(
    (tab: ToolbarTab, isSelected: boolean, defaultOnPress: () => void): boolean => {
      logToolbarNavFlow({ kind: "double_press", phase: "entry", tab, isSelected });
      if (!ctx) {
        logToolbarNavFlow({
          kind: "double_press",
          phase: "stop",
          reason: "no_ToolbarHistoryContext",
          tab,
          next: "defaultOnPress_only",
        });
        defaultOnPress();
        return false;
      }
      if (!isSelected) {
        lastRef.current = null;
        logToolbarNavFlow({ kind: "double_press", phase: "branch_switch_tab", tab });
        const didNavigate = ctx.navigatePrimaryTabIfStackAhead(tab, { switchToThisTab: true });
        logToolbarNavFlow({
          kind: "double_press",
          phase: "after_navigatePrimaryTabIfStackAhead",
          tab,
          switchToThisTab: true,
          didNavigate,
        });
        if (didNavigate) {
          logToolbarNavFlow({
            kind: "double_press",
            phase: "stop",
            reason: "navigated_from_stack",
            tab,
            next: "return_skip_defaultOnPress",
          });
          return true;
        }
        logToolbarNavFlow({
          kind: "double_press",
          phase: "calling_defaultOnPress",
          tab,
          reason: "navigatePrimaryTabIfStackAhead_returned_false",
        });
        defaultOnPress();
        return false;
      }
      const now = Date.now();
      const prev = lastRef.current;
      if (prev && prev.tab === tab && now - prev.t < 450) {
        lastRef.current = null;
        logToolbarNavFlow({
          kind: "double_press",
          phase: "branch_double_tap_reset",
          tab,
          next: "resetTabStackToRoot_and_replace_root",
        });
        ctx.resetTabStackToRoot(tab);
        router.replace(TOOLBAR_TAB_ROOT_HREF[tab] as never);
        return true;
      }
      logToolbarNavFlow({ kind: "double_press", phase: "branch_tab_already_selected", tab });
      const didNavigate = ctx.navigatePrimaryTabIfStackAhead(tab);
      logToolbarNavFlow({
        kind: "double_press",
        phase: "after_navigatePrimaryTabIfStackAhead",
        tab,
        switchToThisTab: false,
        didNavigate,
      });
      if (didNavigate) {
        logToolbarNavFlow({
          kind: "double_press",
          phase: "stop",
          reason: "navigated_from_stack",
          tab,
          next: "return_skip_defaultOnPress",
        });
        lastRef.current = null;
        return true;
      }
      logToolbarNavFlow({
        kind: "double_press",
        phase: "calling_defaultOnPress",
        tab,
        reason: "navigatePrimaryTabIfStackAhead_returned_false",
      });
      lastRef.current = { tab, t: now };
      defaultOnPress();
      return false;
    },
    [ctx, router],
  );

  return { handlePrimaryTabDoublePress };
}
