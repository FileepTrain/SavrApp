import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  const stacksRef = useRef(stacks);
  useEffect(() => {
    stacksRef.current = stacks;
  }, [stacks]);

  const lastBaseTabRef = useRef<ToolbarTab>("home");
  const skipNextBrowserPushRef = useRef(false);
  const lastBrowserPushedHrefRef = useRef<string | null>(null);

  const getContextTabForPath = useCallback((path: string): ToolbarTab => {
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

  useEffect(() => {
    const tab = getContextTabForPath(pathname);
    const safePath = stripRouteGroups(pathname);
    const href = `${safePath}${queryStringFromParams(params as Record<string, unknown>)}`;
    setStacks((prev) => {
      const cur = prev[tab];
      if (cur[cur.length - 1] === href) return prev;
      const next = { ...prev, [tab]: [...cur, href] };
      return next;
    });
  }, [getContextTabForPath, params, pathname]);

  // On web, mirror in-app route transitions into browser history entries so desktop Back/History
  // behaves like a browser tab stack. We skip the next push after popstate to avoid re-adding.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      skipNextBrowserPushRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const safePath = stripRouteGroups(pathname);
    const href = `${safePath}${queryStringFromParams(params as Record<string, unknown>)}`;

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
    const next = cur.slice(0, -1);
    const target = next[next.length - 1] ?? null;
    setStacks((prev) => ({ ...prev, [tab]: next }));
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
    const prevHref = ctx.popBackHref(tab);
    if (!prevHref) return false;
    router.replace(prevHref as never);
    return true;
  }, [ctx, pathname, router]);
}

