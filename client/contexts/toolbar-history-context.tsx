import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

type ToolbarTab = "home" | "calendar" | "grocery-list" | "account";
type ToolbarStacks = Record<ToolbarTab, string[]>;

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

/**
 * `/account/collection/[id]` starts with segment `account`, but this screen is opened from Home /
 * Search / Profile flows — not only from the Account tab. If we map it to the "account" toolbar
 * stack, collection pushes land on the wrong stack and Back replaces to `/account` instead of
 * the profile (or other) screen the user actually came from.
 */
function isAccountCollectionDetailPath(safePath: string): boolean {
  return /^\/account\/collection\/[^/?#]+/.test(safePath);
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

/**
 * Expo `useGlobalSearchParams()` merges params from the whole tree, so recipe/profile/account
 * href strings gain and lose stale keys (`recipeId`, `collectionId`, …) across renders. Exact
 * string equality then fails → we push duplicate frames for the same screen; Back cycles through
 * them and collection variants without `ownerUid` render as blank empty collections.
 */
function normalizedStackKey(href: string): string {
  const { path, query } = splitToolbarHref(href);
  const qs = paramsFromQueryString(query);

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

  // Account chrome (not collection detail): ignore unrelated query noise.
  if (/^\/account(\/?|$)/.test(path) && !/^\/account\/collection\//.test(path)) {
    return path;
  }

  return href;
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

type ToolbarHistoryContextValue = {
  getContextTabForPath: (pathname: string) => ToolbarTab;
  popBackHref: (tab: ToolbarTab) => string | null;
};

const ToolbarHistoryContext = createContext<ToolbarHistoryContextValue | null>(null);

export function ToolbarHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

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

  const lastBaseTabRef = useRef<ToolbarTab>("home");
  const skipNextBrowserPushRef = useRef(false);
  const lastBrowserPushedHrefRef = useRef<string | null>(null);

  const getContextTabForPath = useCallback((path: string): ToolbarTab => {
    const safePath = stripRouteGroups(path);
    if (isAccountCollectionDetailPath(safePath)) {
      return lastBaseTabRef.current;
    }
    const seg = firstPathSegment(path);
    if (BASE_TABS.has(seg as ToolbarTab)) {
      const tab = seg as ToolbarTab;
      lastBaseTabRef.current = tab;
      return tab;
    }
    if (DETAIL_SEGMENTS.has(seg)) {
      return lastBaseTabRef.current;
    }
    return lastBaseTabRef.current;
  }, []);

  /**
   * One stack per toolbar tab: push the current URL when it changes for that tab's context.
   * `stacksRef` is updated in the same tick as pushes/pops so back + pathname never race.
   */
  useEffect(() => {
    const tab = getContextTabForPath(pathname);
    const safePath = stripRouteGroups(pathname);
    const p = params as Record<string, unknown>;
    const href = (() => {
      if (
        isAccountCollectionPath(safePath) &&
        resolvedCollectionIdForToolbar(safePath, p)
      ) {
        return buildAccountCollectionToolbarHref(safePath, p);
      }
      return `${safePath}${queryStringFromParams(p)}`;
    })();
    setStacks((prev) => {
      if (isAccountCollectionPath(safePath) && !resolvedCollectionIdForToolbar(safePath, p)) {
        return prev;
      }
      const cur = stacksRef.current[tab] ?? prev[tab] ?? [];
      const last = cur.length > 0 ? cur[cur.length - 1] : null;
      if (last !== null && normalizedStackKey(last) === normalizedStackKey(href)) {
        if (last === href) return prev;
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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (
      typeof window === "undefined" ||
      typeof window.history?.pushState !== "function"
    ) {
      return;
    }
    const safePath = stripRouteGroups(pathname);
    const p = params as Record<string, unknown>;
    const href = (() => {
      if (isAccountCollectionPath(safePath) && resolvedCollectionIdForToolbar(safePath, p)) {
        return buildAccountCollectionToolbarHref(safePath, p);
      }
      return `${safePath}${queryStringFromParams(p)}`;
    })();

    if (isAccountCollectionPath(safePath) && !resolvedCollectionIdForToolbar(safePath, p)) {
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
  }, [params, pathname]);

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

  const value = useMemo<ToolbarHistoryContextValue>(
    () => ({
      getContextTabForPath,
      popBackHref,
    }),
    [getContextTabForPath, popBackHref],
  );

  return <ToolbarHistoryContext.Provider value={value}>{children}</ToolbarHistoryContext.Provider>;
}

export function useToolbarHistoryBack() {
  const ctx = useContext(ToolbarHistoryContext);
  if (!ctx) throw new Error("useToolbarHistoryBack must be used inside ToolbarHistoryProvider");
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    const tab = ctx.getContextTabForPath(pathname);
    const targetHref = ctx.popBackHref(tab);
    if (!targetHref) return false;
    const target = storedHrefToNavigationTarget(targetHref);
    router.replace(target as never);
    return true;
  }, [ctx, pathname, router]);
}
